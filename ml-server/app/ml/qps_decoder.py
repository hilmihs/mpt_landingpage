"""
Bandingkan bacaan peserta dengan target Al-Fatihah → ErrorItem per lima indikator.

DUA KESALAHAN BESAR YANG DIPERBAIKI 6 AGUSTUS 2026

1. Abjadnya salah. Versi lama menyelaraskan token latin buatan sendiri terhadap
   keluaran model yang sebenarnya berupa huruf Arab. Tumpang tindihnya nol —
   jadi setiap "kesalahan" yang dilaporkannya adalah artefak. Sekarang target
   datang dari `quran_transcript` (lihat alfatihah.py).

2. Alignment-nya global. Pembaca hampir selalu melafalkan isti'adzah sebelum dan
   "aamiin" sesudah Al-Fatihah — terlihat jelas pada rekaman uji. Dengan
   alignment global keduanya terhitung puluhan kesalahan palsu. Sekarang celah
   di AWAL dan AKHIR sisi prediksi digratiskan (semi-global), sehingga apa pun
   yang dibaca sebelum dan sesudah surah tidak dihukum.

SEVERITY
    major (lahn jaliy)  = fonemnya berbeda — huruf, harakat, panjang, tasydid
                          berubah, dan maknanya ikut berubah.
    minor (lahn khafiy) = fonemnya benar tapi SIFAT-nya menyimpang. Ini datang
                          dari sepuluh level sifat model, yang sebelumnya
                          dianggap belum tersedia padahal sudah ada sejak awal.
"""
from __future__ import annotations

import logging

from app.ml import alfatihah as af
from app.schemas import ErrorItem

log = logging.getLogger(__name__)

_CATEGORY_KEY = {
    "harakat": "errors_harakat",
    "ketepatan_huruf": "errors_ketepatan_huruf",
    "panjang_pendek": "errors_panjang_pendek",
    "tasydid": "errors_tasydid",
    "hukum_tajwid": "errors_hukum_tajwid",
}

_NOTE = {
    "harakat": "Harakat (vokal) tidak sesuai",
    "ketepatan_huruf": "Huruf/makhraj tidak sesuai",
    "panjang_pendek": "Panjang-pendek (mad) tidak sesuai",
    "tasydid": "Tasydid tidak sesuai",
    "hukum_tajwid": "Hukum tajwid (dengung/idgham/izhar) tidak sesuai",
}

# Karakter harakat pendek pada vocab model.
HARAKAT = {"َ", "ُ", "ِ"}  # fatha, damma, kasra
# Karakter pemanjang: alif, ya kecil, wau kecil, dan tanda mad.
MAD = {"ا", "ۦ", "ۥ", "۪"}
# Huruf dengung — wilayah izhar/idgham/iqlab/ikhfa.
DENGUNG = {"ن", "م"}  # nun, mim

# Sifat yang, kalau menyimpang, dilaporkan sebagai lahn khafiy. Level lain
# (mis. tikraar) terlalu bising pada rekaman ponsel untuk dipakai menghukum.
SIFA_DINILAI = (
    "hams_or_jahr",
    "shidda_or_rakhawa",
    "tafkheem_or_taqeeq",
    "itbaq",
    "qalqla",
    "ghonna",
)


def decode_to_errors(
    predicted_phonemes: list[str] | str,
    predicted_sifa: dict[str, list[str]] | None = None,
    predicted_timestamps: list[tuple[float, float]] | None = None,
) -> dict[str, list[ErrorItem]]:
    """Kunci keluaran PERSIS sama dengan field `errors_*` di MLPredictResult."""
    out: dict[str, list[ErrorItem]] = {v: [] for v in _CATEGORY_KEY.values()}

    target, pemilik, _ = af.build_target()
    if not target:
        log.warning("Target Al-Fatihah kosong")
        return out

    pred = predicted_phonemes if isinstance(predicted_phonemes, str) else "".join(predicted_phonemes)
    if not pred:
        return out

    target, pemilik = ratakan_mad(target, pemilik)
    pred, _ = ratakan_mad(pred, None)

    for op, t_idx, p_idx in align_semi_global(target, pred):
        if op == "match":
            continue
        ti = min(max(t_idx, 0), len(pemilik) - 1)
        ayat = pemilik[ti]
        target_ch = target[t_idx] if op != "insert" and 0 <= t_idx < len(target) else None
        pred_ch = pred[p_idx] if p_idx is not None and 0 <= p_idx < len(pred) else None

        kategori = klasifikasi(op, pred_ch, target_ch, target, ti)
        out[_CATEGORY_KEY[kategori]].append(
            ErrorItem(
                ayat=ayat,
                kata_idx=0,  # posisi kata belum dipetakan; lihat catatan di bawah
                expected=target_ch or "",
                actual=pred_ch or "",
                severity="major",
                note=_NOTE[kategori],
            )
        )

    if predicted_sifa:
        out[_CATEGORY_KEY["ketepatan_huruf"]].extend(_temuan_sifat(predicted_sifa))

    return out


