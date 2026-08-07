"""
Unit test decoder. Tidak butuh GPU maupun model — murni algoritmik.

Sebagian tes butuh `quran_transcript` (pustaka resmi penulis model) untuk
menyusun target Al-Fatihah. Kalau paket itu belum terpasang, tes tersebut
dilewati, bukan dianggap lulus.
"""
import pytest

from app.ml.qps_decoder import align_semi_global, klasifikasi, ratakan_mad

try:
    from app.ml import alfatihah as af

    af.build_target()
    ADA_QT = True
except Exception:  # noqa: BLE001
    ADA_QT = False

butuh_qt = pytest.mark.skipif(not ADA_QT, reason="quran_transcript belum terpasang")


# ── Alignment semi-global ────────────────────────────────────────────────────
def test_identik_semua_cocok():
    ops = align_semi_global("بِسمِ", "بِسمِ")
    assert [o[0] for o in ops] == ["match"] * 5


def test_substitusi_di_tengah():
    ops = align_semi_global("صِرَاطَ", "سِرَاطَ")
    jenis = [o[0] for o in ops]
    assert jenis.count("substitute") == 1
    assert jenis.count("match") == 6


def test_prefiks_pembaca_tidak_dihukum():
    """Isti'adzah sebelum surah harus gratis, bukan puluhan kesalahan."""
    target = "بِسمِ"
    pred = "ءَعُۥۥذُبِللَاه" + target
    ops = align_semi_global(target, pred)
    assert all(o[0] == "match" for o in ops), [o[0] for o in ops]


def test_sufiks_pembaca_tidak_dihukum():
    """'aamiin' sesudah surah juga gratis."""
    target = "بِسمِ"
    ops = align_semi_global(target, target + "ءَاامِۦۦن")
    assert all(o[0] == "match" for o in ops)


def test_prefiks_dan_sufiks_sekaligus():
    target = "بِسمِ"
    ops = align_semi_global(target, "ءَعُۥۥذُ" + target + "ءَاامِۦۦن")
    assert all(o[0] == "match" for o in ops)


def test_huruf_hilang_terdeteksi():
    ops = align_semi_global("بِسمِ", "بِمِ")
    assert "delete" in [o[0] for o in ops]


# ── Perataan panjang mad ────────────────────────────────────────────────────
def test_mad_berulang_diratakan():
    teks, _ = ratakan_mad("ررَحِۦۦۦۦم", None)
    assert teks == "ررَحِۦم"


def test_perataan_tidak_menghapus_mad():
    """Yang diratakan derajat panjangnya, bukan keberadaannya."""
    teks, _ = ratakan_mad("بَاا", None)
    assert "ا" in teks


def test_huruf_ganda_bukan_mad_tidak_diratakan():
    """ررَ menandai tasydid, bukan mad — jangan disentuh."""
    teks, _ = ratakan_mad("ررَحمَاان", None)
    assert teks.startswith("ررَ")


def test_pemilik_ikut_dipangkas():
    teks, pemilik = ratakan_mad("بَاا", (1, 1, 1, 1))
    assert len(teks) == len(pemilik) == 3


def test_beda_panjang_mad_bukan_kesalahan():
    """Pembaca 4 harakat dan 5 harakat sama-sama benar."""
    a, _ = ratakan_mad("حِۦۦۦۦم", None)
    b, _ = ratakan_mad("حِۦۦم", None)
    assert a == b


def test_mad_dipendekkan_tetap_terdeteksi():
    """Tapi memendekkan sampai hilang tetap kesalahan."""
    a, _ = ratakan_mad("حِۦۦۦۦم", None)
    b, _ = ratakan_mad("حِم", None)
    assert a != b


# ── Klasifikasi lima indikator ──────────────────────────────────────────────
def test_huruf_tertukar():
    # ص dibaca س — kesalahan huruf paling khas di Al-Fatihah
    assert klasifikasi("substitute", "س", "ص", "صِرَاطَ", 0) == "ketepatan_huruf"


def test_harakat_tertukar():
    assert klasifikasi("substitute", "ُ", "َ", "بَ", 1) == "harakat"


def test_mad_hilang():
    assert klasifikasi("delete", None, "ا", "بَا", 2) == "panjang_pendek"


def test_harakat_jadi_mad_dihitung_panjang_pendek():
    assert klasifikasi("substitute", "ا", "َ", "بَ", 1) == "panjang_pendek"


