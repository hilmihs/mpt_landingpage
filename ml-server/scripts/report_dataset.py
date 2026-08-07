"""
Laporan dari keluaran eval_dataset.py. Tidak butuh GPU maupun model.

Semua yang perlu dijawab tentang akurasi mesin dihitung dari sini: korelasi
dengan penilaian Ustadzah, sebaran temuan per indikator, dan seberapa banyak
temuan yang mendarat di kata yang dinamai katalog.

CARA PAKAI
    python scripts/report_dataset.py hasil_dataset.jsonl
"""
from __future__ import annotations

import argparse
import json
import statistics as st
from collections import Counter


def pearson(a: list[float], b: list[float]) -> float:
    n = len(a)
    if n < 2:
        return 0.0
    ma, mb = sum(a) / n, sum(b) / n
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    da = sum((x - ma) ** 2 for x in a) ** 0.5
    db = sum((y - mb) ** 2 for y in b) ** 0.5
    return num / (da * db) if da and db else 0.0


def spearman(a: list[float], b: list[float]) -> float:
    def rank(v: list[float]) -> list[float]:
        urut = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        for pos, i in enumerate(urut):
            r[i] = pos
        return r

    return pearson(rank(a), rank(b))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("hasil")
    args = ap.parse_args()

    baris = []
    with open(args.hasil, encoding="utf8") as f:
        for l in f:
            l = l.strip()
            if l:
                try:
                    baris.append(json.loads(l))
                except Exception:  # noqa: BLE001
                    pass

    ok = [b for b in baris if "findings" in b]
    err = [b for b in baris if "error" in b]
    print(f"{len(baris)} rekaman · berhasil {len(ok)} · gagal {len(err)}")
    if err:
        for tipe, n in Counter(b["error"].split(":")[0] for b in err).most_common(5):
            print(f"    {tipe}: {n}")
    if not ok:
        return

    gt = [b["gt_jaliy"] for b in ok]
    ai = [len(b["findings"]) for b in ok]

    print("\n=== JUMLAH TEMUAN vs PENILAIAN USTADZAH ===")
    print(f"  Ustadzah : median {st.median(gt)} · rata-rata {sum(gt)/len(gt):.2f} · maks {max(gt)}")
    print(f"  mesin    : median {st.median(ai)} · rata-rata {sum(ai)/len(ai):.2f} · maks {max(ai)}")
    print(f"  Pearson  {pearson(gt, ai):.3f} · Spearman {spearman(gt, ai):.3f}")

    bersih = [n for n, g in zip(ai, gt) if g == 0]
    if bersih:
        print(f"  lantai derau (Ustadzah menilai 0 jaliy): median {st.median(bersih):.1f}")

    print("\n=== MEDIAN TEMUAN MESIN PER KELOMPOK USTADZAH ===")
    for lo, hi in ((0, 0), (1, 2), (3, 5), (6, 10), (11, 15), (16, 99)):
        g = [n for n, x in zip(ai, gt) if lo <= x <= hi]
        if g:
            print(f"  jaliy {lo:>2}-{hi:<2} (n={len(g):>3}) : median {st.median(g):>5.1f}")

    print("\n=== TEMUAN PER INDIKATOR (rata-rata/rekaman) ===")
    kat: Counter[str] = Counter()
    for b in ok:
        for t in b["findings"]:
            kat[t.get("kategori") or "?"] += 1
    total = sum(kat.values()) or 1
    # Proporsi opsi jaliy di katalog pengajar, untuk pembanding.
    KATALOG = {
        "ketepatan_huruf": 53, "panjang_pendek": 19,
        "tasydid": 17, "harakat": 9, "hukum_tajwid": 2,
    }
    for k, v in kat.most_common():
        print(f"  {k:<18}{v/len(ok):>6.2f}  {v*100//total:>3}%   katalog {KATALOG.get(k, 0)}%")

    print("\n=== KATA PALING SERING BERMASALAH ===")
    kata: Counter[str] = Counter()
    for b in ok:
        for t in b["findings"]:
            kata[f"ayat {t['ayat']} kata {t['kata_idx']} {t.get('expected','')}"] += 1
    for nama, v in kata.most_common(10):
        print(f"  {v/len(ok):>5.2f}/rekaman  {nama}")

    ada_sifa = sum(1 for b in ok if b.get("sifa"))
    print(f"\nrekaman dengan keluaran sifat tersimpan: {ada_sifa}/{len(ok)}")
    print("(bahan lahn khafiy — pemetaan labelnya belum dibuat)")


if __name__ == "__main__":
    main()
