import { emptyAyat, type EvaluationAyat } from "@/lib/teacher-eval/types";
import { segmentFor } from "@/lib/ai-eval/segments";
import { AI_CATEGORIES, type AiCategory } from "@/lib/ai-eval/types";
import type { ErrorItem, MLPredictResult } from "@/types";

/**
 * Proyeksi temuan mesin ke bentuk temuan pengajar.
 *
 * Hasilnya langsung bisa diberikan ke `computeEvaluation()` — fungsi skoring
 * yang sama yang dipakai pengajar — sehingga kedua penilaian keluar pada skala
 * dan agregasi yang identik.
 */

/**
 * Tag kategori. Harus persis salah satu kunci `TAG_TO_INDICATOR` di
 * `lib/teacher-eval/catalog.ts`; kalau meleset, `parseOption` mengembalikan
 * `indicator: null` dan temuannya hilang dari skor indikator tanpa suara.
 */
const TAG: Record<AiCategory, string> = {
  harakat: "Harakat",
  ketepatan_huruf: "Ketepatan Huruf",
  panjang_pendek: "Panjang Pendek",
  tasydid: "Tasydid",
  hukum_tajwid: "Tajwid",
};

const FRASA: Record<AiCategory, string> = {
  harakat: "Harakat tidak sesuai",
  ketepatan_huruf: "Huruf tidak tepat",
  panjang_pendek: "Panjang-pendek tidak sesuai",
  tasydid: "Tasydid tidak sesuai",
  hukum_tajwid: "Hukum tajwid tidak sesuai",
};

/** Nama field `errors_*` pada balasan ML server, per kategori. */
const FIELD: Record<AiCategory, keyof MLPredictResult> = {
  harakat: "errors_harakat",
  ketepatan_huruf: "errors_ketepatan_huruf",
  panjang_pendek: "errors_panjang_pendek",
  tasydid: "errors_tasydid",
  hukum_tajwid: "errors_hukum_tajwid",
};

/** Kalimat temuan. Bentuknya meniru katalog: kalimat, lalu tag di ujung. */
export function kalimatTemuan(kategori: AiCategory, item: ErrorItem): string {
  const kata = item.expected?.trim()
    ? item.expected.trim()
    : `ke-${item.kata_idx + 1}`;
  return `${FRASA[kategori]} pada kata ${kata} (deteksi mesin) [${TAG[kategori]}]`;
}

export interface ProjectionResult {
  ayat: EvaluationAyat;
  /** Temuan yang dibuang karena koordinatnya di luar Al-Fatihah. */
  dibuang: number;
}

/**
 * Ubah balasan ML server jadi `EvaluationAyat`.
 *
 * DEDUP — bagian yang paling mudah salah. Satu kata yang dibaca keliru bisa
 * menghasilkan lima mismatch fonem berturut-turut, dan tanpa penggabungan
 * kelima-limanya akan dihitung sebagai lima kesalahan. Bagi pengajar itu SATU
 * centang. Kalau dibiarkan, skor mesin jatuh secara sistematis dan angka
 * agreement yang keluar menyesatkan — mesin akan tampak jauh lebih ketat
 * daripada kenyataannya.
 *
 * Penggabungan dilakukan atas kalimat yang dihasilkan, di dalam satu segmen dan
 * satu tingkat keparahan. Karena kalimatnya memuat teks kata, dua kesalahan
 * kategori sama pada kata berbeda tetap terhitung dua.
 */
export function projectToEvaluationAyat(result: MLPredictResult): ProjectionResult {
  const ayat = emptyAyat();
  const seen = new Set<string>();
  let dibuang = 0;

  for (const kategori of AI_CATEGORIES) {
    const items = (result[FIELD[kategori]] as ErrorItem[] | undefined) ?? [];
    for (const item of items) {
      const segment = segmentFor(item.ayat, item.kata_idx);
      if (!segment) {
        dibuang++;
        continue;
      }

      const severity = item.severity === "minor" ? "khafiy" : "jaliy";
      const kalimat = kalimatTemuan(kategori, item);

      const kunci = `${segment}|${severity}|${kalimat}`;
      if (seen.has(kunci)) continue;
      seen.add(kunci);

      ayat[segment][severity].push(kalimat);
    }
  }

  return { ayat, dibuang };
}
