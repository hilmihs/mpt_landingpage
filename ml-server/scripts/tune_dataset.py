"""
Setel cara menghitung temuan agar sedekat mungkin dengan hitungan Ustadzah.

Tidak menyentuh model. Yang disetel adalah cara keluaran model DIBACA — semua
dari berkas hasil eval_dataset.py, tanpa GPU.

DUA HAL YANG MEMBUAT ANGKA MENTAH TIDAK SEBANDING

1. Satuannya beda. Mesin menghitung ketidakcocokan per KARAKTER; Ustadzah
   menghitung kesalahan yang ia dengar. Satu huruf yang salah dibaca bisa
   memunculkan tiga ketidakcocokan berturut-turut — hurufnya, harakatnya, lalu
   madnya.

2. Tidak semua rekaman adalah Al-Fatihah yang utuh. Ada yang membaca surah
   lain, ada yang berhenti di tengah, ada yang terlalu cepat sampai model tidak
   menangkap apa pun. Pada rekaman seperti itu jumlah ketidakcocokan meledak
   dan menyeret seluruh statistik, padahal Ustadzah menilainya dengan skala
   yang sama seperti rekaman lain.

CARA PAKAI
    python scripts/tune_dataset.py hasil_dataset.jsonl
"""
from __future__ import annotations

import argparse
import json
import statistics as st
from collections import defaultdict


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


def kalibrasi(mesin: list[float], guru: list[float]) -> tuple[float, float]:
    """Garis kuadrat-terkecil mesin -> guru, supaya satuannya sebanding."""
    n = len(mesin)
    mm, mg = sum(mesin) / n, sum(guru) / n
    var = sum((x - mm) ** 2 for x in mesin)
    if var == 0:
        return 0.0, mg
    b = sum((x - mm) * (y - mg) for x, y in zip(mesin, guru)) / var
    return b, mg - b * mm


def nilai(nama: str, mesin: list[float], guru: list[float]) -> dict:
    b, a = kalibrasi(mesin, guru)
    ramal = [b * x + a for x in mesin]
    galat = [abs(p - g) for p, g in zip(ramal, guru)]
    n = len(guru)
    return {
        "nama": nama,
        "n": n,
        "pearson": pearson(guru, mesin),
        "spearman": spearman(guru, mesin),
        "mae": sum(galat) / n,
        "dalam2": sum(1 for g in galat if g <= 2) / n,
        "dalam3": sum(1 for g in galat if g <= 3) / n,
    }


# ── varian cara menghitung ───────────────────────────────────────────────────
def hitung_mentah(b: dict) -> float:
    """Setiap ketidakcocokan karakter dihitung satu."""
    return len(b["findings"])


def hitung_per_kata(b: dict) -> float:
    """Satu kata bermasalah = satu kesalahan, seberapa pun fonem yang meleset."""
    return len({(t["ayat"], t["kata_idx"]) for t in b["findings"]})


def hitung_per_kata_kategori(b: dict) -> float:
    """Satu kata boleh menyumbang beberapa kesalahan kalau jenisnya berbeda."""
    return len({(t["ayat"], t["kata_idx"], t.get("kategori")) for t in b["findings"]})


def hitung_batas_kata(b: dict, batas: int = 2) -> float:
    """Batasi sumbangan tiap kata — satu kata rusak tidak menenggelamkan sisanya."""
    per: dict[tuple[int, int], int] = defaultdict(int)
    for t in b["findings"]:
        per[(t["ayat"], t["kata_idx"])] += 1
    return sum(min(v, batas) for v in per.values())


def kata_kategori(b: dict, kategori: set[str]) -> float:
    """Hitung kata bermasalah, tapi hanya dari kategori tertentu."""
    return len({
        (t["ayat"], t["kata_idx"]) for t in b["findings"]
        if (t.get("kategori") or "") in kategori
    })


import math

