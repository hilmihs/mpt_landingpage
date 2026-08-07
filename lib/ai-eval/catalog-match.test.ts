import { describe, expect, it } from "vitest";

import { ATURAN, cocokkanKeKatalog, kalimatKatalog } from "@/lib/ai-eval/catalog-match";
import { projectToEvaluationAyat } from "@/lib/ai-eval/project";
import { EVALUATION_OPTIONS } from "@/lib/teacher-eval/catalog";
import { computeEvaluation } from "@/lib/teacher-eval/scoring";
import type { ErrorItem, MLPredictResult } from "@/types";

function err(
  ayat: number,
  kataIdx: number,
  dari: string,
  ke: string,
  kata = "كلمة",
): ErrorItem {
  return {
    ayat,
    kata_idx: kataIdx,
    expected: kata,
    actual: ke,
    severity: "major",
    expected_char: dari,
    actual_char: ke,
  };
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

describe("integritas tabel aturan", () => {
  // Aturan merujuk opsi katalog lewat (segmen, indeks). Kalau katalog diurutkan
  // ulang atau opsi disisipkan, rujukan itu diam-diam menunjuk kalimat lain —
  // dan pengajar menerima usulan yang salah tanpa ada yang tahu.
  it("setiap aturan menunjuk opsi yang benar", () => {
    for (const a of ATURAN) {
      const kalimat = kalimatKatalog(a);
      expect(kalimat, `${a.segment}[${a.index}] tidak ada`).toBeTruthy();
      expect(
        kalimat.includes(a.bukti),
        `${a.segment}[${a.index}] tidak memuat "${a.bukti}": ${kalimat}`,
      ).toBe(true);
    }
  });

  it("tidak ada aturan yang menunjuk opsi sama dua kali", () => {
    const kunci = ATURAN.map((a) => `${a.segment}#${a.index}`);
    expect(new Set(kunci).size).toBe(kunci.length);
  });

  it("hanya menunjuk opsi jaliy yang benar-benar ada", () => {
    for (const a of ATURAN) {
      expect(a.index).toBeLessThan(EVALUATION_OPTIONS[a.segment].jaliy.length);
    }
  });
});

describe("cocokkanKeKatalog", () => {
  it("ص dibaca س pada الصراط menemukan opsi katalognya", () => {
    const k = cocokkanKeKatalog("ayat_6", "ketepatan_huruf", err(6, 1, "ص", "س"));
    expect(k).toContain("الصراط");
    expect(k).toContain("[Ketepatan Huruf]");
  });

  it("ض dibaca د pada المغضوب menemukan opsi katalognya", () => {
    const k = cocokkanKeKatalog("ayat_7_part_2", "ketepatan_huruf", err(7, 5, "ض", "د"));
    expect(k).toContain("المغضوب");
  });

  it("ق dibaca ك pada المستقيم menemukan opsi katalognya", () => {
    const k = cocokkanKeKatalog("ayat_6", "ketepatan_huruf", err(6, 2, "ق", "ك"));
    expect(k).toContain("المستقيم");
  });

  it("ن dibaca م pada أنعمت masuk kategori Tajwid", () => {
    const k = cocokkanKeKatalog("ayat_7", "hukum_tajwid", err(7, 2, "ن", "م"));
    expect(k).toContain("Idgham");
    expect(k).toContain("[Tajwid]");
  });

  it("kata yang salah tidak dicocokkan", () => {
    // ص memang disebut katalog, tapi pada kata 1 (الصراط) — bukan kata 0
    expect(cocokkanKeKatalog("ayat_6", "ketepatan_huruf", err(6, 0, "ص", "س"))).toBeNull();
  });

  it("huruf pengganti di luar daftar tidak dicocokkan", () => {
    // katalog menyebut ص menjadi س atau ش, tidak menyebut ف
    expect(cocokkanKeKatalog("ayat_6", "ketepatan_huruf", err(6, 1, "ص", "ف"))).toBeNull();
  });

  it("temuan tanpa pasangan huruf tetap bisa cocok lewat kategori", () => {
    const tanpa: ErrorItem = {
      ayat: 4, kata_idx: 2, expected: "ٱلدِّينِ", actual: "", severity: "major",
    };
    expect(cocokkanKeKatalog("ayat_4", "tasydid", tanpa)).toContain("الدين");
  });
});

describe("proyeksi memakai kalimat katalog", () => {
  it("temuan yang dikenali memakai kalimat katalog apa adanya", () => {
    const { ayat, bernama, takBernama } = projectToEvaluationAyat(
      hasil({ errors_ketepatan_huruf: [err(6, 1, "ص", "س", "ٱلصِّرَٰطَ")] }),
    );
    expect(bernama).toBe(1);
    expect(takBernama).toBe(0);
    expect(ayat.ayat_6.jaliy[0]).toBe(EVALUATION_OPTIONS.ayat_6.jaliy[1]);
  });

  it("temuan tak dikenal tetap dilaporkan, tidak dibuang", () => {
    const { ayat, bernama, takBernama } = projectToEvaluationAyat(
      hasil({ errors_ketepatan_huruf: [err(3, 0, "ل", "ن", "ٱلرَّحْمَـٰنِ")] }),
    );
    expect(bernama).toBe(0);
    expect(takBernama).toBe(1);
    expect(ayat.ayat_3.jaliy).toHaveLength(1);
    expect(ayat.ayat_3.jaliy[0]).toContain("deteksi mesin");
  });

  it("kalimat katalog tetap terbaca oleh penghitung indikator", () => {
    // Kalimat katalog membawa tagnya sendiri, jadi skor indikator harus jalan
    const { ayat } = projectToEvaluationAyat(
      hasil({ errors_ketepatan_huruf: [err(6, 1, "ص", "س", "ٱلصِّرَٰطَ")] }),
    );
    const skor = computeEvaluation(ayat);
    expect(skor.indicators.ketepatanHuruf.jaliy).toBe(1);
    expect(skor.perSegment.ayat_6).toBe(4);
  });
});
