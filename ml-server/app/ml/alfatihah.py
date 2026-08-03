"""
Reference Al-Fatihah: teks Uthmani per ayat, segmentasi per kata, dan QPS
phoneme sequence per kata + index map global phoneme → (ayat, kata_idx).

KENAPA PER KATA: kontrak ErrorItem butuh (ayat, kata_idx) supaya frontend bisa
highlight kata yang salah di mushaf. Decoder harus tahu phoneme span mana milik
kata mana.

⚠️ STATUS PHONEME SCHEME — PHASE 1 HEURISTIK, BELUM TERVALIDASI ⚠️
`ALFATIHAH_PHONEMES_PER_WORD` di-generate oleh `text_to_qps_heuristic()`, sebuah
transliterator Arab→token sederhana (BUKAN QPS resmi paper Mu'alim). Tujuannya:
membuat pipeline decoder runnable + index map nyata untuk MVP.

TODO (sesi GPU): setelah tahu vocab QPS aktual model `obadx/muaalem-model-v3_2`
(cek output `mualim.predict`), GANTI skema token di sini supaya match vocab model.
Kalau repo Mu'alim punya utility text→QPS, pakai itu. Kalau tidak: anotasi manual
39 kata feasible. `kata_idx` HARUS konsisten dengan word splitting frontend
(split teks Uthmani by whitespace, 0-based).
"""
from __future__ import annotations

# ── Teks Uthmani per ayat ────────────────────────────────────────────────────
ALFATIHAH_TEXT_UTHMANI: dict[int, str] = {
    1: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
    2: "اَلْحَمْدُ لِلّٰهِ رَبِّ الْعَالَمِيْنَ",
    3: "اَلرَّحْمٰنِ الرَّحِيْمِ",
    4: "مٰلِكِ يَوْمِ الدِّيْنِۗ",
    5: "اِيَّاكَ نَعْبُدُ وَاِيَّاكَ نَسْتَعِيْنُۗ",
    6: "اِهْدِنَا الصِّرَاطَ الْمُسْتَقِيْمَۙ",
    7: "صِرَاطَ الَّذِيْنَ اَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوْبِ عَلَيْهِمْ وَلَا الضَّاۤلِّيْنَ",
}

# Kata per ayat — split by whitespace. 0-based, konsisten dengan frontend.
ALFATIHAH_WORDS: dict[int, list[str]] = {
    ayat: text.split() for ayat, text in ALFATIHAH_TEXT_UTHMANI.items()
}

# ── Token phoneme: kategori ──────────────────────────────────────────────────
# Skema token (placeholder, lihat warning di atas):
#   short vowels: a i u
#   long  vowels: aa ii uu          → indikator panjang_pendek
#   consonant geminate (shadda):    token diakhiri "ː", mis. "lː"  → indikator syaddah
SHORT_VOWELS = {"a", "i", "u"}
LONG_VOWELS = {"aa", "ii", "uu"}
_VOWEL_BASE = {"a": "a", "aa": "a", "i": "i", "ii": "i", "u": "u", "uu": "u"}


def is_geminate(tok: str) -> bool:
    return tok.endswith("ː")


def base(tok: str) -> str:
    return tok[:-1] if is_geminate(tok) else tok


def is_short_vowel(tok: str) -> bool:
    return base(tok) in SHORT_VOWELS


def is_long_vowel(tok: str) -> bool:
    return base(tok) in LONG_VOWELS


def is_vowel(tok: str) -> bool:
    return is_short_vowel(tok) or is_long_vowel(tok)


def vowel_family(tok: str) -> str | None:
    """a/aa→'a', i/ii→'i', u/uu→'u'. None kalau bukan vokal."""
    return _VOWEL_BASE.get(base(tok))


# ── Arab → token consonant ───────────────────────────────────────────────────
_CONSONANT = {
    "ء": "'", "ا": "'", "أ": "'", "إ": "'", "آ": "'", "ٱ": "'",
    "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "H", "خ": "kh",
    "د": "d", "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh",
    "ص": "S", "ض": "D", "ط": "T", "ظ": "Z", "ع": "3", "غ": "gh",
    "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n",
    "ه": "h", "و": "w", "ي": "y", "ى": "y",
}
# Harakat / tanda
_FATHA, _KASRA, _DAMMA = "َ", "ِ", "ُ"
_SUKUN, _SHADDA = "ْ", "ّ"
_DAGGER_ALIF = "ٰ"  # ٰ  → mad (aa)
_MADDA = "ۤ"         # ۤ
_SMALL_HIGH = {"ۖ", "ۗ", "ۘ", "ۙ", "ۚ", "ۛ", "ۜ"}
_HARAKAT = {_FATHA, _KASRA, _DAMMA, _SUKUN, _SHADDA, _DAGGER_ALIF, _MADDA}


