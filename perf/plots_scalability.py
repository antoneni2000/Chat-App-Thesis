# -*- coding: utf-8 -*-
"""
Grafic de scalabilitate pentru testul scalability.js (k6).
Citeste un singur NDJSON (scalability_results.json), coreleaza fiecare punct
de latenta cu numarul de VUs activi la acel moment (din gauge-ul `vus`),
grupeaza pe niveluri de sarcina si plotteaza p50/p95/p99 vs VUs.
"""

import json
import os
import bisect
from datetime import datetime
import numpy as np
import matplotlib.pyplot as plt

# ---------------------------------------------------------------------------
# Parametri configurabili
# ---------------------------------------------------------------------------
FISIER_INPUT = "scalability_results.json"   # NDJSON output k6
FOLDER_FIGURES = "figures"                  # folder de iesire grafice
NUME_FIGURA = "fig_scalability.png"         # numele figurii
METRIC_LATENTA = "scal_latency_ms"          # numele metricii de latenta
METRIC_VUS = "vus"                          # numele gauge-ului VUs
METRIC_FAILED = "http_req_failed"           # rata erorilor http
PRAG_MS = 500                               # pragul afisat pe grafic
# Nivelurile de sarcina: lista de (limita_inferioara_exclusa, limita_superioara_inclusa, eticheta)
NIVELURI_VUS = [
    (0, 10, 10),
    (10, 50, 50),
    (50, 100, 100),
    (100, 200, 200),
]
DPI_IESIRE = 130


# ---------------------------------------------------------------------------
# Parsare timestamp ISO 8601 cu fractiuni variabile
# ---------------------------------------------------------------------------
def parse_ts(s):
    """Parseaza timestamp ISO 8601 (cu fractiuni si offset) -> timestamp float (s).
    Normalizam fractiunile la 6 zecimale, pentru ca datetime accepta exact 6."""
    if s is None:
        return None
    s = s.strip()
    # separam fractiunile (daca exista) de offset-ul de zona orara
    if "." in s:
        baza, rest = s.split(".", 1)
        # rest = "FFFFFFZ" sau "FFFFFF+03:00" sau doar "FFFFFF"
        for sep in ("Z", "+", "-"):
            # cautam separatorul de zona dupa fractiuni
            idx = rest.find(sep, 1) if sep != "Z" else rest.find("Z")
            if idx != -1:
                frac = rest[:idx]
                tz = rest[idx:]
                break
        else:
            frac = rest
            tz = ""
        # normalizam la 6 zecimale
        frac = (frac + "000000")[:6]
        s = f"{baza}.{frac}{tz}"
    # Python >= 3.11 accepta 'Z' direct; pentru compatibilitate il convertim
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s).timestamp()


# ---------------------------------------------------------------------------
# Citire NDJSON
# ---------------------------------------------------------------------------
def citeste_ndjson(cale):
    """Returneaza:
      - latente: lista de (timestamp, valoare_ms)
      - vus:     lista de (timestamp, n_vus) sortata
      - http_failed: lista de valori (0/1) pentru rata erorilor
    """
    latente = []
    vus = []
    http_failed = []
    with open(cale, "r", encoding="utf-8") as f:
        for linie in f:
            linie = linie.strip()
            if not linie:
                continue
            try:
                obj = json.loads(linie)
            except json.JSONDecodeError:
                continue
            if obj.get("type") != "Point":
                continue
            metric = obj.get("metric")
            data = obj.get("data", {})
            v = data.get("value")
            t = data.get("time")
            if v is None:
                continue
            if metric == METRIC_LATENTA:
                ts = parse_ts(t)
                if ts is not None:
                    latente.append((ts, float(v)))
            elif metric == METRIC_VUS:
                ts = parse_ts(t)
                if ts is not None:
                    vus.append((ts, float(v)))
            elif metric == METRIC_FAILED:
                http_failed.append(float(v))
    # sortam VUs dupa timp (pentru bisect)
    vus.sort(key=lambda x: x[0])
    return latente, vus, http_failed


# ---------------------------------------------------------------------------
# Corelare latenta <-> VUs (cea mai recenta valoare a gauge-ului)
# ---------------------------------------------------------------------------
def asociaza_vus(latente, vus):
    """Pentru fiecare (ts, lat), gaseste ultima valoare VUs cu timestamp <= ts.
    Returneaza lista (vus_la_acel_moment, latenta)."""
    timpi_vus = [v[0] for v in vus]
    rezultat = []
    for ts, lat in latente:
        idx = bisect.bisect_right(timpi_vus, ts) - 1
        if idx < 0:
            # nicio masuratoare VUs anterioara - ignoram punctul
            continue
        rezultat.append((vus[idx][1], lat))
    return rezultat


