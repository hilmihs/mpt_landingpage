/** `major` = lahn jaliy (mengubah makna), `minor` = lahn khafiy (sifat huruf). */
export type Severity = "major" | "minor";

/**
 * Empat indikator lama, skala 1-5.
 *
 * @deprecated Dipakai instrumen mesin sebelum Agustus 2026 dan masih dibaca
 * baris `rapot` lama. Penilaian baru memakai lima indikator yang sama dengan
 * pengajar — lihat `IndicatorKey` di lib/teacher-eval/types.ts.
 */
export type IndikatorKey =
  | "harakat"
  | "huruf"
  | "panjang_pendek"
  | "syaddah";

export interface ErrorItem {
  ayat: number;
  kata_idx: number;
  /** Teks kata utuh — untuk ditampilkan. */
  expected: string;
  actual: string;
  severity: Severity;
  note?: string;

  /**
   * Pasangan huruf yang meleset, terpisah dari teks kata. Dipakai mencocokkan
   * temuan ke opsi katalog bernama (lib/ai-eval/catalog-match.ts).
   */
  expected_char?: string;
  actual_char?: string;

  /**
   * Indikator asal temuan. Tersirat dari field `errors_*` yang memuatnya, tapi
   * hilang begitu kelimanya digabung — seperti di `ai_evaluations.findings`.
   */
  kategori?: string;
}

export interface MLPredictInput {
  submission_id: string;
  audio_url: string;
  surah?: number;
  ayat_range?: string;
}

/**
 * Balasan ML server.
 *
 * Lima field pertama memakai nama indikator yang sama persis dengan instrumen
 * pengajar, supaya penilaian mesin dan penilaian pengajar berada di satu sumbu
 * dan bisa dibandingkan. `errors_huruf` dan `errors_syaddah` adalah cermin dari
 * dua di antaranya, disimpan hanya selama masa transisi.
 */
export interface MLPredictResult {
  errors_harakat: ErrorItem[];
  errors_ketepatan_huruf: ErrorItem[];
  errors_panjang_pendek: ErrorItem[];
  errors_tasydid: ErrorItem[];
  errors_hukum_tajwid: ErrorItem[];

  /** @deprecated cermin dari `errors_ketepatan_huruf`. */
  errors_huruf?: ErrorItem[];
  /** @deprecated cermin dari `errors_tasydid`. */
  errors_syaddah?: ErrorItem[];

  ml_model_version: string;
  ml_confidence: number;
  ml_raw_output?: unknown;
}

export type SubmissionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface FormData {
  nama: string;
  jenis_kelamin: "ikhwan" | "akhwat";
  nomor_wa: string;
}

export interface RapotRow {
  slug: string;
  submission_id: string;
  created_at: string;
  skor: number;
  status_label: string;
  errors_harakat: ErrorItem[];
  errors_huruf: ErrorItem[];
  errors_panjang_pendek: ErrorItem[];
  errors_syaddah: ErrorItem[];
  total_errors_major: number;
  total_errors_minor: number;
  weighted_score: number;
  ml_model_version: string | null;
  ml_confidence: number | null;
}

// V2 — Booking & Pengajar

export type MeetingKind = "assessment" | "tahsin";
export type SlotStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type BookingStatus =
  | "reserved"
  | "confirmed"
  | "attended"
  | "no_show"
  | "cancelled";
export type Gender = "ikhwan" | "akhwat";

export interface TeacherRow {
  id: string;
  nama: string;
  jenis_kelamin: Gender;
  bio: string | null;
  foto_url: string | null;
}

export interface SlotRow {
  id: string;
  teacher_id: string;
  kind: MeetingKind;
  scheduled_at: string;
  duration_min: number;
  capacity: number;
  reserved_count: number;
  gender_target: Gender;
  meet_join_url: string | null;
  status: SlotStatus;
}

export interface SlotWithTeacher extends SlotRow {
  teacher_nama: string;
  available_capacity: number;
}

export interface BookingRow {
  id: string;
  slot_id: string;
  submission_id: string;
  status: BookingStatus;
  reserved_until: string;
  created_at: string;
  notes_from_user: string | null;
}

export type InterestGate =
  | "gate1_post_rapot"
  | "gate2_post_assessment"
  | "gate3_post_tahsin";
export type InterestResponse = "yes" | "no" | "later";

export interface AnalyticsEventPayload {
  event_name: string;
  submission_id?: string | null;
  session_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SubmissionRow {
  id: string;
  created_at: string;
  nama: string;
  jenis_kelamin: "ikhwan" | "akhwat";
  nomor_wa: string;
  audio_path: string;
  audio_duration_sec: number | null;
  status: SubmissionStatus;
  error_message: string | null;
  processed_at: string | null;
  rapot_slug: string | null;
}