def test_dengung_tertukar_adalah_hukum_tajwid():
    # ن dibaca م pada أنعمت — izhar dijadikan idgham
    assert klasifikasi("substitute", "م", "ن", "ءَنعَمتَ", 2) == "hukum_tajwid"


def test_huruf_berulang_adalah_tasydid():
    # Pada skema ini tasydid ditulis sebagai huruf ganda: ررَ
    assert klasifikasi("delete", None, "ر", "ررَ", 1) == "tasydid"


def test_dengung_berharakat_bukan_hukum_tajwid():
    # nun yang jelas berharakat dan tertukar jadi huruf lain = salah huruf
    assert klasifikasi("substitute", "ب", "ن", "نَ", 0) == "ketepatan_huruf"


# ── Target resmi ────────────────────────────────────────────────────────────
@butuh_qt
def test_target_sepadan_dengan_pemiliknya():
    fonem, pemilik, sifat = af.build_target()
    assert len(fonem) == len(pemilik) > 0
    assert {a for a, _ in pemilik} == set(range(1, 8)), "ketujuh ayat harus terwakili"
    assert len(sifat) > 0


# ── Posisi kata ─────────────────────────────────────────────────────────────
@butuh_qt
def test_jumlah_kata_per_ayat():
    """
    Harus tetap sama dengan WORDS_PER_AYAT di lib/ai-eval/segments.ts. Kalau
    salah satu berubah sendirian, kata_idx dari mesin menunjuk kata yang berbeda
    tanpa error apa pun.
    """
    assert [len(af.kata(a)) for a in range(1, 8)] == [4, 4, 2, 3, 4, 3, 9]


@butuh_qt
def test_kata_idx_selalu_dalam_jangkauan():
    _, pemilik, _ = af.build_target()
    for ayat, kata_idx in pemilik:
        assert 0 <= kata_idx < len(af.kata(ayat)), f"ayat {ayat} kata {kata_idx}"


@butuh_qt
def test_setiap_kata_punya_fonem():
    """Tidak boleh ada kata yang tidak terwakili — itu berarti pemetaan bolong."""
    _, pemilik, _ = af.build_target()
    for ayat in range(1, 8):
        terlihat = {k for a, k in pemilik if a == ayat}
        assert terlihat == set(range(len(af.kata(ayat)))), f"ayat {ayat}: {terlihat}"


@butuh_qt
def test_kata_terakhir_ayat_7_memetakan_benar():
    """Titik uji paling rawan: kata terpanjang, penuh tasydid dan mad."""
    fonem, pemilik, _ = af.build_target()
    idx = [i for i, (a, k) in enumerate(pemilik) if a == 7 and k == 8]
    potongan = fonem[idx[0] : idx[-1] + 1]
    assert potongan.startswith("ضض"), potongan
    assert potongan.endswith("ن"), potongan


@butuh_qt
def test_temuan_membawa_posisi_kata():
    from app.ml.qps_decoder import decode_to_errors

    fonem, _, _ = af.build_target()
    rusak = fonem.replace("ص", "س", 1)  # ص dibaca س — kesalahan paling khas
    errors = decode_to_errors(predicted_phonemes=rusak)
    items = [e for v in errors.values() for e in v]
    assert items
    for e in items:
        assert 1 <= e.ayat <= 7
        assert 0 <= e.kata_idx < len(af.kata(e.ayat))
        # expected berisi teks kata utuh, bukan satu karakter
        assert e.expected in af.kata(e.ayat)


@butuh_qt
def test_target_memakai_huruf_arab_bukan_latin():
    """
    Penjaga terhadap kekeliruan yang pernah terjadi: target sempat dibangun
    dari transliterasi latin, sementara model mengeluarkan huruf Arab.
    """
    fonem, _, _ = af.build_target()
    assert not any("a" <= c <= "z" for c in fonem), "target tidak boleh mengandung latin"
    assert "ب" in fonem and "ِ" in fonem


@butuh_qt
def test_bacaan_sempurna_tanpa_temuan():
    from app.ml.qps_decoder import decode_to_errors

    fonem, _, _ = af.build_target()
    errors = decode_to_errors(predicted_phonemes=fonem)
    assert sum(len(v) for v in errors.values()) == 0


@butuh_qt
def test_kunci_kontrak_lima_indikator():
    from app.ml.qps_decoder import decode_to_errors

    errors = decode_to_errors(predicted_phonemes="بِسمِ")
    assert set(errors) == {
        "errors_harakat",
        "errors_ketepatan_huruf",
        "errors_panjang_pendek",
        "errors_tasydid",
        "errors_hukum_tajwid",
    }
