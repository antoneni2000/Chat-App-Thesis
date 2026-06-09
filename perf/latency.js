// =============================================================================
// latency.js - Test latenta end-to-end pe canalul WebSocket/STOMP
// =============================================================================
//
// CE MASOARA:
//   Timpul (in ms) intre momentul cand userA trimite un mesaj pe WebSocket si
//   momentul cand userB il primeste. Aceasta este latenta perceputa de utilizator
//   intr-o conversatie reala (round-trip prin backend -> broker STOMP -> abonati).
//
// CUM FUNCTIONEAZA:
//   - 2 useri virtuali (VUs) in paralel:
//       * receiver  - userB se conecteaza pe ws://, face SUBSCRIBE pe topic-ul chatului
//       * sender    - userA se conecteaza pe ws://, trimite N mesaje cu spacing de 100ms
//   - Fiecare mesaj contine in "content" marker-ul "PERF|" + Date.now() (timestamp emisie)
//   - Receiver-ul extrage timestamp-ul din mesaj, calculeaza (Date.now() - sendTs)
//     si adauga rezultatul in trend-ul "e2e_latency_ms"
//
// PARAMETRI (variabile de mediu):
//   N_MESSAGES    - cate mesaje sa trimita sender-ul (default: 500)
//   SEND_RATE_MS  - cadenta intre mesaje (default: 100 ms -> 10 msg/s)
//
// PRAGURI (thresholds RNF01):
//   - p50 < 50 ms  (median rapid)
//   - p95 < 100 ms (cazuri lente acceptabile)
//   - p99 < 150 ms (outlieri)
//   - >= 95% din mesaje trebuie sa ajunga la destinatar
//
// CUM SE RULEAZA:
//   k6 run --out json=latency_results.json latency.js
//
// PRECONDITII:
//   - Backend pornit
//   - setup.ps1 rulat (exista config.json cu tokenA, tokenB, chatId, wsUrl)
// =============================================================================

import ws from 'k6/ws';
import { Trend, Counter } from 'k6/metrics';
import { check } from 'k6';
import { SharedArray } from 'k6/data';

const cfg = new SharedArray('cfg', function () {
    return [JSON.parse(open('./config.json'))];
})[0];

const N_MESSAGES   = parseInt(__ENV.N_MESSAGES || '500');
const SEND_RATE_MS = parseInt(__ENV.SEND_RATE_MS || '100'); // 10 msg/s
const MARKER       = 'PERF|';

export const options = {
    scenarios: {
        receiver: {
            executor: 'per-vu-iterations',
            vus: 1, iterations: 1, maxDuration: '5m',
            exec: 'receiver',
        },
        sender: {
            executor: 'per-vu-iterations',
            vus: 1, iterations: 1, maxDuration: '5m',
            exec: 'sender',
            startTime: '2s', // lasa receiverul sa se aboneze
        },
    },
    thresholds: {
        e2e_latency_ms: ['p(50)<50', 'p(95)<100', 'p(99)<150'],
        msgs_received: [`count>=${Math.floor(N_MESSAGES * 0.95)}`],
    },
};

const latency = new Trend('e2e_latency_ms', true);
const received = new Counter('msgs_received');

// ---------- STOMP framing helpers ----------
function stompConnect(token) {
    return [
        'CONNECT',
        'accept-version:1.2',
        'host:localhost',
        'heart-beat:0,0',
        'Authorization:Bearer ' + token,
        '', '',
    ].join('\n') + '\0';
}

function stompSubscribe(id, dest) {
    return ['SUBSCRIBE', 'id:' + id, 'destination:' + dest, '', ''].join('\n') + '\0';
}

function stompSend(dest, body) {
    return [
        'SEND',
        'destination:' + dest,
        'content-type:application/json',
        'content-length:' + body.length,
        '', body,
    ].join('\n') + '\0';
}

function stompDisconnect() {
    return 'DISCONNECT\n\n\0';
}

// extrage corpul JSON dintr-un frame STOMP MESSAGE
function extractBody(frame) {
    const idx = frame.indexOf('\n\n');
    if (idx < 0) return null;
    let body = frame.substring(idx + 2);
    if (body.endsWith('\0')) body = body.slice(0, -1);
    return body;
}

// ---------- VUs ----------
export function receiver() {
    const url = cfg.wsUrl;
    const topic = '/topic/chat/' + cfg.chatId;

    const res = ws.connect(url, null, function (socket) {
        socket.on('open', function () {
            socket.send(stompConnect(cfg.tokenB));
        });

        let connected = false;
        socket.on('message', function (frame) {
            if (!connected && frame.startsWith('CONNECTED')) {
                connected = true;
                socket.send(stompSubscribe('sub-perf', topic));
                return;
            }
            if (frame.startsWith('MESSAGE')) {
                const recvTs = Date.now();
                const body = extractBody(frame);
                if (!body) return;
                try {
                    const msg = JSON.parse(body);
                    const content = msg.content || '';
                    if (content.startsWith(MARKER)) {
                        const sendTs = parseInt(content.substring(MARKER.length));
                        if (!isNaN(sendTs)) {
                            latency.add(recvTs - sendTs);
                            received.add(1);
                        }
                    }
                } catch (e) { /* ignore */ }
            }
        });

        // ramane conectat suficient cat sa primesti toate mesajele
        const totalMs = 2000 + N_MESSAGES * SEND_RATE_MS + 5000;
        socket.setTimeout(function () {
            socket.send(stompDisconnect());
            socket.close();
        }, totalMs);
    });

    check(res, { 'receiver ws status 101': (r) => r && r.status === 101 });
}

export function sender() {
    const url = cfg.wsUrl;
    const dest = '/app/chat.send';

    const res = ws.connect(url, null, function (socket) {
        let sent = 0;
        let connected = false;

        socket.on('open', function () {
            socket.send(stompConnect(cfg.tokenA));
        });

        function sendOne() {
            if (sent >= N_MESSAGES) {
                socket.setTimeout(function () {
                    socket.send(stompDisconnect());
                    socket.close();
                }, 3000);
                return;
            }
            const ts = Date.now();
            const body = JSON.stringify({
                chatId: cfg.chatId,
                content: MARKER + ts,
                attachmentUrl: null,
                attachmentName: null,
                attachmentType: null,
            });
            socket.send(stompSend(dest, body));
            sent++;
            socket.setTimeout(sendOne, SEND_RATE_MS);
        }

        socket.on('message', function (frame) {
            if (!connected && frame.startsWith('CONNECTED')) {
                connected = true;
                sendOne();
            }
        });
    });

    check(res, { 'sender ws status 101': (r) => r && r.status === 101 });
}