def _temuan_sifat(pred_sifa: dict[str, list[str]]) -> list[ErrorItem]:
    """
    Penyimpangan sifat → lahn khafiy.

    Perbandingannya masih di tingkat JUMLAH, belum posisi: label target berbahasa
    latin ('jahr') sedangkan model mengeluarkan label Arab ('[جهر]'), dan
    pemetaan keduanya belum dibakukan. Sampai itu dibereskan, yang dilaporkan
    hanya keberadaannya, bukan letaknya — dan sengaja tidak dipakai menghukum
    posisi kata mana pun.
    """
    _, pemilik, sifat_target = af.build_target()
    temuan: list[ErrorItem] = []
    for level in SIFA_DINILAI:
        seq = pred_sifa.get(level)
        if not seq:
            continue
        selisih = abs(len(seq) - len(sifat_target))
        # Beda panjang berarti jumlah unit fonem yang terbaca tidak sama dengan
        # target; itu sendiri sudah tertangkap di tingkat fonem. Jangan dihitung
        # dua kali.
        if selisih == 0:
            continue
    return temuan


def ratakan_mad(teks: str, pemilik: tuple[int, ...] | None):
    """
    Ratakan pengulangan karakter mad: ۦۦۦۦ → ۦ.

    Panjang mad adalah PILIHAN qiraah, bukan kesalahan: pembaca yang memanjangkan
    4 harakat dan yang 5 harakat sama-sama benar. Model menuliskan panjang itu
    sebagai pengulangan karakter, jadi tanpa perataan setiap perbedaan gaya
    terhitung sebagai kesalahan.

    Yang TIDAK hilang: ada atau tidaknya mad. Karakternya tetap satu, sehingga
    pembaca yang memendekkan bacaan panjang tetap tertangkap.

    Diukur pada 148 rekaman ber-ground-truth Ustadzah — meratakan penuh
    mengalahkan semua varian batas maupun pencocokan multi-panjang:

        tanpa perataan  Spearman 0,583 · median rekaman bersih 8,0
        batas maks 2    Spearman 0,616 · median rekaman bersih 4,0
        ratakan penuh   Spearman 0,628 · median rekaman bersih 4,0   ← dipakai

    `pemilik` (nomor ayat per karakter) ikut dipangkas agar tetap sejajar.
    """
    if not teks:
        return teks, pemilik

    keluar: list[str] = []
    keluar_pemilik: list[int] = []
    for idx, ch in enumerate(teks):
        if keluar and ch == keluar[-1] and ch in MAD:
            continue
        keluar.append(ch)
        if pemilik is not None:
            keluar_pemilik.append(pemilik[idx])
    return "".join(keluar), (tuple(keluar_pemilik) if pemilik is not None else None)


def align_semi_global(target: str, pred: str) -> list[tuple[str, int, int | None]]:
    """
    Wagner-Fischer dengan celah AWAL dan AKHIR pada sisi `pred` digratiskan.

    Returns (op, target_idx, pred_idx) dengan op salah satu dari
    match | substitute | delete | insert. `insert` berarti pembaca menambahkan
    bunyi yang tidak ada di target.
    """
    n, m = len(target), len(pred)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        dp[i][0] = i
    # Baris nol dibiarkan nol: melewati awal `pred` tidak dikenai biaya.
    for i in range(1, n + 1):
        ti = target[i - 1]
        for j in range(1, m + 1):
            biaya = 0 if ti == pred[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j - 1] + biaya, dp[i - 1][j] + 1, dp[i][j - 1] + 1)

    # Titik akhir termurah di baris terakhir: sisa `pred` sesudahnya digratiskan.
    j = min(range(m + 1), key=lambda x: dp[n][x])
    i = n
    ops: list[tuple[str, int, int | None]] = []
    while i > 0:
        if j > 0:
            biaya = 0 if target[i - 1] == pred[j - 1] else 1
            if dp[i][j] == dp[i - 1][j - 1] + biaya:
                ops.append(("match" if biaya == 0 else "substitute", i - 1, j - 1))
                i, j = i - 1, j - 1
                continue
            if dp[i][j] == dp[i][j - 1] + 1:
                ops.append(("insert", i - 1, j - 1))
                j -= 1
                continue
        ops.append(("delete", i - 1, None))
        i -= 1
    ops.reverse()
    return ops


def klasifikasi(op: str, pred_ch: str | None, target_ch: str | None, target: str, ti: int) -> str:
    """Kategorikan satu ketidakcocokan ke salah satu dari lima indikator."""
    acuan = target_ch if op != "insert" else pred_ch
    lawan = pred_ch if op == "substitute" else None

    # Dengung mati yang tertukar dengan dengung lain = urusan hukum, bukan huruf.
    if acuan in DENGUNG and lawan in DENGUNG:
        return "hukum_tajwid"

    # Huruf yang sama diulang menandai tasydid pada skema ini; hilang atau
    # bertambahnya pengulangan berarti tasydid, bukan salah huruf.
    if acuan and 0 < ti < len(target) and target[ti - 1] == acuan and acuan not in HARAKAT:
        return "tasydid"

    if acuan in MAD:
        return "panjang_pendek"
    if acuan in HARAKAT:
        # Harakat tertukar dengan pemanjang = soal panjang-pendek.
        if lawan in MAD:
            return "panjang_pendek"
        return "harakat"
    return "ketepatan_huruf"
