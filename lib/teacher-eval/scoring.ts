import { EVALUATION_OPTIONS, parseOption } from "@/lib/teacher-eval/catalog";
import {
  INDICATOR_KEYS,
  SEGMENT_KEYS,
  type Band,
  type EvaluationAyat,
  type EvaluationResult,
  type IndicatorKey,
  type IndicatorResult,
  type SegmentKey,
} from "@/lib/teacher-eval/types";

/**
 * Penilaian bacaan Al-Fatihah.
 *
 * Rumusnya diambil utuh dari instrumen yang sudah dipakai para pengajar, bukan
 * dirancang ulang — supaya penilaian yang keluar dari aplikasi ini sama dengan
 * yang selama ini mereka berikan secara manual.
 */

/**
 * Skor satu segmen, skala 1-5.
 *
 * Perhatikan tangganya: SATU kesalahan jaliy langsung menjatuhkan segmen ke 2,
 * seberapa pun bersihnya sisa bacaan. Itu memang disengaja — lahn jaliy
 * mengubah makna, jadi bobotnya tidak sebanding dengan kesalahan ringan.
 */
export function calculateAyatScore(jaliy: number, khafiy: number): number {
  if (!Number.isFinite(jaliy) || !Number.isFinite(khafiy)) return 0;
  if (jaliy > 5) return 1;
  if (jaliy >= 1) return 2;
  if (khafiy >= 5) return 3;
  if (khafiy >= 1) return 4;
  return 5;
}

/**
 * Naikkan skala 1-5 ke 1-10.
 *
 * Pengali dua dipilih bukan sekadar demi angka yang lebih besar: hasilnya
 * mendarat persis di ambang band (2, 4, 6, 8, 10), sehingga tiap tingkat
 * penilaian asli memetakan tepat ke satu band tanpa ada nilai yang jatuh di
 * perbatasan. Skala 1-10 dipakai karena itu yang sudah dikenal peserta.
 */
export function toTenScale(score: number): number {
  return score * 2;
}

export function bandFor(scoreTen: number): Band {
  if (scoreTen <= 2) {
    return {
      title: "Belum Memenuhi Standar",
      description:
        "Masih banyak yang perlu dibenahi, namun semangat belajar ini langkah awal yang sangat berharga di sisi Allah.",
      tone: "danger",
    };
  }
  if (scoreTen <= 4) {
    return {
      title: "Perlu Bimbingan",
      description:
        "Sudah berusaha dengan baik, hanya perlu lebih teliti agar bacaan makin tepat dan shalat semakin sempurna.",
      tone: "warning",
    };
  }
  if (scoreTen <= 6) {
    return {
      title: "Sedikit Lagi, Perlu Terus Diperbaiki",
      description:
        "Bacaan sudah mulai benar, teruslah berlatih agar makin lancar dan sesuai dengan tuntunan Rasulullah ﷺ.",
      tone: "warning-orange",
    };
  }
  if (scoreTen <= 8) {
    return {
      title: "Baik",
      description:
        "Bacaan jelas dan makna sudah tepat. Tinggal dijaga dan diperindah agar hati makin khusyuk dalam membaca.",
      tone: "info",
    };
  }
  return {
    title: "Sangat Baik",
    description:
      "Bacaan indah, tajwid terjaga, dan makna sempurna. Semoga istiqamah dan menjadi amal yang diridhai Allah.",
    tone: "success",
  };
}

/** Hitung ulang skor lima indikator dari temuan yang tersebar di delapan segmen. */
function tallyIndicators(ayat: EvaluationAyat): Record<IndicatorKey, IndicatorResult> {
  const tally = INDICATOR_KEYS.reduce(
    (acc, key) => {
      acc[key] = { jaliy: 0, khafiy: 0 };
      return acc;
    },
    {} as Record<IndicatorKey, { jaliy: number; khafiy: number }>,
  );

  for (const segment of SEGMENT_KEYS) {
    for (const severity of ["jaliy", "khafiy"] as const) {
      for (const raw of ayat[segment][severity]) {
        const { indicator } = parseOption(raw);
        // Pilihan tanpa tag yang dikenali tetap dihitung di skor segmen, tapi
        // tidak bisa dibebankan ke indikator mana pun.
        if (indicator) tally[indicator][severity] += 1;
      }
    }
  }

  return INDICATOR_KEYS.reduce(
    (acc, key) => {
      const { jaliy, khafiy } = tally[key];
      const score = toTenScale(calculateAyatScore(jaliy, khafiy));
      acc[key] = { score, label: bandFor(score).title, jaliy, khafiy };
      return acc;
    },
    {} as Record<IndicatorKey, IndicatorResult>,
  );
}

/**
 * Hitung seluruh hasil penilaian dari temuan pengajar.
 *
 * Skor kepala diambil dari segmen TERLEMAH, bukan rata-rata. Rata-rata akan
 * menyamarkan satu ayat yang rusak parah di antara tujuh ayat yang bagus,
 * padahal justru ayat itulah yang perlu diperbaiki lebih dulu.
 */
export function computeEvaluation(ayat: EvaluationAyat): EvaluationResult {
  const perSegment = {} as Record<SegmentKey, number>;
  let totalJaliy = 0;
  let totalKhafiy = 0;

  for (const key of SEGMENT_KEYS) {
    const jaliy = ayat[key]?.jaliy.length ?? 0;
    const khafiy = ayat[key]?.khafiy.length ?? 0;
    totalJaliy += jaliy;
    totalKhafiy += khafiy;
    perSegment[key] = toTenScale(calculateAyatScore(jaliy, khafiy));
  }

  const scoreTen = Math.min(...SEGMENT_KEYS.map((k) => perSegment[k]));

  return {
    scoreTen,
    perSegment,
    // Peserta perlu tahu segmen mana yang menahan skornya, kalau tidak angka
    // itu terasa datang entah dari mana.
    weakestSegments: SEGMENT_KEYS.filter((k) => perSegment[k] === scoreTen),
    indicators: tallyIndicators(ayat),
    totalJaliy,
    totalKhafiy,
    band: bandFor(scoreTen),
  };
}

/** Jumlah pilihan yang tersedia, dipakai untuk menampilkan progres pengisian. */
export function totalOptions(): number {
  return SEGMENT_KEYS.reduce(
    (n, k) => n + EVALUATION_OPTIONS[k].jaliy.length + EVALUATION_OPTIONS[k].khafiy.length,
    0,
  );
}
