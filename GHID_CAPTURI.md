# Ghid pas-cu-pas pentru capturile capitolului 5

> Pentru vederea de ansamblu a folderului `perf/` (ce face fiecare fișier,
> structura JSON-urilor de rezultat, troubleshooting) vezi [README.md](README.md).
> Acest ghid acoperă doar **capturile de ecran** necesare pentru `Capitol_5.docx`.

Folosește `Win + Shift + S` pentru capturi. Salvează fiecare PNG în `perf/screenshots/`
cu numele indicat (`cap_01_*`, `cap_02_*`, ...). Acelea sunt referite direct din `Capitol_5.docx`.

## Înainte de a începe

Deschide **3 terminale PowerShell** separate (în PowerShell `&&` nu funcționează):

1. **Terminal 1 — Backend:**
   ```powershell
   cd backend
   ./mvnw spring-boot:run
   ```
2. **Terminal 2 — Frontend:**
   ```powershell
   cd frontend
   npm run dev
   ```
3. **Postgres:** verifică să ruleze (serviciu Windows sau `docker compose up postgres`).
4. **Terminal 3 — Setup teste:**
   ```powershell
   cd perf
   ./setup.ps1
   ```
   (creează 2 useri test + un chat, scrie tokenii în `config.json`)

---

## Secțiunea 5.2.1 — Latența WebSocket

### cap_01_k6_latency_console.png
Rulează:
```
cd perf
k6 run --out json=latency_results.json latency.js
```
Aștepți ~1 minut. La final k6 afișează tabelul cu metrici. **Captură întregul terminal** —
trebuie să se vadă liniile `e2e_latency_ms`, `msgs_received` și block-ul `✓ thresholds`.




## Secțiunea 5.2.2 — Timpii REST

### cap_03_k6_rest_console.png
```
cd perf
k6 run --out json=rest_results.json rest.js
```
**Captură tabelul final** cu cele 4 metrici (`rest_list_chats_ms`, `rest_list_messages_ms`,
`rest_get_me_ms`, `rest_login_ms`).





## Secțiunea 5.2.3 — Încărcarea inițială

### cap_05_lighthouse_dev.png
1. F12 → tab **Lighthouse**.
2. Bifează doar **Performance**, profil **Desktop**, mode **Navigation**.
3. Click **Analyze page load**.
4. **Captură scorul + cele 5 metrici** (LCP, FCP, TBT, CLS, SI).

### cap_06_lighthouse_prod.png
```
cd frontend
npm run build
npm run preview
```
Deschide `http://localhost:4173` și rulează Lighthouse din nou. **Captură**.



***

## Secțiunea 5.3.1 — Autentificare și autorizare

### cap_07_401_no_token.png
Pornește un Postman / Insomnia (sau în consolă Chrome `fetch('/api/chats')` fără header).
**Captură răspunsul 401 Unauthorized**.

### cap_08_403_other_chat.png
Loghează-te ca user A. Încearcă `GET /api/chats/<id_chat_al_lui_B>/messages`.
**Captură 403 Forbidden**.

### cap_09_bcrypt_hash.png
```
psql -U postgres -d chatapp -c "SELECT id, username, LEFT(password_hash, 30) AS hash_preview FROM users LIMIT 3;"
```
**Captură hash-uri** care încep cu `$2a$10$...` (bcrypt).

---

## Secțiunea 5.3.2 — Fișiere atașate

### cap_10_signed_url.png
Atașează o imagine într-un chat și inspectează request-ul din DevTools.
**Captură URL-ul** cu parametrul `X-Goog-Expires=900` și `X-Goog-Signature=...`.

### cap_11_url_expirat.png
Copiază URL-ul de mai sus, așteaptă 16 minute, deschide-l într-un tab privat.
**Captură eroarea XML** `<Error><Code>ExpiredToken</Code>...</Error>`.

### cap_12_bucket_privat.png
Google Cloud Console → Storage → bucketul tău → tab **Permissions**.
**Captură secțiunea "Public access"** unde scrie "Not public".

---

## Secțiunea 5.4 — Scalabilitate

### cap_13_k6_scalability_console.png
```
cd perf
k6 run --out json=scalability_results.json scalability.js
```
Durează ~2 minute. **Captură tabelul final** cu `scal_latency_ms` și `http_req_failed`.

### cap_14_explain_seq_scan.png
```
psql -U postgres -d chatapp -c "EXPLAIN ANALYZE SELECT * FROM messages WHERE content ILIKE '%test%';"
```
**Captură rezultatul** care arată `Seq Scan on messages` (fără index → confirmă afirmația).

### Grafic
`perf/figures/fig_scalability.png` după ce rulezi `python plots.py` din folderul `perf/`.
Curba arată evoluția p50/p95 pe măsură ce numărul de VUs crește (10 → 200).

---