# ---------------------------------------------------------------------------
# Grupare pe niveluri de sarcina
# ---------------------------------------------------------------------------
def grupeaza_pe_niveluri(perechi):
    """Returneaza dict {eticheta_VUs: [valori_latenta]} pentru intervalele
    definite in NIVELURI_VUS (limita inferioara exclusa, superioara inclusa)."""
    grupuri = {et: [] for (_, _, et) in NIVELURI_VUS}
    for nvus, lat in perechi:
        for lo, hi, et in NIVELURI_VUS:
            if lo < nvus <= hi:
                grupuri[et].append(lat)
                break
    return grupuri


# ---------------------------------------------------------------------------
# Statistici si grafic
# ---------------------------------------------------------------------------
def calc_percentile(grupuri):
    """Returneaza dict {eticheta: dict(n,p50,p95,p99)}."""
    stat = {}
    for et, valori in grupuri.items():
        if not valori:
            stat[et] = {"n": 0, "p50": float("nan"),
                        "p95": float("nan"), "p99": float("nan")}
            continue
        arr = np.asarray(valori, dtype=float)
        stat[et] = {
            "n": arr.size,
            "p50": float(np.percentile(arr, 50)),
            "p95": float(np.percentile(arr, 95)),
            "p99": float(np.percentile(arr, 99)),
        }
    return stat


def deseneaza(stat, cale_iesire):
    """Line chart p50/p95/p99 vs VUs, cu prag orizontal la PRAG_MS."""
    etichete = [et for (_, _, et) in NIVELURI_VUS]
    x = np.array(etichete, dtype=float)

    p50 = np.array([stat[et]["p50"] for et in etichete])
    p95 = np.array([stat[et]["p95"] for et in etichete])
    p99 = np.array([stat[et]["p99"] for et in etichete])

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(x, p50, marker="o", linewidth=2, color="#0747A6", label="p50")
    ax.plot(x, p95, marker="s", linewidth=2, color="#FFAB00", label="p95")
    ax.plot(x, p99, marker="^", linewidth=2, color="#DE350B", label="p99")

    # pragul de 500 ms
    ax.axhline(PRAG_MS, color="red", linestyle=":", linewidth=1.5,
               label=f"prag ({PRAG_MS} ms)")

    # etichete numerice pe puncte
    for xi, y in zip(x, p50):
        if not np.isnan(y):
            ax.text(xi, y, f" {y:.0f}", fontsize=9, color="#0747A6",
                    va="bottom", ha="left")
    for xi, y in zip(x, p95):
        if not np.isnan(y):
            ax.text(xi, y, f" {y:.0f}", fontsize=9, color="#B36B00",
                    va="bottom", ha="left")
    for xi, y in zip(x, p99):
        if not np.isnan(y):
            ax.text(xi, y, f" {y:.0f}", fontsize=9, color="#A12B00",
                    va="bottom", ha="left")

    ax.set_xticks(x)
    ax.set_xlabel("Utilizatori concurenti (VUs)")
    ax.set_ylabel("Timp de raspuns (ms)")
    ax.set_title("Scalabilitate: timpul de raspuns GET /api/chats "
                 "in functie de sarcina")
    ax.grid(True, alpha=0.3)
    ax.legend()

    fig.tight_layout()
    fig.savefig(cale_iesire, dpi=DPI_IESIRE)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print(f"Citesc {FISIER_INPUT}...")
    latente, vus, http_failed = citeste_ndjson(FISIER_INPUT)
    print(f"  puncte latenta: {len(latente)}")
    print(f"  puncte VUs:     {len(vus)}")
    print(f"  puncte http_req_failed: {len(http_failed)}")

    if not latente or not vus:
        raise RuntimeError("Lipsesc puncte de latenta sau VUs in NDJSON.")

    perechi = asociaza_vus(latente, vus)
    grupuri = grupeaza_pe_niveluri(perechi)
    stat = calc_percentile(grupuri)

    # afisare in consola
    print("\n=== Statistici pe niveluri de sarcina ===")
    print(f"  {'VUs':>5s}  {'n':>6s}  {'p50':>8s}  {'p95':>8s}  {'p99':>8s}")
    for (_, _, et) in NIVELURI_VUS:
        s = stat[et]
        if s["n"] == 0:
            print(f"  {et:>5d}  {0:>6d}  {'-':>8s}  {'-':>8s}  {'-':>8s}")
        else:
            print(f"  {et:>5d}  {s['n']:>6d}  "
                  f"{s['p50']:>7.1f}ms  {s['p95']:>7.1f}ms  {s['p99']:>7.1f}ms")

    # rata erorilor globala
    if http_failed:
        rata = float(np.mean(http_failed)) * 100.0
        print(f"\nRata erorilor (http_req_failed): {rata:.2f}% "
              f"({int(np.sum(http_failed))} / {len(http_failed)})")
    else:
        print("\nNu s-au gasit puncte http_req_failed in NDJSON.")

    # grafic
    os.makedirs(FOLDER_FIGURES, exist_ok=True)
    cale = os.path.join(FOLDER_FIGURES, NUME_FIGURA)
    deseneaza(stat, cale)
    print(f"\nGrafic salvat: {cale}")


if __name__ == "__main__":
    main()
