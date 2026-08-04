/**
 * Tipe bersama untuk penilaian pengajar per ayat.
 *
 * Al-Fatihah dinilai dalam DELAPAN segmen, bukan tujuh: ayat 7 dipecah dua
 * karena panjang dan memuat dua kelompok kesalahan yang berbeda sifatnya.
 */

export type SegmentKey =
  | "ayat_1"
  | "ayat_2"
  | "ayat_3"
  | "ayat_4"
  | "ayat_5"
  | "ayat_6"
  | "ayat_7"
  | "ayat_7_part_2";

export const SEGMENT_KEYS: readonly SegmentKey[] = [
  "ayat_1",
  "ayat_2",
  "ayat_3",
  "ayat_4",
  "ayat_5",
  "ayat_6",
  "ayat_7",
  "ayat_7_part_2",
] as const;

/** Lima indikator mutu bacaan. */
export type IndicatorKey =
  | "harakat"
  | "ketepatanHuruf"
  | "panjangPendek"
  | "tasydid"
  | "hukumTajwid";

export const INDICATOR_KEYS: readonly IndicatorKey[] = [
  "harakat",
  "ketepatanHuruf",
  "panjangPendek",
  "tasydid",
  "hukumTajwid",
] as const;

export const INDICATOR_LABEL: Record<IndicatorKey, string> = {
  harakat: "Harakat",
  ketepatanHuruf: "Ketepatan Huruf",
  panjangPendek: "Panjang Pendek",
  tasydid: "Tasydid",
  hukumTajwid: "Hukum Tajwid",
};

/** Temuan pengajar pada satu segmen. Isinya kalimat opsi apa adanya. */
export interface AyatSelection {
  jaliy: string[];
  khafiy: string[];
}

/** Seluruh temuan pada delapan segmen. */
export type EvaluationAyat = Record<SegmentKey, AyatSelection>;

/** Nama lain untuk EvaluationAyat, dipakai di sisi API. */
export type AyatPayload = EvaluationAyat;

export type Tone = "danger" | "warning" | "warning-orange" | "info" | "success";

export interface Band {
  title: string;
  description: string;
  tone: Tone;
}

export interface IndicatorResult {
  score: number;
  label: string;
  jaliy: number;
  khafiy: number;
}

export interface EvaluationResult {
  /** Skor kepala, skala 1-10. */
  scoreTen: number;
  /** Skor tiap segmen, skala 1-10. */
  perSegment: Record<SegmentKey, number>;
  /**
   * Segmen yang skornya sama dengan skor kepala.
   *
   * Skor kepala diambil dari segmen TERLEMAH, jadi tanpa daftar ini peserta
   * tidak punya cara tahu bagian mana yang menjatuhkan nilainya.
   */
  weakestSegments: SegmentKey[];
  indicators: Record<IndicatorKey, IndicatorResult>;
  totalJaliy: number;
  totalKhafiy: number;
  band: Band;
}

/** Payload kosong — dipakai sebagai state awal formulir. */
export function emptyAyat(): EvaluationAyat {
  return SEGMENT_KEYS.reduce((acc, key) => {
    acc[key] = { jaliy: [], khafiy: [] };
    return acc;
  }, {} as EvaluationAyat);
}