VARIAN = {
    "mentah (per karakter)": hitung_mentah,
    "per kata": hitung_per_kata,
    "per kata + kategori": hitung_per_kata_kategori,
    "batas 2 per kata": lambda b: hitung_batas_kata(b, 2),
    "batas 3 per kata": lambda b: hitung_batas_kata(b, 3),
    # Kalibrasi linear tidak bisa menangkap hubungan yang melengkung; akar
    # dan log menguji apakah hubungannya memang tidak lurus.
    "akar(per kata)": lambda b: math.sqrt(hitung_per_kata(b)),
    "log(per kata)": lambda b: math.log1p(hitung_per_kata(b)),
    # Sebagian kategori mungkin lebih banyak derau daripada sinyal. Diuji satu
    # per satu, bukan diasumsikan.
    "per kata: huruf saja": lambda b: kata_kategori(b, {"ketepatan_huruf"}),
    "per kata: tanpa harakat": lambda b: kata_kategori(
        b, {"ketepatan_huruf", "panjang_pendek", "tasydid", "hukum_tajwid"}),
    "per kata: huruf+tasydid": lambda b: kata_kategori(b, {"ketepatan_huruf", "tasydid"}),
}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("hasil")
    ap.add_argument("--target-len", type=int, default=256, help="panjang fonem Al-Fatihah")
    args = ap.parse_args()

    baris = []
    with open(args.hasil, encoding="utf8") as f:
        for l in f:
            l = l.strip()
            if l:
                try:
                    d = json.loads(l)
                    if "findings" in d:
                        baris.append(d)
                except Exception:  # noqa: BLE001
                    pass

    print(f"{len(baris)} rekaman berhasil diproses\n")

    # Seberapa banyak rekaman yang jelas BUKAN Al-Fatihah utuh. Dipisah, bukan
    # dibuang diam-diam — jumlahnya sendiri adalah temuan.
    def rasio_panjang(b: dict) -> float:
        return len(b.get("pred") or "") / args.target_len

    meragukan = [b for b in baris if rasio_panjang(b) < 0.6 or rasio_panjang(b) > 1.6]
    wajar = [b for b in baris if b not in meragukan]
    print(f"panjang bacaan wajar (0,6-1,6x target) : {len(wajar)}")
    print(f"menyimpang jauh (bukan Al-Fatihah utuh): {len(meragukan)}")
    if meragukan:
        r = [rasio_panjang(b) for b in meragukan]
        print(f"  rasio panjangnya: min {min(r):.2f}x · maks {max(r):.2f}x")

    for judul, data in (("SEMUA REKAMAN", baris), ("HANYA YANG PANJANGNYA WAJAR", wajar)):
        if not data:
            continue
        guru = [float(b["gt_jaliy"]) for b in data]
        print(f"\n=== {judul} (n={len(data)}) ===")
        print(f"{'varian':<24}{'Pearson':>9}{'Spearman':>10}{'MAE':>8}{'±2':>7}{'±3':>7}")
        hasil = [nilai(nama, [float(f(b)) for b in data], guru) for nama, f in VARIAN.items()]
        for h in sorted(hasil, key=lambda x: x["mae"]):
            print(
                f"{h['nama']:<24}{h['pearson']:>9.3f}{h['spearman']:>10.3f}"
                f"{h['mae']:>8.2f}{h['dalam2']:>7.0%}{h['dalam3']:>7.0%}"
            )

    guru_semua = [b["gt_jaliy"] for b in baris]
    print(f"\nsebagai pembanding: menebak median ({st.median(guru_semua):.0f}) untuk semua")
    med = st.median(guru_semua)
    galat = [abs(med - g) for g in guru_semua]
    print(
        f"  MAE {sum(galat)/len(galat):.2f} · "
        f"±2 {sum(1 for g in galat if g <= 2)/len(galat):.0%} · "
        f"±3 {sum(1 for g in galat if g <= 3)/len(galat):.0%}"
    )


if __name__ == "__main__":
    main()
