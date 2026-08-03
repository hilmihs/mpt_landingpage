"""
Decode output Mu'alim → ErrorItem[] per 4 indikator Lahn Jaliy.

⚠️ KOMPONEN RISET — paling sulit di project ini. Phase 1 = heuristik. ⚠️

Requirement KRITIS: setiap error HARUS punya posisi (ayat, kata_idx). Maka
alignment harus word-aware → kita align predicted vs target GLOBAL Al-Fatihah,
lalu lookup posisi target ke index map (ayat, kata_idx) dari alfatihah.py.

Approach Phase 1 (MVP):
1. Target = concat phoneme seluruh Al-Fatihah + owners[(ayat,kata_idx)]
   (alfatihah.build_target_sequence()).
2. Align predicted vs target via Wagner-Fischer (edit distance + backtrace).
3. Tiap mismatch op (substitute/insert/delete) → posisi (ayat, kata_idx)
   dari target terdekat.
4. Classify kategori: vokal→harakat, panjang vokal→panjang_pendek,
   consonant→huruf, gemination→syaddah (lihat _classify_category).
5. Severity MVP: substitute & delete = major, insert = minor.
6. expected = teks Arab kata; actual = best-effort. Kalau rekonstruksi teks Arab
   dari phoneme tidak feasible di MVP, actual = expected + jelaskan di note.

Phase 2 (post-MVP): pakai sifa attributes untuk deteksi granular, severity
classifier, tuning dengan ground truth Ustadzah.
"""
from __future__ import annotations

import logging

from app.ml import alfatihah as af
from app.schemas import ErrorItem

log = logging.getLogger(__name__)

_CATEGORY_KEY = {
    "harakat": "errors_harakat",
    "huruf": "errors_huruf",
    "panjang_pendek": "errors_panjang_pendek",
    "syaddah": "errors_syaddah",
}

_NOTE = {
    "harakat": "Harakat (vokal) tidak sesuai",
    "huruf": "Huruf/makhraj tidak sesuai",
    "panjang_pendek": "Panjang-pendek (mad) tidak sesuai",
    "syaddah": "Tasydid (syaddah) tidak sesuai",
}


def decode_to_errors(
    predicted_phonemes: list[str],
    predicted_sifa: list[dict] | None = None,
    predicted_timestamps: list[tuple[float, float]] | None = None,
) -> dict[str, list[ErrorItem]]:
    """
    Returns dict dengan keys PERSIS kontrak:
    errors_harakat, errors_huruf, errors_panjang_pendek, errors_syaddah.

    predicted_sifa / predicted_timestamps belum dipakai di Phase 1 (disediakan
    untuk refinement Phase 2).
    """
    out: dict[str, list[ErrorItem]] = {v: [] for v in _CATEGORY_KEY.values()}

    target, owners = af.build_target_sequence()
    if not target:
        log.warning("Target Al-Fatihah kosong — ALFATIHAH_PHONEMES_PER_WORD belum terisi")
        return out

    alignment = _align_sequences(predicted_phonemes, target)

    for op, pred_idx, target_idx in alignment:
        if op == "match":
            continue

        # posisi kata: dari target untuk substitute/delete; untuk insert pakai
        # target terdekat (target_idx menunjuk posisi sisip).
        ti = target_idx if target_idx < len(owners) else len(owners) - 1
        ayat, kata_idx = owners[max(0, ti)]

        pred_ph = predicted_phonemes[pred_idx] if pred_idx is not None else None
        target_ph = target[target_idx] if (op != "insert" and target_idx is not None) else None

        category = _classify_category(op, pred_ph, target_ph)
        severity = "minor" if op == "insert" else "major"

        expected = af.word_text(ayat, kata_idx)
        out[_CATEGORY_KEY[category]].append(
            ErrorItem(
                ayat=ayat,
                kata_idx=kata_idx,
                expected=expected,
                actual=expected,  # MVP: rekonstruksi teks Arab dari phoneme belum feasible
                severity=severity,
                note=_NOTE[category],
            )
        )

    return out


def _align_sequences(
    pred: list[str], target: list[str]
) -> list[tuple[str, int | None, int | None]]:
    """
    Wagner-Fischer edit distance + backtrace.
    Returns list of (op, pred_idx, target_idx):
      - "match"      → pred[pred_idx] == target[target_idx]
      - "substitute" → pred[pred_idx] != target[target_idx]
      - "delete"     → target[target_idx] ada, tak ada di pred (pred_idx=None)
      - "insert"     → pred[pred_idx] ekstra, tak ada di target (target_idx=insert pos)
    """
    n, m = len(pred), len(target)
    # dp[i][j] = edit distance pred[:i] vs target[:j]
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        dp[i][0] = i
    for j in range(1, m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if pred[i - 1] == target[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,        # insertion (pred punya ekstra)
                dp[i][j - 1] + 1,        # deletion  (target punya, pred tak baca)
                dp[i - 1][j - 1] + cost,  # match/substitute
            )

    # backtrace
    ops: list[tuple[str, int | None, int | None]] = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            cost = 0 if pred[i - 1] == target[j - 1] else 1
            if dp[i][j] == dp[i - 1][j - 1] + cost:
                ops.append(("match" if cost == 0 else "substitute", i - 1, j - 1))
                i, j = i - 1, j - 1
                continue
        if i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            ops.append(("insert", i - 1, j))  # target_idx = posisi sisip
            i -= 1
            continue
        # j > 0
        ops.append(("delete", None, j - 1))
        j -= 1

    ops.reverse()
    return ops


def _classify_category(op: str, pred_ph: str | None, target_ph: str | None) -> str:
    """Returns: 'harakat' | 'huruf' | 'panjang_pendek' | 'syaddah'."""
    if op == "substitute":
        p, t = pred_ph, target_ph
        assert p is not None and t is not None
        # vokal vs vokal
        if af.is_vowel(p) and af.is_vowel(t):
            # beda panjang, vokal dasar sama → mad
            same_family = af.vowel_family(p) == af.vowel_family(t)
            if same_family and (af.is_long_vowel(p) != af.is_long_vowel(t)):
                return "panjang_pendek"
            return "harakat"
        # gemination mismatch dengan base consonant sama → syaddah
        if af.base(p) == af.base(t) and (af.is_geminate(p) != af.is_geminate(t)):
            return "syaddah"
        return "huruf"

    ref = target_ph if op == "delete" else pred_ph
    if ref is None:
        return "huruf"
    if af.is_long_vowel(ref):
        return "panjang_pendek"
    if af.is_vowel(ref):
        return "harakat"
    if af.is_geminate(ref):
        return "syaddah"
    return "huruf"
