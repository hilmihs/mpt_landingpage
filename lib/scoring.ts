import type { ErrorItem, IndikatorKey, Severity } from "@/types";

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  major: 1,
  minor: 0.5,
};

interface Threshold {
  min: number;
  max: number;
  skor: number;
  label: string;
}

export const SCORE_THRESHOLDS: Threshold[] = [
  { min: 0, max: 0, skor: 5, label: "Bacaan Sempurna" },
  { min: 0.5, max: 2, skor: 4, label: "Bacaan Sangat Baik" },
  { min: 2.5, max: 5, skor: 3, label: "Bacaan Cukup Baik" },
  { min: 5.5, max: 10, skor: 2, label: "Bacaan Perlu Penguatan" },
  { min: 10.5, max: Infinity, skor: 1, label: "Bacaan Perlu Penguatan Dasar" },
];

export const INDIKATOR_LABEL: Record<IndikatorKey, string> = {
  harakat: "Tanda Baca (Harakat)",
  huruf: "Pengucapan Huruf",
  panjang_pendek: "Panjang Pendek (Mad)",
  syaddah: "Penekanan Huruf (Syaddah)",
};

export interface ScoreResult {
  skor: number;
  status_label: string;
  weighted_score: number;
  total_errors_major: number;
  total_errors_minor: number;
}

export function computeScore(errors: {
  errors_harakat: ErrorItem[];
  errors_huruf: ErrorItem[];
  errors_panjang_pendek: ErrorItem[];
  errors_syaddah: ErrorItem[];
}): ScoreResult {
  const all: ErrorItem[] = [
    ...errors.errors_harakat,
    ...errors.errors_huruf,
    ...errors.errors_panjang_pendek,
    ...errors.errors_syaddah,
  ];

  let total_errors_major = 0;
  let total_errors_minor = 0;
  let weighted_score = 0;

  for (const e of all) {
    if (e.severity === "major") total_errors_major++;
    else total_errors_minor++;
    weighted_score += SEVERITY_WEIGHT[e.severity];
  }

  const tier =
    SCORE_THRESHOLDS.find(
      (t) => weighted_score >= t.min && weighted_score <= t.max,
    ) ?? SCORE_THRESHOLDS[SCORE_THRESHOLDS.length - 1]!;

  return {
    skor: tier.skor,
    status_label: tier.label,
    weighted_score,
    total_errors_major,
    total_errors_minor,
  };
}
