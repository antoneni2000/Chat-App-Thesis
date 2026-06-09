# -*- coding: utf-8 -*-
"""
Analiza rezultatelor k6 pentru testul REST.
Citeste NDJSON-urile din runs_rest/, exclude warmup-ul, cumuleaza valorile brute
pe metrica si calculeaza statistici + grafice.
"""

import json
import os
import glob
import numpy as np
import matplotlib.pyplot as plt

# ---------------------------------------------------------------------------
# Parametri configurabili
# ---------------------------------------------------------------------------
FOLDER_RUNS = "runs_rest"          # folder cu fisierele run*.json
FOLDER_FIGURES = "figures"         # folder de iesire pentru grafice
WARMUP_RUNS = 1                    # cate rulari de la inceput se exclud (run01)
PRAG_CITIRI_MS = 200               # pragul RNF02 pentru operatiile de citire
PRAG_LOGIN_MS = 1000               # pragul RNF02 pentru login (bcrypt)
LOGIN_BIN_MS = 10                  # latimea bin-ului histogramei de login (ms)
LOGIN_X_PADDING_MS = 200           # cat sa depaseasca axa X pragul (ms)

# Metricile urmarite (numele exact din output-ul k6)
METRICI_CITIRI = ["rest_get_me_ms", "rest_list_chats_ms", "rest_list_messages_ms"]
METRICA_LOGIN = "rest_login_ms"
TOATE_METRICILE = METRICI_CITIRI + [METRICA_LOGIN]

# Etichete prietenoase pentru afisare
ETICHETE = {
    "rest_get_me_ms": "GET /api/users/me",
    "rest_list_chats_ms": "GET /api/chats",
    "rest_list_messages_ms": "GET /api/chats/{id}/messages",
    "rest_login_ms": "POST /api/auth/login",
}


# ---------------------------------------------------------------------------
# Citire NDJSON k6
# ---------------------------------------------------------------------------
def citeste_run(cale_fisier):
    """Returneaza dict {metrica: [valori]} pentru un singur fisier k6 NDJSON."""
    valori = {m: [] for m in TOATE_METRICILE}
    with open(cale_fisier, "r", encoding="utf-8") as f:
        for linie in f:
            linie = linie.strip()
            if not linie:
                continue
            try:
                obj = json.loads(linie)
            except json.JSONDecodeError:
                # liniile non-JSON (eventuale headere/log) sunt ignorate
                continue
            # ne intereseaza doar punctele de masurare
            if obj.get("type") != "Point":
                continue
            metric = obj.get("metric")
            if metric in valori:
                v = obj.get("data", {}).get("value")
                if v is not None:
                    valori[metric].append(float(v))
    return valori


def incarca_toate_rularile():
    """Returneaza lista de dict-uri (cate unul per fisier), sortata dupa nume."""
    pattern = os.path.join(FOLDER_RUNS, "run*.json")
    fisiere = sorted(glob.glob(pattern))
    if not fisiere:
        raise FileNotFoundError(f"Nu s-au gasit fisiere care sa corespunda: {pattern}")
    return fisiere, [citeste_run(f) for f in fisiere]


# ---------------------------------------------------------------------------
# Statistici
# ---------------------------------------------------------------------------
def statistici(valori):
    """Returneaza dict cu statisticile cerute pe un array de valori."""
    arr = np.asarray(valori, dtype=float)
    return {
        "n": arr.size,
        "min": float(np.min(arr)),
        "p50": float(np.percentile(arr, 50)),
        "p90": float(np.percentile(arr, 90)),
        "p95": float(np.percentile(arr, 95)),
        "p99": float(np.percentile(arr, 99)),
        "max": float(np.max(arr)),
        "mean": float(np.mean(arr)),
    }


def afiseaza_statistici(titlu, stat):
    print(f"\n{titlu} (n={stat['n']}):")
    print(f"  min   = {stat['min']:.2f} ms")
    print(f"  p50   = {stat['p50']:.2f} ms")
    print(f"  p90   = {stat['p90']:.2f} ms")
    print(f"  p95   = {stat['p95']:.2f} ms")
    print(f"  p99   = {stat['p99']:.2f} ms")
    print(f"  max   = {stat['max']:.2f} ms")
    print(f"  mean  = {stat['mean']:.2f} ms")


