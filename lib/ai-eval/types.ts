import type { EvaluationAyat, IndicatorKey, SegmentKey } from "@/lib/teacher-eval/types";

/**
 * Penilaian mesin, dinyatakan dalam instrumen pengajar.
 *
 * Sampai Agustus 2026 mesin memakai instrumennya sendiri — empat indikator,
 * skala 1-5, agregasi berbobot. Pengajar memakai lima indikator, skala 1-10,
 * agregasi minimum. Dua angka dari dua instrumen berbeda tidak bisa
 * dibandingkan, padahal membandingkan itulah satu-satunya alasan mesin ini
 * dijalankan. Maka instrumennya disamakan: temuan mesin diproyeksikan ke bentuk
 * yang sama dengan temuan pengajar, lalu diskor oleh fungsi yang sama persis
 * (`computeEvaluation` di lib/teacher-eval/scoring.ts).
 *
 * Yang TIDAK dilakukan: mesin tidak memilih dari katalog 110 opsi. Kalimatnya
 * dikarang sendiri, hanya tag `[Kategori]`-nya yang harus cocok. Itu cukup
 * untuk menghasilkan skor yang sebanding, tanpa perlu tabel pemetaan
 * opsi-per-opsi yang mahal dan belum tentu terpakai.
 */

/** Lima kategori temuan mesin — nama sama dengan field `errors_*` dari ML server. */
export type AiCategory =
  | "harakat"
  | "ketepatan_huruf"
  | "panjang_pendek"
  | "tasydid"
  | "hukum_tajwid";

export const AI_CATEGORIES: readonly AiCategory[] = [
  "harakat",
  "ketepatan_huruf",
  "panjang_pendek",
  "tasydid",
  "hukum_tajwid",
] as const;

/** Satu baris `ai_evaluations`, siap ditulis atau dibaca. */
export interface AiEvaluationRow {
  submission_id: string;
  ayat: EvaluationAyat;
  score_ayat: Record<SegmentKey, number>;
  score_min: number;
  label_min: string;
  score_harakat: number;
  label_harakat: string;
  score_ketepatan_huruf: number;
  label_ketepatan_huruf: string;
  score_panjang_pendek: number;
  label_panjang_pendek: string;
  score_tasydid: number;
  label_tasydid: string;
  score_hukum_tajwid: number;
  label_hukum_tajwid: string;
  total_jaliy: number;
  total_khafiy: number;
  findings: unknown;
  ml_model_version: string;
  ml_confidence: number | null;
  ml_raw_output: unknown;
}

/** Kunci indikator pengajar → sufiks nama kolom di `ai_evaluations`. */
export const INDICATOR_COLUMN: Record<IndicatorKey, string> = {
  harakat: "harakat",
  ketepatanHuruf: "ketepatan_huruf",
  panjangPendek: "panjang_pendek",
  tasydid: "tasydid",
  hukumTajwid: "hukum_tajwid",
};
