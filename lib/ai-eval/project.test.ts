import { describe, expect, it } from "vitest";

import { projectToEvaluationAyat, kalimatTemuan } from "@/lib/ai-eval/project";
import { buildAiEvaluationRow } from "@/lib/ai-eval/store";
import { AI_CATEGORIES } from "@/lib/ai-eval/types";
import { segmentFor, AYAT_7_SPLIT_AT } from "@/lib/ai-eval/segments";
import { parseOption } from "@/lib/teacher-eval/catalog";
import { computeEvaluation } from "@/lib/teacher-eval/scoring";
import { SEGMENT_KEYS } from "@/lib/teacher-eval/types";
import type { ErrorItem, MLPredictResult } from "@/types";

function err(ayat: number, kataIdx: number, expected = "كلمة", severity: "major" | "minor" = "major"): ErrorItem {
  return { ayat, kata_idx: kataIdx, expected, actual: expected, severity };
}

function hasil(over: Partial<MLPredictResult> = {}): MLPredictResult {
  return {
    errors_harakat: [],
    errors_ketepatan_huruf: [],
    errors_panjang_pendek: [],
    errors_tasydid: [],
    errors_hukum_tajwid: [],
    ml_model_version: "uji",
    ml_confidence: 0.9,
    ...over,
  };
}

describe("segmentFor", () => {
  it("memetakan ayat biasa ke segmennya sendiri", () => {
    expect(segmentFor(1, 0)).toBe("ayat_1");
    expect(segmentFor(6, 2)).toBe("ayat_6");
  });

  it("memotong ayat 7 jadi dua segmen", () => {
    expect(segmentFor(7, AYAT_7_SPLIT_AT - 1)).toBe("ayat_7");
    expect(segmentFor(7, AYAT_7_SPLIT_AT)).toBe("ayat_7_part_2");
    expect(segmentFor(7, 8)).toBe("ayat_7_part_2");
  });

  it("menolak posisi di luar Al-Fatihah", () => {
    expect(segmentFor(3, 2)).toBeNull(); // ayat 3 cuma 2 kata
    expect(segmentFor(8, 0)).toBeNull();
    expect(segmentFor(1, -1)).toBeNull();
  });
});

describe("tag kategori", () => {
  // Kalau satu tag saja tidak dikenali, temuannya tetap menambah skor segmen
  // tapi hilang dari skor indikator — perbedaan yang sulit dilihat dari luar.
  it("setiap kategori menghasilkan tag yang dikenali katalog", () => {
    for (const kategori of AI_CATEGORIES) {
      const kalimat = kalimatTemuan(kategori, err(1, 0));
      expect(parseOption(kalimat).indicator, kategori).not.toBeNull();
    }
  });
});

describe("projectToEvaluationAyat", () => {
  it("bacaan bersih menghasilkan 10 di semua segmen", () => {
    const { ayat } = projectToEvaluationAyat(hasil());
    const skor = computeEvaluation(ayat);
    expect(skor.scoreTen).toBe(10);
    for (const s of SEGMENT_KEYS) expect(skor.perSegment[s]).toBe(10);
  });

  it("satu lahn jaliy menjatuhkan segmennya ke 4 dan skor kepala ikut turun", () => {
    const { ayat } = projectToEvaluationAyat(
      hasil({ errors_harakat: [err(3, 0, "الرحمن")] }),
    );
    const skor = computeEvaluation(ayat);
    // calculateAyatScore(1 jaliy, 0 khafiy) = 2 → ×2 = 4
    expect(skor.perSegment.ayat_3).toBe(4);
    expect(skor.perSegment.ayat_1).toBe(10);
    // skor kepala = segmen TERLEMAH, bukan rata-rata
    expect(skor.scoreTen).toBe(4);
    expect(skor.weakestSegments).toEqual(["ayat_3"]);
  });

  it("beberapa fonem meleset di satu kata dihitung satu temuan", () => {
    const banyak = Array.from({ length: 5 }, () => err(2, 1, "لله"));
    const { ayat } = projectToEvaluationAyat(hasil({ errors_ketepatan_huruf: banyak }));
    expect(ayat.ayat_2.jaliy).toHaveLength(1);
  });

  it("kata berbeda pada kategori sama tetap dihitung terpisah", () => {
    const { ayat } = projectToEvaluationAyat(
      hasil({ errors_ketepatan_huruf: [err(2, 0, "الحمد"), err(2, 1, "لله")] }),
    );
    expect(ayat.ayat_2.jaliy).toHaveLength(2);
  });

  it("membuang temuan yang koordinatnya di luar Al-Fatihah", () => {
    const { ayat, dibuang } = projectToEvaluationAyat(
      hasil({ errors_harakat: [err(3, 99), err(1, 0)] }),
    );
    expect(dibuang).toBe(1);
    expect(ayat.ayat_1.jaliy).toHaveLength(1);
  });

  it("severity minor masuk ke khafiy", () => {
    const { ayat } = projectToEvaluationAyat(
      hasil({ errors_harakat: [err(1, 0, "بسم", "minor")] }),
    );
    expect(ayat.ayat_1.khafiy).toHaveLength(1);
    expect(ayat.ayat_1.jaliy).toHaveLength(0);
    // 1 khafiy, 0 jaliy → skor segmen 4 → ×2 = 8
    expect(computeEvaluation(ayat).perSegment.ayat_1).toBe(8);
  });

  it("temuan ayat 7 terpisah ke dua segmen sesuai posisinya", () => {
    const { ayat } = projectToEvaluationAyat(
      hasil({ errors_hukum_tajwid: [err(7, 2, "أنعمت"), err(7, 8, "الضالين")] }),
    );
    expect(ayat.ayat_7.jaliy).toHaveLength(1);
    expect(ayat.ayat_7_part_2.jaliy).toHaveLength(1);
  });
});

describe("buildAiEvaluationRow", () => {
  it("mengisi lima indikator pada skala 1-10", () => {
    const row = buildAiEvaluationRow(
      "sub-1",
      hasil({
        errors_harakat: [err(1, 0, "بسم")],
        errors_hukum_tajwid: [err(7, 2, "أنعمت")],
      }),
    );

    expect(row.score_min).toBe(4);
    expect(row.score_harakat).toBe(4);
    expect(row.score_hukum_tajwid).toBe(4);
    // indikator yang tidak punya temuan tetap bernilai penuh
    expect(row.score_tasydid).toBe(10);
    expect(row.total_jaliy).toBe(2);
    expect(row.total_khafiy).toBe(0);
    expect(row.label_min).toBeTruthy();
  });

  it("mencatat jumlah temuan yang dibuang ke ml_raw_output", () => {
    const row = buildAiEvaluationRow("sub-2", hasil({ errors_harakat: [err(3, 99)] }));
    const raw = row.ml_raw_output as Record<string, unknown>;
    expect(raw.temuan_di_luar_jangkauan).toBe(1);
  });

  it("menyimpan temuan mentah lima kategori tanpa dedup", () => {
    const row = buildAiEvaluationRow(
      "sub-3",
      hasil({ errors_ketepatan_huruf: [err(2, 1), err(2, 1), err(2, 1)] }),
    );
    // findings = catatan riset, harus utuh; dedup hanya berlaku pada proyeksi
    expect(row.findings).toHaveLength(3);
  });
});
