// =============================================================================
// scalability.js - Test de scalabilitate (ramping VUs)
// =============================================================================
//
// CE MASOARA:
//   Cum se degradeaza (sau nu) latenta pe GET /api/chats pe masura ce creste
//   numarul de utilizatori virtuali (VUs) concurenti care lovesc backend-ul
//   simultan. Daca p95 explodeaza cand ajungem la 200 VUs => avem nevoie de
//   scalare orizontala (mai multe instante) sau optimizari (cache, index DB).
//
// CUM FUNCTIONEAZA:
//   Scenariu "ramping-vus" - k6 creste gradual numarul de VUs in 5 etape:
//     etapa 1: 30s rampa pana la  10 VUs
//     etapa 2: 30s rampa pana la  50 VUs
//     etapa 3: 30s rampa pana la 100 VUs
//     etapa 4: 30s rampa pana la 200 VUs
//     etapa 5: 15s rampa pana la   0 VUs (cool-down)
//   Fiecare VU intr-un loop continuu: GET /api/chats -> masoara timpul.
//
// PRAGURI:
//   - scal_latency_ms p95 < 500 ms     (la 200 VUs e acceptabil sa creasca)
//   - http_req_failed rate < 1%        (erorile sunt semn de blocare)
//
// CUM SE RULEAZA:
//   k6 run --out json=scalability_results.json scalability.js
//
// CITIREA REZULTATELOR:
//   plots.py grupeaza punctele pe bucketi de VUs si traseaza p50/p95 vs nr VUs.
//   Curba ascendenta = sistem care nu scaleaza; curba plata = sistem care
//   incaseaza sarcina bine.
// =============================================================================

import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const cfg = new SharedArray('cfg', function () {
    return [JSON.parse(open('./config.json'))];
})[0];

const BASE = __ENV.BASE_URL || 'http://localhost:8081';

const tLatency = new Trend('scal_latency_ms', true);

export const options = {
    // ramping VUs: cresc gradual numarul de utilizatori concurenti
    scenarios: {
        ramp: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '30s', target: 10  },
                { duration: '30s', target: 50  },
                { duration: '30s', target: 100 },
                { duration: '30s', target: 200 },
                { duration: '15s', target: 0   },
            ],
            gracefulRampDown: '5s',
        },
    },
    thresholds: {
        scal_latency_ms: ['p(95)<500'],
        http_req_failed: ['rate<0.01'],
    },
};

const authHeaders = { Authorization: 'Bearer ' + cfg.tokenA };

export default function () {
    const r = http.get(`${BASE}/api/chats`, { headers: authHeaders });
    tLatency.add(r.timings.duration);
    check(r, { 'status 200': (x) => x.status === 200 });
}
