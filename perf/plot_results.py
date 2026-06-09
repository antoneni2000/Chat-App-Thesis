# -*- coding: utf-8 -*-
"""
Genereaza graficele pentru testul de latenta end-to-end (latency.js).
Citeste rularile k6 NDJSON din runs/, exclude warmup-ul (run01) si produce:
  - figures/histogram.png : histograma latentei cumulate (10 rulari), cu medie/p95/p99
  - figures/summary.png   : bar chart cu statistici per rulare + grupul CUMULAT
"""

import json
import os
import glob
import numpy as np
import matplotlib.pyplot as plt

# ---------------------------------------------------------------------------
# Parametri configurabili
# ---------------------------------------------------------------------------
FOLDER_RUNS = "runs"               # folderul cu rulari de latenta (NDJSON k6)
FOLDER_FIGURES = "figures"         # folder de iesire pentru grafice
WARMUP_RUNS = 1                    # cate rulari de la inceput se exclud
METRIC_NAME = "e2e_latency_ms"     # numele metricii k6 urmarite
HIST_BINS = 40                     # numarul de bin-uri pentru histograma


# ---------------------------------------------------------------------------
# Citire NDJSON k6
# ---------------------------------------------------------------------------
def citeste_run(cale_fisier):
    """Returneaza lista de valori (float) pentru METRIC_NAME dintr-un NDJSON."""
    valori = []
    with open(cale_fisier, "r", encoding="utf-8") as f:
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
            if obj.get("metric") != METRIC_NAME:
                continue
            v = obj.get("data", {}).get("value")
            if v is not None:
                valori.append(float(v))
    return valori


def incarca_toate_rularile():
    """Returneaza (nume_rulari, lista_de_liste_valori) sortate dupa nume fisier."""
    pattern = os.path.join(FOLDER_RUNS, "run*.json")
    fisiere = sorted(glob.glob(pattern))
    if not fisiere:
        raise FileNotFoundError(f"Nu s-au gasit fisiere: {pattern}")
    nume = [os.path.splitext(os.path.basename(f))[0] for f in fisiere]
    valori = [citeste_run(f) for f in fisiere]
    return nume, valori


# ---------------------------------------------------------------------------
# Statistici
# ---------------------------------------------------------------------------
def statistici(valori):
    """Returneaza dict cu min, mean, p50, p95, p99, max pe un array."""
    arr = np.asarray(valori, dtype=float)
    return {
        "min": float(np.min(arr)),
        "mean": float(np.mean(arr)),
        "p50": float(np.percentile(arr, 50)),
        "p90": float(np.percentile(arr, 90)),
        "p95": float(np.percentile(arr, 95)),
        "p99": float(np.percentile(arr, 99)),
        "max": float(np.max(arr)),
    }


# ---------------------------------------------------------------------------
# Figura 1: histograma latentei cumulate
# ---------------------------------------------------------------------------
def figura_histograma(valori_cumulate, stat, cale_iesire, n_rulari):
    fig, ax = plt.subplots(figsize=(12, 7))
    ax.hist(valori_cumulate, bins=HIST_BINS, color="#4C9AFF",
            edgecolor="black", alpha=0.85)

    # linii verticale: medie / p95 / p99
    ax.axvline(stat["mean"], color="green", linestyle="--",
               label=f"medie={stat['mean']:.1f} ms")
    ax.axvline(stat["p95"], color="orange", linestyle="--",
               label=f"p95={stat['p95']:.1f} ms")
    ax.axvline(stat["p99"], color="red", linestyle="--",
               label=f"p99={stat['p99']:.1f} ms")

    ax.set_xlabel("Latenta (ms)")
    ax.set_ylabel("Frecventa")
    ax.set_title(f"Distributia latentei end-to-end "
                 f"(n={len(valori_cumulate)} mesaje, {n_rulari} rulari)")
    ax.legend()
    ax.grid(axis="y", alpha=0.3)

    fig.tight_layout()
    fig.savefig(cale_iesire, dpi=150)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Figura 2: bar chart cu statistici per rulare + CUMULAT