def text_to_qps_heuristic(word: str) -> list[str]:
    """
    Transliterasi heuristik 1 kata Arab berharakat → list token phoneme.

    HEURISTIK (Phase 1, bukan QPS resmi):
    - consonant + harakat → [consonant, vowel]
    - shadda → consonant jadi geminate (token + "ː")
    - alif/wau/ya sebagai mad (huruf vokal panjang) → long vowel, bukan consonant
    - dagger alif ٰ → "aa"
    Lihat warning modul: ganti dengan vocab model saat tersedia.
    """
    chars = list(word)
    out: list[str] = []
    i = 0
    n = len(chars)
    while i < n:
        ch = chars[i]
        if ch in _HARAKAT or ch in _SMALL_HIGH or ch.isspace():
            i += 1
            continue
        cons = _CONSONANT.get(ch)
        if cons is None:
            i += 1
            continue

        # lookahead untuk shadda + harakat
        j = i + 1
        geminate = False
        vowel: str | None = None
        sukun = False
        while j < n and (chars[j] in _HARAKAT or chars[j] in _SMALL_HIGH):
            d = chars[j]
            if d == _SHADDA:
                geminate = True
            elif d == _FATHA:
                vowel = "a"
            elif d == _KASRA:
                vowel = "i"
            elif d == _DAMMA:
                vowel = "u"
            elif d == _SUKUN:
                sukun = True
            elif d == _DAGGER_ALIF:
                vowel = "aa"
            j += 1

        # huruf mad: alif/wau/ya yang jadi pemanjang vokal sebelumnya
        is_madd_letter = ch in ("ا", "و", "ي", "ى")
        prev_vowel = next((t for t in reversed(out) if is_vowel(t)), None)
        if is_madd_letter and sukun is False and vowel is None and prev_vowel is not None:
            fam = vowel_family(prev_vowel)
            if (ch == "ا" and fam == "a") or (ch == "و" and fam == "u") or (ch in ("ي", "ى") and fam == "i"):
                # ubah vokal pendek sebelumnya jadi panjang (mad thabi'i)
                for k in range(len(out) - 1, -1, -1):
                    if is_vowel(out[k]):
                        out[k] = {"a": "aa", "i": "ii", "u": "uu"}[fam]
                        break
                i = j
                continue

        cons_tok = cons + "ː" if geminate else cons
        out.append(cons_tok)
        if vowel is not None:
            out.append(vowel)
        i = j
    return out


# ── Build phonemes-per-word + global index map ───────────────────────────────
# Struktur: {ayat: [(kata_idx, [phoneme, ...]), ...]}
ALFATIHAH_PHONEMES_PER_WORD: dict[int, list[tuple[int, list[str]]]] = {
    ayat: [(idx, text_to_qps_heuristic(word)) for idx, word in enumerate(words)]
    for ayat, words in ALFATIHAH_WORDS.items()
}


def build_target_sequence() -> tuple[list[str], list[tuple[int, int]]]:
    """
    Concat semua phoneme target Al-Fatihah jadi 1 sequence + index map paralel.

    Returns:
        (phonemes, owners) dengan len sama; owners[i] = (ayat, kata_idx) pemilik
        phonemes[i]. Dipakai qps_decoder untuk map posisi error → kata.
    """
    phonemes: list[str] = []
    owners: list[tuple[int, int]] = []
    for ayat in sorted(ALFATIHAH_PHONEMES_PER_WORD):
        for kata_idx, toks in ALFATIHAH_PHONEMES_PER_WORD[ayat]:
            for t in toks:
                phonemes.append(t)
                owners.append((ayat, kata_idx))
    return phonemes, owners


def word_text(ayat: int, kata_idx: int) -> str:
    """Teks Arab kata pada (ayat, kata_idx). '' kalau out of range."""
    words = ALFATIHAH_WORDS.get(ayat, [])
    return words[kata_idx] if 0 <= kata_idx < len(words) else ""
