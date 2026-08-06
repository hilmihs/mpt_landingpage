"""
Target fonetik Al-Fatihah — dihasilkan pustaka resmi, bukan ditebak.

RIWAYAT SINGKAT, SUPAYA TIDAK TERULANG
Versi sebelumnya membangun target sendiri lewat `text_to_qps_heuristic()`, sebuah
transliterator Arab→latin buatan sendiri (token `a i u aa ii uu b t th H kh …`
dengan sufiks `ː` untuk tasydid). Berkas itu sendiri menuliskan peringatan bahwa
skemanya belum tervalidasi.

Diverifikasi 6 Agustus 2026 di GPU: vocab asli model `obadx/muaalem-model-v3_2`
ternyata **huruf Arab itu sendiri** — ء ب ت ث … ي ا, ditambah harakat َ ُ ِ dan
tanda mad ۦ ۥ ۪. Tumpang tindih dengan skema latin lama: NOL. Selama ini
alignment membandingkan dua abjad yang berbeda, dan setiap angka yang keluar
darinya tidak berarti apa-apa.

Penulis model menyediakan pengubahnya sendiri: `quran_transcript.quran_phonetizer`
mengeluarkan skrip fonetik DAN sepuluh level sifat, persis sebelas level yang
diprediksi model. Dibuktikan cocok karakter-per-karakter dengan keluaran model
pada rekaman yang dinilai bersih oleh Ustadzah:

    target ayat 1 : بِسمِللَااهِررَحمَاانِررَحِۦۦۦۦم
    model         : بِسمِللَااهِررَحمَاانِررَحِۦۦۦۦم

Maka berkas ini tidak lagi mengarang apa pun; ia hanya memanggil pustaka itu dan
menyimpan hasilnya.
"""
from __future__ import annotations

from functools import lru_cache

# Panjang mad yang dipakai saat menyusun target. Ini pilihan qiraah, bukan
# konstanta teknis: peserta membaca murattal Hafs, dan mad 4 harakat adalah yang
# paling lazim diajarkan. Kalau pengajar memutuskan lain, ubah di sini — seluruh
# target ikut berubah dengan sendirinya.
MADD_LEN = 4

SURAH_ALFATIHAH = 1
JUMLAH_AYAT = 7

# Sepuluh level sifat yang diprediksi model, di luar level fonem. Nama-nama ini
# berasal dari config.json model dan dipakai apa adanya sebagai kunci.
SIFA_LEVELS: tuple[str, ...] = (
    "hams_or_jahr",
    "shidda_or_rakhawa",
    "tafkheem_or_taqeeq",
    "itbaq",
    "safeer",
    "qalqla",
    "tikraar",
    "tafashie",
    "istitala",
    "ghonna",
)


def _moshaf():
    import quran_transcript as qt

    return qt.MoshafAttributes(
        rewaya="hafs",
        madd_monfasel_len=MADD_LEN,
        madd_mottasel_len=MADD_LEN,
        madd_mottasel_waqf=MADD_LEN,
        madd_aared_len=MADD_LEN,
    )


@lru_cache(maxsize=1)
def build_target() -> tuple[str, tuple[int, ...], tuple[tuple[int, object], ...]]:
    """
    Susun target Al-Fatihah sekali, lalu simpan di memori.

    Returns:
        (fonem, pemilik, sifat)
        - fonem   : satu untai karakter tanpa spasi, sama bentuknya dengan
                    keluaran model.
        - pemilik : nomor ayat untuk TIAP karakter di `fonem`, panjangnya sama.
                    Dipakai memetakan kesalahan kembali ke ayatnya.
        - sifat   : (nomor_ayat, SifaOutput) per unit fonem. Perhatikan satu unit
                    sifat mencakup beberapa karakter (mis. 'بِ'), jadi jumlahnya
                    TIDAK sama dengan panjang `fonem`.
    """
    import quran_transcript as qt

    moshaf = _moshaf()
    fonem: list[str] = []
    pemilik: list[int] = []
    sifat: list[tuple[int, object]] = []

    for ayat in range(1, JUMLAH_AYAT + 1):
        uthmani = qt.Aya(SURAH_ALFATIHAH, ayat).get().uthmani
        keluaran = qt.quran_phonetizer(uthmani, moshaf, remove_spaces=True)
        for ch in keluaran.phonemes:
            fonem.append(ch)
            pemilik.append(ayat)
        for unit in keluaran.sifat:
            sifat.append((ayat, unit))

    return "".join(fonem), tuple(pemilik), tuple(sifat)


def uthmani(ayat: int) -> str:
    """Teks Uthmani satu ayat, untuk ditampilkan ke manusia."""
    import quran_transcript as qt

    return qt.Aya(SURAH_ALFATIHAH, ayat).get().uthmani


def kata(ayat: int) -> list[str]:
    """Kata-kata satu ayat, dipisah spasi, 0-based — sama dengan sisi frontend."""
    return uthmani(ayat).split()
