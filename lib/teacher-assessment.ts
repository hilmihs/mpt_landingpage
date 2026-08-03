/**
 * Teacher (pengajar) assessment — a SEPARATE instrument from the AI rapot.
 *
 * AI rapot  : lahn jaliy only (harakat, huruf, panjang-pendek, syaddah), scale 1–5.
 * Teacher   : holistic tilawah review (makhraj, sifat, mad, ghunnah, kelancaran, …), scale 1–10.
 *
 * The two are NOT comparable — different axes, different scales. Never render one as a
 * delta/improvement over the other.
 *
 * Real data is pulled from the external assessment site (muhajirproject.com). Until its
 * auth + response contract are available, `fetchTeacherAssessment` returns null when the
 * env vars are unset, and the demo route uses `DEMO_TEACHER_ASSESSMENT`.
 */

export interface TeacherAspek {
  /** e.g. "Makhraj", "Sifat Huruf", "Mad", "Kelancaran" */
  nama: string;
  /** Numeric 1–10, or null for a purely qualitative note. */
  nilai: number | null;
  catatan?: string;
}

export interface TeacherAssessmentResult {
  /** Holistic score, scale 1–10. */
  skor: number;
  /** Band label derived from `skor` (see TEACHER_SCORE_BANDS). */
  label: string;
  pengajar: string;
  /** Human-readable date string, e.g. "12 Juni 2026". */
  tanggal: string;
  aspek: TeacherAspek[];
  kelebihan: string[];
  perbaikan: string[];
  ringkasan: string;
  rekomendasi: string;
}

interface ScoreBand {
  min: number;
  max: number;
  label: string;
}

/** Scale 1–10. Distinct from the AI 1–5 SCORE_THRESHOLDS in lib/scoring.ts. */
export const TEACHER_SCORE_BANDS: ScoreBand[] = [
  { min: 9, max: 10, label: "Mumtaz (Istimewa)" },
  { min: 7, max: 8, label: "Jayyid Jiddan (Sangat Baik)" },
  { min: 5, max: 6, label: "Jayyid (Baik)" },
  { min: 3, max: 4, label: "Maqbul (Cukup)" },
  { min: 1, max: 2, label: "Perlu Penguatan Dasar" },
];

export function teacherBand(skor: number): string {
  const clamped = Math.max(1, Math.min(10, Math.round(skor)));
  return (
    TEACHER_SCORE_BANDS.find((b) => clamped >= b.min && clamped <= b.max)?.label ??
    "Jayyid (Baik)"
  );
}

/** Mock used by the standalone demo page and as a local-dev fallback. */
export const DEMO_TEACHER_ASSESSMENT: TeacherAssessmentResult = {
  skor: 7,
  label: teacherBand(7),
  pengajar: "Ustadz Ahmad Hidayat",
  tanggal: "12 Juni 2026",
  aspek: [
    {
      nama: "Makhraj Huruf",
      nilai: 7,
      catatan: "Sebagian besar tepat. Huruf ḍād (ض) dan ẓā (ظ) masih perlu dibedakan.",
    },
    {
      nama: "Sifat Huruf",
      nilai: 6,
      catatan: "Isti'la pada huruf tafkhim kadang kurang tebal.",
    },
    {
      nama: "Mad (Panjang Bacaan)",
      nilai: 8,
      catatan: "Mad thabi'i konsisten 2 harakat. Mad wajib sudah baik.",
    },
    {
      nama: "Ghunnah & Dengung",
      nilai: 7,
      catatan: "Dengung pada nun/mim bertasydid cukup, durasi bisa lebih stabil.",
    },
    {
      nama: "Kelancaran & Tempo",
      nilai: 8,
      catatan: "Bacaan mengalir, tidak tergesa.",
    },
    {
      nama: "Waqaf & Ibtida",
      nilai: 6,
      catatan: "Beberapa waqaf pada tempat yang kurang tepat.",
    },
  ],
  kelebihan: [
    "Tempo bacaan tenang dan teratur",
    "Mad thabi'i konsisten",
    "Percaya diri saat membaca",
  ],
  perbaikan: [
    "Bedakan makhraj ḍād (ض) dengan ẓā (ظ)",
    "Pertegas tafkhim pada huruf isti'la",
    "Perhatikan letak waqaf yang tepat",
  ],
  ringkasan:
    "Bacaan sudah pada level baik dan layak dilanjutkan ke pendampingan intensif. " +
    "Fokus perbaikan ada pada ketelitian makhraj dan ketepatan waqaf.",
  rekomendasi:
    "Disarankan mengikuti Tahsin Al-Fatihah untuk memperkuat makhraj dan tajwid secara terbimbing.",
};

/**
 * Maps a raw response from the external teacher-assessment API into our internal shape.
 * STUB: the muhajirproject.com response contract is not yet known. Fill this in once the
 * API/auth is available, then remove the demo fallback in the caller as needed.
 */
function mapExternalToTeacherResult(raw: unknown): TeacherAssessmentResult {
  // TODO: implement real mapping when muhajirproject.com response shape is documented.
  const r = raw as Partial<TeacherAssessmentResult> & { score?: number };
  const skor = Number(r.skor ?? r.score ?? 0);
  return {
    skor,
    label: teacherBand(skor),
    pengajar: r.pengajar ?? "Pengajar MPT",
    tanggal: r.tanggal ?? "",
    aspek: r.aspek ?? [],
    kelebihan: r.kelebihan ?? [],
    perbaikan: r.perbaikan ?? [],
    ringkasan: r.ringkasan ?? "",
    rekomendasi: r.rekomendasi ?? "",
  };
}

/**
 * Fetches a teacher assessment result from the external site (muhajirproject.com).
 * Mirrors lib/ml-client.ts. Returns null (instead of throwing) when the integration is
 * not configured or the fetch fails, so the UI can show a graceful "belum tersedia" state.
 */
export async function fetchTeacherAssessment(
  slug: string,
): Promise<TeacherAssessmentResult | null> {
  const base = process.env.TEACHER_ASSESSMENT_BASE_URL;
  if (!base) return null;

  try {
    const res = await fetch(
      `${base.replace(/\/$/, "")}/results/${encodeURIComponent(slug)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TEACHER_ASSESSMENT_API_KEY ?? ""}`,
        },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) return null;
    return mapExternalToTeacherResult(await res.json());
  } catch {
    return null;
  }
}
