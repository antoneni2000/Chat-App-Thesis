// =============================================================================
// rest.js - Test performanta pentru endpoint-urile REST (HTTP)
// =============================================================================
//
// CE MASOARA:
//   Timpul de raspuns pe partea de server (request -> response) pentru operatii
//   reprezentative ale aplicatiei. Fiecare operatie are propria metrica separata,
//   ca sa putem analiza independent (un endpoint lent nu polueaza statisticile
//   celorlalte).
//
// DOUA SCENARII SEPARATE:
//   reads_bench - cele 3 citiri uzuale (chats, messages, /me)
//   auth_bench  - login-ul, masurat separat fiindca bcrypt e intentionat lent
//                 (~80-300 ms) si ar distorsiona scara grafica daca ar fi pus
//                 in aceeasi figura cu citirile.
//
// PARAMETRI:
//   BASE_URL    - URL-ul backend-ului (default: http://localhost:8081)
//   ITERATIONS  - cate iteratii sa ruleze (default: 50)
//
// PRAGURI (thresholds RNF02):
//   - Endpoint-urile uzuale (non-bcrypt) trebuie sa aiba p95 < 200 ms
//   - Login-ul (bcrypt) are prag relaxat: p95 < 1000 ms
//
// CUM SE RULEAZA:
//   k6 run --out json=rest_results.json rest.js
//
// PRECONDITII:
//   - Backend pornit, setup.ps1 rulat (config.json valid cu loginUser/loginPass)
// =============================================================================

import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const cfg = new SharedArray('cfg', function () {
    return [JSON.parse(open('./config.json'))];
})[0];

const BASE = __ENV.BASE_URL || 'http://localhost:8081';
const ITER = parseInt(__ENV.ITERATIONS || '50');

// Cate o metrica separata pentru fiecare endpoint, ca sa avem statistici independente.
const tListChats   = new Trend('rest_list_chats_ms', true);
const tListMsgs    = new Trend('rest_list_messages_ms', true);
const tLogin       = new Trend('rest_login_ms', true);
const tGetMe       = new Trend('rest_get_me_ms', true);

export const options = {
    scenarios: {
        reads_bench: {
            executor: 'per-vu-iterations',
            exec: 'reads',
            vus: 1,
            iterations: ITER,
            maxDuration: '5m',
        },
        auth_bench: {
            executor: 'per-vu-iterations',
            exec: 'auth',
            vus: 1,
            iterations: ITER,
            maxDuration: '5m',
            // k6 nu suporta "porneste dupa ce se termina celalalt scenariu", deci
            // estimam: 50 citiri x ~20 ms = ~1-2 s. 10 s e marja sigura.
            // Daca cresti ITERATIONS mult peste 50, mareste si startTime.
            startTime: '10s',
        },
    },
    thresholds: {
        rest_list_chats_ms:    ['p(95)<200'],
        rest_list_messages_ms: ['p(95)<200'],
        rest_get_me_ms:        ['p(95)<200'],
        // bcrypt e intentionat lent (~80-300 ms), pragul e mai relaxat.
        rest_login_ms:         ['p(95)<1000'],
    },
};

const authHeaders = { Authorization: 'Bearer ' + cfg.tokenA };
const chatId = cfg.chatId;

export function reads() {
    // 1. GET /api/chats
    let r = http.get(`${BASE}/api/chats`, { headers: authHeaders, tags: { name: 'list_chats' } });
    tListChats.add(r.timings.duration);
    check(r, { 'list_chats 200': (x) => x.status === 200 });

    // 2. GET /api/chats/{id}/messages
    r = http.get(`${BASE}/api/chats/${chatId}/messages?limit=50`, { headers: authHeaders, tags: { name: 'list_messages' } });
    tListMsgs.add(r.timings.duration);
    check(r, { 'list_messages 200': (x) => x.status === 200 });

    // 3. GET /api/users/me
    r = http.get(`${BASE}/api/users/me`, { headers: authHeaders, tags: { name: 'get_me' } });
    tGetMe.add(r.timings.duration);
    check(r, { 'get_me 200': (x) => x.status === 200 });
}

export function auth() {
    // POST /api/auth/login (bcrypt - asteptat ~80-300 ms)
    const username = cfg.loginUser || __ENV.LOGIN_USER;
    const password = cfg.loginPass || __ENV.LOGIN_PASS || 'Perftest123!';
    if (!username) {
        throw new Error('loginUser lipseste din config.json - ruleaza setup.ps1');
    }
    const body = JSON.stringify({ identifier: username, password: password });
    const r = http.post(`${BASE}/api/auth/login`, body, {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'login' },
    });
    tLogin.add(r.timings.duration);
    check(r, { 'login 200': (x) => x.status === 200 });
}