# ---------------------------------------------------------------------------
def figura_summary(nume_rulari, stats_per_rulare, stat_cumulat, cale_iesire):
    chei = ["min", "mean", "p50", "p95", "p99", "max"]
    etichete = ["min", "mean", "p50", "p95", "p99", "max"]
    culori = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"]

    # grupuri pe axa X: cate o rulare + un grup "CUMULAT" la final
    grupuri = nume_rulari + ["CUMULAT"]
    n_grupuri = len(grupuri)
    n_chei = len(chei)
    latime = 0.8 / n_chei
    x = np.arange(n_grupuri)

    fig, ax = plt.subplots(figsize=(15, 7))

    for i, (cheie, eticheta, culoare) in enumerate(zip(chei, etichete, culori)):
        valori = [s[cheie] for s in stats_per_rulare] + [stat_cumulat[cheie]]
        offset = (i - (n_chei - 1) / 2) * latime
        ax.bar(x + offset, valori, latime, label=eticheta, color=culoare)

    # linie punctata care separa rularile de grupul cumulat
    ax.axvline(n_grupuri - 1.5, color="gray", linestyle=":", linewidth=1)

    ax.set_xticks(x)
    ax.set_xticklabels(grupuri, rotation=45, ha="right")
    ax.set_xlabel("Rulare")
    ax.set_ylabel("Latenta (ms)")
    ax.set_title("Latenta end-to-end pe rulare + set cumulat")
    legenda = ax.legend(title="Statistici", bbox_to_anchor=(1.02, 1),
                        loc="upper left")
    ax.grid(axis="y", alpha=0.3)

    # casuta cu statistici pe setul cumulat, fixata SUB legenda
    text_stat = (
        "Statistici pe set cumulat\n"
        f"  min   = {stat_cumulat['min']:.2f} ms\n"
        f"  medie = {stat_cumulat['mean']:.2f} ms\n"
        f"  p50   = {stat_cumulat['p50']:.2f} ms\n"
        f"  p95   = {stat_cumulat['p95']:.2f} ms\n"
        f"  p99   = {stat_cumulat['p99']:.2f} ms\n"
        f"  max   = {stat_cumulat['max']:.2f} ms"
    )
    # fortam render-ul ca sa stim unde se termina legenda, apoi plasam dedesubt
    fig.canvas.draw()
    bbox_leg = legenda.get_window_extent().transformed(ax.transAxes.inverted())
    ax.text(1.02, bbox_leg.y0 - 0.03, text_stat, transform=ax.transAxes,
            fontsize=9, family="monospace", va="top",
            bbox=dict(boxstyle="round", facecolor="white", edgecolor="gray"))

    fig.tight_layout(rect=[0, 0, 0.83, 1])
    fig.savefig(cale_iesire, dpi=150)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    nume, rulari = incarca_toate_rularile()
    print(f"Fisiere gasite: {len(nume)} ({', '.join(nume)})")

    # excludem warmup-ul
    nume_pastrate = nume[WARMUP_RUNS:]
    rulari_pastrate = rulari[WARMUP_RUNS:]
    print(f"Exclus warmup: primele {WARMUP_RUNS} rulari. "
          f"Analizate: {len(rulari_pastrate)}")

    # statistici per rulare
    stats_per_rulare = [statistici(v) for v in rulari_pastrate if v]

    # cumulat pe valorile brute (NU media percentilelor)
    cumulat = []
    for v in rulari_pastrate:
        cumulat.extend(v)
    stat_cumulat = statistici(cumulat)

    # afisare consola - statistici pe setul cumulat
    print(f"\n=== Statistici pe set cumulat ({len(cumulat)} mesaje) ===")
    ordine = ["min", "mean", "p50", "p90", "p95", "p99", "max"]
    for k in ordine:
        print(f"  {k:<5s} = {stat_cumulat[k]:.2f} ms")

    # reproductibilitate: pentru fiecare indicator (p50, p95, p99) calculez
    # valoarea pe fiecare rulare, apoi media +- abaterea standard intre rulari
    rulari_nevide = [v for v in rulari_pastrate if v]
    indicatori = [("Mediana (p50)", 50), ("p95", 95), ("p99", 99)]
    print(f"\n=== Reproductibilitate intre cele {len(rulari_nevide)} rulari ===")
    print(f"  {'Indicator':<15s}  Medie ± abatere standard (ms)")
    for nume_ind, perc in indicatori:
        valori = np.asarray([float(np.percentile(v, perc)) for v in rulari_nevide])
        m = float(np.mean(valori))
        s = float(np.std(valori, ddof=1)) if valori.size > 1 else 0.0
        print(f"  {nume_ind:<15s}  {m:.1f} ± {s:.1f}")

    # grafice
    os.makedirs(FOLDER_FIGURES, exist_ok=True)
    cale_hist = os.path.join(FOLDER_FIGURES, "histogram.png")
    cale_sum = os.path.join(FOLDER_FIGURES, "summary.png")

    figura_histograma(cumulat, stat_cumulat, cale_hist, len(rulari_pastrate))
    figura_summary(nume_pastrate, stats_per_rulare, stat_cumulat, cale_sum)

    print(f"\nGrafice salvate:")
    print(f"  - {cale_hist}")
    print(f"  - {cale_sum}")


if __name__ == "__main__":
    main()
