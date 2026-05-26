export type Severity = "major" | "minor";

export type IndikatorKey =
  | "harakat"
  | "huruf"
  | "panjang_pendek"
  | "syaddah";

export interface ErrorItem {
  ayat: number;
  kata_idx: number;
  expected: string;
  actual: string;
  severity: Severity;
  note?: string;
}

export interface MLPredictInput {
  submission_id: string;
  audio_url: string;
  surah?: number;
  ayat_range?: string;
}

export interface MLPredictResult {
  errors_harakat: ErrorItem[];
  errors_huruf: ErrorItem[];
  errors_panjang_pendek: ErrorItem[];
  errors_syaddah: ErrorItem[];
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
  ai_narrative: string | null;
  ai_narrative_model: string | null;
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
  zoom_join_url: string | null;
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
