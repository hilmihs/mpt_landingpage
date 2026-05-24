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
