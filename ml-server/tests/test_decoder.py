"""
Unit tests qps_decoder + alfatihah. Tidak butuh GPU/model — murni algoritmik.
"""
from app.ml import alfatihah as af
from app.ml.qps_decoder import _align_sequences, _classify_category, decode_to_errors


# ── Wagner-Fischer alignment ─────────────────────────────────────────────────
def test_align_identical_all_match():
    seq = ["b", "a", "s"]
    ops = _align_sequences(seq, seq)
    assert [o[0] for o in ops] == ["match", "match", "match"]


def test_align_substitution():
    ops = _align_sequences(["b", "a", "s"], ["b", "i", "s"])
    kinds = [o[0] for o in ops]
    assert kinds == ["match", "substitute", "match"]
    sub = next(o for o in ops if o[0] == "substitute")
    assert sub[1] == 1 and sub[2] == 1  # pred_idx, target_idx


def test_align_deletion():
    # target lebih panjang → 1 delete
    ops = _align_sequences(["b", "s"], ["b", "a", "s"])
    kinds = [o[0] for o in ops]
    assert kinds.count("delete") == 1
    dele = next(o for o in ops if o[0] == "delete")
    assert dele[1] is None and dele[2] == 1


def test_align_insertion():
    # pred lebih panjang → 1 insert
    ops = _align_sequences(["b", "x", "s"], ["b", "s"])
    kinds = [o[0] for o in ops]
    assert kinds.count("insert") == 1


# ── Classification ───────────────────────────────────────────────────────────
def test_classify_vowel_substitution_is_harakat():
    assert _classify_category("substitute", "a", "i") == "harakat"


def test_classify_length_substitution_is_panjang_pendek():
    # vokal dasar sama (a vs aa), beda panjang → mad
    assert _classify_category("substitute", "a", "aa") == "panjang_pendek"


def test_classify_consonant_substitution_is_huruf():
    assert _classify_category("substitute", "s", "S") == "huruf"


def test_classify_gemination_substitution_is_syaddah():
    # base consonant sama, beda gemination → syaddah
    assert _classify_category("substitute", "l", "lː") == "syaddah"


def test_classify_delete_long_vowel_is_panjang_pendek():
    assert _classify_category("delete", None, "aa") == "panjang_pendek"


def test_classify_delete_consonant_is_huruf():
    assert _classify_category("delete", None, "m") == "huruf"


def test_classify_insert_vowel_is_harakat():
    assert _classify_category("insert", "i", None) == "harakat"


# ── alfatihah reference + index map ──────────────────────────────────────────
def test_words_split_count():
    # 7 ayat ada, kata_idx 0-based
    assert len(af.ALFATIHAH_WORDS[1]) == 4  # بسم الله الرحمن الرحيم
    assert all(len(words) >= 1 for words in af.ALFATIHAH_WORDS.values())


def test_phonemes_per_word_populated():
    for ayat, entries in af.ALFATIHAH_PHONEMES_PER_WORD.items():
        assert len(entries) == len(af.ALFATIHAH_WORDS[ayat])
        for kata_idx, toks in entries:
            assert isinstance(toks, list) and len(toks) > 0


def test_build_target_sequence_alignment():
    phonemes, owners = af.build_target_sequence()
    assert len(phonemes) == len(owners) > 0
    # owner pertama = (ayat 1, kata 0)
    assert owners[0] == (1, 0)
    # semua owner valid
    for ayat, kata_idx in owners:
        assert 1 <= ayat <= 7
        assert 0 <= kata_idx < len(af.ALFATIHAH_WORDS[ayat])


# ── decode_to_errors end-to-end (heuristik) ──────────────────────────────────
def test_decode_perfect_reading_no_errors():
    target, _ = af.build_target_sequence()
    errors = decode_to_errors(predicted_phonemes=list(target))
    total = sum(len(v) for v in errors.values())
    assert total == 0


def test_decode_returns_contract_keys():
    errors = decode_to_errors(predicted_phonemes=["b", "a"])
    assert set(errors.keys()) == {
        "errors_harakat", "errors_huruf", "errors_panjang_pendek", "errors_syaddah",
    }


def test_decode_error_has_word_position():
    target, _ = af.build_target_sequence()
    # rusak 1 phoneme di tengah → minimal 1 error dengan posisi valid
    broken = list(target)
    broken[3] = "zzz"
    errors = decode_to_errors(predicted_phonemes=broken)
    items = [e for v in errors.values() for e in v]
    assert len(items) >= 1
    for e in items:
        assert 1 <= e.ayat <= 7
        assert e.kata_idx >= 0
        assert e.severity in ("major", "minor")