# ---------------------------------------------------------------------------
# Grafice
# ---------------------------------------------------------------------------
def figura_citiri(cumulat, stats_cumulat, cale_iesire):
    """Box plot cu cele 3 operatii de citire (mediana, p25-p75, mustati, outlieri)
    + linia pragului RNF02 de 200 ms."""
    metrici = METRICI_CITIRI
    etichete = [ETICHETE[m] for m in metrici]
    date = [cumulat[m] for m in metrici]

    fig, ax = plt.subplots(figsize=(9, 6))

    bp = ax.boxplot(
        date,
        tick_labels=etichete,
        showmeans=True,                       # marcheaza si media (triunghi)
        meanprops=dict(marker="^", markerfacecolor="#FFAB00",
                       markeredgecolor="black", markersize=8),
        medianprops=dict(color="#0747A6", linewidth=2),
        boxprops=dict(facecolor="#DEEBFF", color="#0747A6"),
        whiskerprops=dict(color="#0747A6"),
        capprops=dict(color="#0747A6"),
        flierprops=dict(marker="o", markerfacecolor="gray",
                        markeredgecolor="none", markersize=3, alpha=0.5),
        patch_artist=True,
    )

    # adnotari cu p95 deasupra fiecarei cutii (informatia-cheie pentru SLA)
    for i, m in enumerate(metrici, start=1):
        p95 = stats_cumulat[m]["p95"]
        ax.text(i, p95, f"  p95={p95:.1f}", va="center", ha="left",
                fontsize=9, color="#B36B00")
        # mic semn la nivelul p95
        ax.plot([i - 0.25, i + 0.25], [p95, p95],
                color="#FFAB00", linewidth=1.5, linestyle=":")

    ax.set_ylabel("timp de raspuns (ms)")
    ax.set_title("Distributia timpilor de raspuns REST - operatii de citire "
                 "(10 rulari cumulate)")
    ax.grid(axis="y", alpha=0.3)

    # legenda manuala pentru a explica simbolurile
    from matplotlib.lines import Line2D
    from matplotlib.patches import Patch
    elemente_legenda = [
        Patch(facecolor="#DEEBFF", edgecolor="#0747A6", label="cutie p25-p75"),
        Line2D([0], [0], color="#0747A6", lw=2, label="mediana (p50)"),
        Line2D([0], [0], marker="^", color="w",
               markerfacecolor="#FFAB00", markeredgecolor="black",
               markersize=8, label="medie"),
        Line2D([0], [0], color="#FFAB00", lw=1.5, linestyle=":", label="p95"),
        Line2D([0], [0], marker="o", color="w", markerfacecolor="gray",
               markersize=5, label="outlieri"),
    ]
    ax.legend(handles=elemente_legenda, loc="upper left", fontsize=9)

    fig.tight_layout()
    fig.savefig(cale_iesire, dpi=150)
    plt.close(fig)


