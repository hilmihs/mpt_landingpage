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


# Jenis mad yang panjangnya TETAP — menyimpang darinya adalah kesalahan.
# Mad lain (mis. Aared) panjangnya pilihan qiraah: `madd_aared_len` boleh 2, 4,
# atau 6 dan ketiganya sah, jadi selisih di sana bukan kesalahan.
_MAD_TETAP = ("NormalMaddRule", "LazemMaddRule")


def _aturan_mad(mp) -> tuple[int, bool] | None:
    """(panjang_seharusnya, tetap) untuk satu entri mappings. None kalau bukan mad."""
    for rule in mp.tajweed_rules or ():
        golden = getattr(rule, "golden_len", None)
        if golden is None:
            continue
        return int(golden), type(rule).__name__ in _MAD_TETAP
    return None


@lru_cache(maxsize=1)
def build_target() -> tuple[
    str,
    tuple[tuple[int, int], ...],
    tuple[tuple[int, object], ...],
    tuple[tuple[int, bool] | None, ...],
]:
    """
    Susun target Al-Fatihah sekali, lalu simpan di memori.

    Returns:
        (fonem, pemilik, sifat, mad)
        - fonem   : satu untai karakter tanpa spasi, sama bentuknya dengan
                    keluaran model.
        - pemilik : (nomor_ayat, kata_idx) untuk TIAP karakter di `fonem`,
                    panjangnya sama. Inilah yang membuat kesalahan bisa
                    ditunjukkan ke katanya, bukan cuma ke ayatnya.
        - sifat   : (nomor_ayat, SifaOutput) per unit fonem. Perhatikan satu unit
                    sifat mencakup beberapa karakter (mis. 'بِ'), jadi jumlahnya
                    TIDAK sama dengan panjang `fonem`.
        - mad     : (panjang_seharusnya, tetap) per karakter `fonem`, atau None
                    kalau posisi itu bukan mad. Panjang dihitung dalam harakat,
                    dan pada skema ini satu harakat = satu pengulangan karakter.
                    `tetap=False` berarti panjangnya pilihan qiraah yang sah,
                    jadi jangan dihukum.

    POSISI KATA datang dari `mappings` milik quran_phonetizer, bukan dihitung
    sendiri. Tiap entri mappings sepadan satu karakter teks Uthmani dan menunjuk
    rentang fonem yang dihasilkannya, jadi indeks kata bisa ditarik lewat sana.
    Diverifikasi: kata terakhir ayat 7 (ٱلضَّآلِّينَ) memetakan tepat ke
    'ضضَااااااللِۦۦۦۦن'.

    `kata_idx` 0-based dan mengikuti pemisahan spasi teks Uthmani — harus tetap
    sama dengan WORDS_PER_AYAT di lib/ai-eval/segments.ts.
    """
    import quran_transcript as qt

    moshaf = _moshaf()
    fonem: list[str] = []
    pemilik: list[tuple[int, int]] = []
    sifat: list[tuple[int, object]] = []
    mad: list[tuple[int, bool] | None] = []

    for ayat in range(1, JUMLAH_AYAT + 1):
        uthmani = qt.Aya(SURAH_ALFATIHAH, ayat).get().uthmani
        keluaran = qt.quran_phonetizer(uthmani, moshaf, remove_spaces=True)

        # Karakter Uthmani ke-i milik kata ke berapa. Spasi tidak dimiliki
        # kata mana pun.
        kata_dari_char: list[int | None] = []
        k = 0
        for ch in uthmani:
            if ch.isspace():
                kata_dari_char.append(None)
                k += 1
            else:
                kata_dari_char.append(k)

        # Balik arahnya: fonem ke-j milik kata mana, dan tunduk aturan mad apa.
        kata_dari_fonem: list[int] = [0] * len(keluaran.phonemes)
        mad_dari_fonem: list[tuple[int, bool] | None] = [None] * len(keluaran.phonemes)
        for i, mp in enumerate(keluaran.mappings):
            if mp.deleted or i >= len(kata_dari_char):
                continue
            kata = kata_dari_char[i]
            if kata is None:
                continue
            awal, akhir = mp.pos
            aturan = _aturan_mad(mp)
            for j in range(awal, min(akhir, len(kata_dari_fonem))):
                kata_dari_fonem[j] = kata
                if aturan is not None:
                    mad_dari_fonem[j] = aturan

        fonem.extend(keluaran.phonemes)
        pemilik.extend((ayat, kata_dari_fonem[j]) for j in range(len(keluaran.phonemes)))
        sifat.extend((ayat, unit) for unit in keluaran.sifat)
        mad.extend(mad_dari_fonem)

    return "".join(fonem), tuple(pemilik), tuple(sifat), tuple(mad)


def uthmani(ayat: int) -> str:
    """Teks Uthmani satu ayat, untuk ditampilkan ke manusia."""
    import quran_transcript as qt

    return qt.Aya(SURAH_ALFATIHAH, ayat).get().uthmani


def kata(ayat: int) -> list[str]:
    """Kata-kata satu ayat, dipisah spasi, 0-based — sama dengan sisi frontend."""
    return uthmani(ayat).split()
