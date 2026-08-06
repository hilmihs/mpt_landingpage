import { computeEvaluation } from "@/lib/teacher-eval/scoring";
import { projectToEvaluationAyat } from "@/lib/ai-eval/project";
import type { AiEvaluationRow } from "@/lib/ai-eval/types";
import type { ErrorItem, MLPredictResult } from "@/types";

/**
 * Susun baris `ai_evaluations` dari balasan ML server.
 *
 * Perhatikan bahwa tidak ada satu pun rumus skoring di sini. Seluruh angka
 * datang dari `computeEvaluation()` milik pengajar — itu memang inti dari
 * rancangan ini. Kalau suatu saat rubrik pengajar berubah, skor mesin ikut
 * berubah dengan sendirinya dan keduanya tetap sebanding.
 */
export function buildAiEvaluationRow(
  submissionId: string,
  result: MLPredictResult,
): AiEvaluationRow {
  const { ayat, dibuang } = projectToEvaluationAyat(result);
  const hasil = computeEvaluation(ayat);

  const findings: ErrorItem[] = [
    ...result.errors_harakat,
    ...result.errors_ketepatan_huruf,
    ...result.errors_panjang_pendek,
    ...result.errors_tasydid,
    ...result.errors_hukum_tajwid,
  ];

  const raw =
    result.ml_raw_output && typeof result.ml_raw_output === "object"
      ? { ...(result.ml_raw_output as Record<string, unknown>) }
      : ({} as Record<string, unknown>);
  // Temuan yang koordinatnya di luar Al-Fatihah dibuang saat proyeksi. Jumlahnya
  // dicatat: kalau angkanya besar, alignment sedang meleset dan skor yang
  // dihasilkan tidak layak dipakai sebagai pembanding.
  raw.temuan_di_luar_jangkauan = dibuang;

  return {
    submission_id: submissionId,
    ayat,
    score_ayat: hasil.perSegment,
    score_min: hasil.scoreTen,
    label_min: hasil.band.title,
    score_harakat: hasil.indicators.harakat.score,
    label_harakat: hasil.indicators.harakat.label,
    score_ketepatan_huruf: hasil.indicators.ketepatanHuruf.score,
    label_ketepatan_huruf: hasil.indicators.ketepatanHuruf.label,
    score_panjang_pendek: hasil.indicators.panjangPendek.score,
    label_panjang_pendek: hasil.indicators.panjangPendek.label,
    score_tasydid: hasil.indicators.tasydid.score,
    label_tasydid: hasil.indicators.tasydid.label,
    score_hukum_tajwid: hasil.indicators.hukumTajwid.score,
    label_hukum_tajwid: hasil.indicators.hukumTajwid.label,
    total_jaliy: hasil.totalJaliy,
    total_khafiy: hasil.totalKhafiy,
    findings,
    ml_model_version: result.ml_model_version,
    ml_confidence: result.ml_confidence ?? null,
    ml_raw_output: raw,
  };
}
