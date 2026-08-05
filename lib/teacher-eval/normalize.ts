import { SEGMENT_KEYS, type EvaluationAyat, type SegmentKey } from "./types";

/**
 * Pembersih bentuk untuk kolom jsonb `teacher_evaluations.ayat` dan
 * `score_ayat`.
 *
 * Dipakai bersama oleh rapot peserta dan halaman detail admin. Sengaja tinggal
 * di sini, bukan disalin ke dua tempat: begitu ada segmen baru ditambahkan ke
 * SEGMENT_KEYS, salinan yang tertinggal akan diam-diam menghilangkan segmen itu
 * dari salah satu halaman tanpa ada yang gagal lebih dulu.
 */

/**
 * Kolom jsonb kembali dari driver sebagai nilai bebas, jadi bentuknya dipastikan
 * di sini. Baris lama bisa saja ditulis sebelum katalog segmen selengkap
 * sekarang — segmen yang hilang diisi kosong daripada meruntuhkan halaman.
 */
export function normalizeAyat(raw: unknown): EvaluationAyat | null {
  if (raw == null || typeof raw !== "object") return null;
  const src = raw as Record<string, { jaliy?: unknown; khafiy?: unknown }>;
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  return SEGMENT_KEYS.reduce((acc, key) => {
    acc[key] = {
      jaliy: strings(src[key]?.jaliy),
      khafiy: strings(src[key]?.khafiy),
    };
    return acc;
  }, {} as EvaluationAyat);
}

export function normalizeSegmentScores(
  raw: unknown,
): Partial<Record<SegmentKey, number>> {
  if (raw == null || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Partial<Record<SegmentKey, number>> = {};
  for (const key of SEGMENT_KEYS) {
    const v = src[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return out;
}
