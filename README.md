# Folder `perf/` — Teste de performanta (capitolul 5)

Acest folder contine toate testele de performanta pentru aplicatia de chat,
plus scripturile de generare a graficelor pentru lucrarea de licenta.

---

## Structura folderului

### Scripturi de setup (PowerShell)

| Fisier | Rol |
|--------|-----|
| `setup.ps1`   | Pregateste mediul: creeaza 2 useri test + un chat intre ei. Scrie tokenii in `config.json`. Se ruleaza o singura data inainte de teste. |
| `run-all.ps1` | Orchestrator: ruleaza pe rand cele 3 teste k6 si salveaza rezultatele JSON. |

### Scripturi de testare (k6, JavaScript)

| Fisier | Ce masoara | Prag |
|--------|------------|------|
| `latency.js`     | Latenta end-to-end WebSocket (round-trip mesaj userA -> userB) | RNF01: p95 < 100 ms |
| `rest.js`        | Timpii pe 4 endpoint-uri REST: list_chats, list_messages, get_me, login | RNF02: p95 < 200 ms (non-bcrypt) |
| `scalability.js` | Degradarea latentei cu cresterea numarului de useri concurenti (10 → 200) | p95 < 500 ms, erori < 1% |

### Generatoare de grafice (Python)

| Fisier | Input | Output |
|--------|-------|--------|
| `plots.py`                | `*_results.json` (NDJSON brut, milioane de puncte) | 3 PNG-uri: histograma latenta, bar chart REST, linie scalabilitate |

### Configurare

| Fisier | Continut |
|--------|----------|
| `config.json` | Generat de `setup.ps1`. Contine tokenA, tokenB, userIdA, userIdB, chatId, wsUrl. Citit de toate scripturile k6. |

### Documentatie

| Fisier | Rol |
|--------|-----|
| `README.md`        | Acest fisier — vedere de ansamblu peste folder |
| `GHID_CAPTURI.md`  | Ghid pas-cu-pas pentru capturile de ecran din capitolul 5 |

---

## Fisierele JSON cu rezultate (explicate aici fiindca JSON nu suporta comentarii)

### `latency_results.json` / `rest_results.json` / `scalability_results.json`

**Format:** NDJSON line-delimited (cate un obiect JSON per linie, NU un array).
**Generate de:** `k6 run --out json=<nume>_results.json <script>.js`

Fiecare linie este un eveniment de tipul:
```json
{"type": "Point", "metric": "e2e_latency_ms", "data": {"value": 23.5, "time": "..."}}
```

Tipuri de inregistrari intalnite:
- `Metric` — declaratia unei metrici (apare o data la inceput)
- `Point`  — o masuratoare individuala (apar milioane)

**Atentie:** NU adauga comentarii sau campuri custom in aceste fisiere — ar
strica parser-ul din `plots.py`. Daca vrei sa documentezi rezultatele, fa-o
intr-un `.md` separat.

### `latency_summary.json` / `rest_summary.json` / `scalability_summary.json`

**Format:** JSON standard (un singur obiect cu agregate).
**Generate de:** `k6 run --summary-export <nume>_summary.json ...`

Contin structura:
```json
{
  "metrics": {
    "e2e_latency_ms": {
      "min": 12, "max": 87, "med": 22, "avg": 24.3,
      "p(90)": 35, "p(95)": 42, "p(99)": 60
    },
    "msgs_received": { "count": 500 }
  }
}
```

### `results.json`

Un summary mai vechi, salvat in trecut. Folosit de `plots_from_summary.py` si
`plots_distribution.py`. Acelasi format ca `latency_summary.json`.

---

## Ordinea corecta de rulare

```powershell
# 1. Porneste backend + Postgres
cd backend
./mvnw spring-boot:run

# 2. (intr-un alt terminal) Pregateste mediul
cd perf
./setup.ps1

# 3. Ruleaza testele (pe rand sau toate odata)
./run-all.ps1
# sau separat:
k6 run --out json=latency_results.json latency.js
k6 run --out json=rest_results.json rest.js
k6 run --out json=scalability_results.json scalability.js

# 4. Genereaza graficele
python plots.py

# 5. Vezi graficele in:
# perf/figures/*.png
```

---

## Troubleshooting rapid

| Eroare | Cauza | Solutie |
|--------|-------|---------|
| `401 Unauthorized` la teste | Tokenii din `config.json` au expirat | Ruleaza din nou `./setup.ps1` |
| `Connection refused` | Backend nu ruleaza | Porneste backend-ul pe :8081 |
| `ModuleNotFoundError: matplotlib` | Pachete Python lipsa | `pip install matplotlib numpy scipy` |
| `[skip] *_results.json lipseste` la plots.py | Nu ai rulat testele k6 inainte | Ruleaza intai `run-all.ps1` |
| k6 nu e recunoscut | k6 nu e instalat | `winget install k6 --source winget` |
