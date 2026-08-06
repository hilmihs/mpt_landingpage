import type { SegmentKey } from "@/lib/teacher-eval/types";

/**
 * Peta posisi kata → segmen penilaian.
 *
 * Mesin melaporkan kesalahan pada koordinat (ayat, kata_idx); pengajar menilai
 * dalam delapan segmen. Berkas ini satu-satunya tempat kedua sistem koordinat
 * itu bertemu.
 */

/**
 * Jumlah kata per ayat, hasil split teks Uthmani by whitespace, 0-based.
 *
 * Harus tetap sama dengan `ALFATIHAH_WORDS` di
 * `ml-server/app/ml/alfatihah.py` — kalau salah satu berubah sendirian,
 * `kata_idx` dari mesin akan menunjuk kata yang berbeda tanpa error apa pun.
 */
export const WORDS_PER_AYAT: Record<number, number> = {
  1: 4, // بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
  2: 4, // اَلْحَمْدُ لِلّٰهِ رَبِّ الْعَالَمِيْنَ
  3: 2, // اَلرَّحْمٰنِ الرَّحِيْمِ
  4: 3, // مٰلِكِ يَوْمِ الدِّيْنِ
  5: 4, // اِيَّاكَ نَعْبُدُ وَاِيَّاكَ نَسْتَعِيْنُ
  6: 3, // اِهْدِنَا الصِّرَاطَ الْمُسْتَقِيْمَ
  7: 9, // صِرَاطَ الَّذِيْنَ اَنْعَمْتَ عَلَيْهِمْ | غَيْرِ الْمَغْضُوْبِ عَلَيْهِمْ وَلَا الضَّاۤلِّيْنَ
};

/**
 * Kata pertama milik `ayat_7_part_2`.
 *
 * Ayat 7 dinilai dalam dua segmen. Titik potongnya tidak dipilih sendiri —
 * dibaca dari kata yang disebut opsi katalog di `lib/teacher-eval/catalog.ts`:
 * segmen `ayat_7` menyebut صراط، الذين، أنعمت، عليهم (kata 0-3), sedangkan
 * `ayat_7_part_2` menyebut غير، المغضوب، عليهم، ولا الضالين (kata 4-8).
 */
export const AYAT_7_SPLIT_AT = 4;

/**
 * Segmen pemilik satu posisi kata. `null` kalau posisinya di luar Al-Fatihah —
 * mesin bisa saja melaporkan koordinat aneh saat alignment meleset jauh, dan
 * temuan seperti itu lebih baik dibuang daripada dibebankan ke segmen yang
 * kebetulan terdekat.
 */
export function segmentFor(ayat: number, kataIdx: number): SegmentKey | null {
  const jumlahKata = WORDS_PER_AYAT[ayat];
  if (jumlahKata === undefined) return null;
  if (!Number.isInteger(kataIdx) || kataIdx < 0 || kataIdx >= jumlahKata) return null;

  if (ayat === 7) {
    return kataIdx < AYAT_7_SPLIT_AT ? "ayat_7" : "ayat_7_part_2";
  }
  return `ayat_${ayat}` as SegmentKey;
}
