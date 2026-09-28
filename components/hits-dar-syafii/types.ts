import type { Gender } from "@/lib/hits-dar-syafii";

export interface FormState {
  email: string;
  nama: string;
  nama_anak: string;
  kelas_anak: string;
  jenis_kelamin: Gender | "";
  nomor_wa: string;
  usia: string;
  kota: string;
  jadwal: string;
  level: string;
}

export type FieldKey = keyof FormState;
export type Errors = Partial<Record<FieldKey, string>>;

export interface AudioTake {
  blob: Blob;
  /** Object URL untuk diputar ulang; dicabut induk saat rekaman diganti. */
  url: string;
  /** null kalau browser tidak bisa membaca durasi berkas unggahan. */
  durationSec: number | null;
  sumber: "rekam" | "unggah";
  fileName?: string;
}

export const EMPTY_FORM: FormState = {
  email: "",
  nama: "",
  nama_anak: "",
  kelas_anak: "",
  jenis_kelamin: "",
  nomor_wa: "",
  usia: "",
  kota: "",
  jadwal: "",
  level: "",
};

export type SendState =
  | { kind: "idle" }
  | { kind: "sending"; pct: number }
  | { kind: "error"; message: string };