def figura_login(valori_login, stat_login, cale_iesire):
    """Histograma pentru rest_login_ms (bcrypt) pe valorile brute cumulate.
    Bin-uri de LOGIN_BIN_MS ms, marcaje verticale pentru p95 si pragul RNF02.
    Axa X se extinde dincolo de prag pentru a evidentia marja."""
    arr = np.asarray(valori_login, dtype=float)

    # bin-uri fixe de LOGIN_BIN_MS, de la 0 pana dincolo de prag
    limita_dreapta = max(arr.max(), PRAG_LOGIN_MS) + LOGIN_X_PADDING_MS
    bins = np.arange(0, limita_dreapta + LOGIN_BIN_MS, LOGIN_BIN_MS)

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.hist(arr, bins=bins, color="#36B37E", edgecolor="black", alpha=0.85)

    # linie verticala pentru mediana (p50)
    ax.axvline(stat_login["p50"], color="#0747A6", linestyle="-", linewidth=2,
               label=f"mediana = {stat_login['p50']:.1f} ms")
    # linie verticala pentru p95, cu eticheta valorii
    ax.axvline(stat_login["p95"], color="orange", linestyle="-", linewidth=2,
               label=f"p95 = {stat_login['p95']:.1f} ms")
    # linie verticala pentru pragul RNF02
    ax.axvline(PRAG_LOGIN_MS, color="red", linestyle="--", linewidth=2,
               label=f"prag RNF02 ({PRAG_LOGIN_MS} ms)")

    # axa X extinsa peste prag, ca sa se vada marja
    ax.set_xlim(left=0, right=limita_dreapta)

    ax.set_xlabel("timp de raspuns (ms)")
    ax.set_ylabel("numar de cereri")
    ax.set_title("Distributia timpilor de autentificare (bcrypt) - "
                 "set cumulat, 10 rulari")
    ax.legend()
    ax.grid(axis="y", alpha=0.3)

    fig.tight_layout()
    fig.savefig(cale_iesire, dpi=130)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Reproductibilitate (p95 per rulare)
# ---------------------------------------------------------------------------
def reproductibilitate(rulari_pastrate):
    """Pentru fiecare metrica, calc. media si stdev a p95-urilor intre rulari."""
    rezultat = {}
    for m in TOATE_METRICILE:
        p95_per_rulare = []
        for r in rulari_pastrate:
            if r[m]:
                p95_per_rulare.append(float(np.percentile(r[m], 95)))
        arr = np.asarray(p95_per_rulare)
        rezultat[m] = {
            "p95_runs": arr,
            "mean": float(np.mean(arr)) if arr.size else float("nan"),
            "std": float(np.std(arr, ddof=1)) if arr.size > 1 else 0.0,
        }
    return rezultat


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    fisiere, rulari = incarca_toate_rularile()
    print(f"Fisiere gasite: {len(fisiere)}")
    for f in fisiere:
        print(f"  - {f}")

    # Excludem warmup-ul (run01)
    rulari_pastrate = rulari[WARMUP_RUNS:]
    print(f"\nExclus warmup: primele {WARMUP_RUNS} rulari. "
          f"Ramane analizate: {len(rulari_pastrate)} rulari.")

    # Cumulam valorile brute pe metrica (concatenam din toate rularile pastrate)
    cumulat = {m: [] for m in TOATE_METRICILE}
    for r in rulari_pastrate:
        for m in TOATE_METRICILE:
            cumulat[m].extend(r[m])

    # Statistici pe setul cumulat
    stats_cumulat = {}
    print("\n=== Statistici pe setul cumulat (10 rulari) ===")
    for m in TOATE_METRICILE:
        if not cumulat[m]:
            print(f"\n{ETICHETE[m]}: NU exista valori!")
            continue
        stats_cumulat[m] = statistici(cumulat[m])
        afiseaza_statistici(ETICHETE[m], stats_cumulat[m])

    # Reproductibilitate (medie ± stdev a p95 per rulare)
    print("\n=== Reproductibilitate: p95 pe cele 10 rulari ===")
    repro = reproductibilitate(rulari_pastrate)
    for m in TOATE_METRICILE:
        r = repro[m]
        print(f"  {ETICHETE[m]:<20s}  p95 = {r['mean']:.2f} ± {r['std']:.2f} ms "
              f"(n_rulari={r['p95_runs'].size})")

    # Grafice
    os.makedirs(FOLDER_FIGURES, exist_ok=True)
    cale_citiri = os.path.join(FOLDER_FIGURES, "rest_read.png")
    cale_login = os.path.join(FOLDER_FIGURES, "rest_login.png")

    figura_citiri(cumulat, stats_cumulat, cale_citiri)
    figura_login(cumulat[METRICA_LOGIN], stats_cumulat[METRICA_LOGIN], cale_login)

    print(f"\nGrafice salvate:")
    print(f"  - {cale_citiri}")
    print(f"  - {cale_login}")


if __name__ == "__main__":
    main()
