import { z } from "zod";
import { WA_REGEX } from "@/lib/validation";
import { isKotaValid } from "@/lib/kota-indonesia";

/**
 * Pendaftaran HITS Darsyafii — kelas HITS untuk orang tua/wali murid
 * Darsyafii Islamic School, kerja sama Muhajir Project Tilawah dan Darsyafii.
 * Pertanyaan dan level disalin dari Google Form HITS; jadwal dari pengumuman
 * program. Kalau jadwal berubah, cukup ubah berkas ini — tidak ada tabel
 * jadwal di database, yang ditampilkan hanya jadwal yang masih tersedia.
 *
 * Bedanya dengan HITS reguler (/daftar-hits): di sini tidak ada tes pilihan
 * ganda. Ujian masuknya satu rekaman bacaan Surat Asy-Syura (42) ayat 1–6,
 * didengarkan admin/pengajar.
 */

export type Gender = "ikhwan" | "akhwat";

export interface Jadwal {
  id: string;
  /** Kelas dipisah ketat per jenis kelamin; peserta hanya melihat jadwalnya sendiri. */
  gender: Gender;
  hari: string;
  jam: string;
}

export interface Level {
  id: "dasar" | "lanjutan" | "alumni";
  nama: string;
  untuk: string;
}

export const DAR_SYAFII = {
  program: "dar_syafii",
  nama: "HITS Darsyafii",
  /** Kunci angkatan di database; label hanya untuk teks. */
  angkatan: "2026-10",
  angkatanLabel: "2026",
  sasaran: "orang tua / wali murid Darsyafii",
  genderDibuka: ["ikhwan", "akhwat"] as readonly Gender[],
  usiaMin: 15,
  /**
   * Umur rekaman sebelum dihapus lifecycle rule bucket. HITS diberi 14 hari
   * (assessment tetap 7) supaya admin sempat mendengarkan semua pendaftar
   * sebelum membagi kelas. Aturannya di docs/DEPLOY_GCP.md §3 — angka ini
   * hanya untuk teks dan halaman admin, penghapusannya tetap oleh GCS.
   */
  retensiHari: 14,
  materi: "perbaikan bacaan, pendalaman huruf-huruf, dan materi lainnya",
  tempat: "Darsyafii Islamic School",
  /** Nomor admin yang diminta disimpan peserta — dari pengumuman program. */
  adminWa: "6281212055054",
  adminWaLabel: "0812 1205 5054",
} as const;

export const JADWAL: readonly Jadwal[] = [
  { id: "ikh-sen-1415", gender: "ikhwan", hari: "Senin", jam: "14.15 – 15.00" },
  { id: "akh-sel-1445", gender: "akhwat", hari: "Selasa", jam: "14.45 – 15.30" },
  { id: "akh-kam-1345", gender: "akhwat", hari: "Kamis", jam: "13.45 – 14.30" },
  { id: "akh-jum-1500", gender: "akhwat", hari: "Jumat", jam: "15.00 – 15.45" },
];

export const LEVELS: readonly Level[] = [
  {
    id: "dasar",
    nama: "HITS Dasar",
    untuk:
      "Belum bisa membaca Al-Qur'an, atau sudah punya dasar namun masih sangat lemah dalam pengucapan huruf, harakat, panjang-pendek, serta hukum tajwid.",
  },
  {
    id: "lanjutan",
    nama: "HITS Lanjutan",
    untuk:
      "Sudah memiliki kemampuan dasar membaca Al-Qur'an dengan baik dan telah terlepas dari kesalahan fatal, terkhusus pada huruf, harakat, dan panjang-pendek.",
  },
  {
    id: "alumni",
    nama: "Alumni HITS",
    untuk: "Pernah mengikuti HITS Dasar dan telah lulus ujian akhir program.",
  },
];

/** Label jadwal yang disimpan ke database dan dibaca admin — satu baris utuh. */
export function jadwalLabel(j: Jadwal): string {
  return `${j.gender === "ikhwan" ? "Ikhwan" : "Akhwat"} · ${j.hari}, ${j.jam} WIB · ${DAR_SYAFII.tempat}`;
}

export function findJadwal(id: string): Jadwal | undefined {
  return JADWAL.find((j) => j.id === id);
}

export function jadwalUntuk(gender: Gender | ""): readonly Jadwal[] {
  return gender ? JADWAL.filter((j) => j.gender === gender) : [];
}

export function findLevel(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

/** Tiap bagian yang dibaca di rekaman, sesuai urutan di formulir lama. */
export const TAAWUDZ = "أَعُوذُ بِٱللَّهِ مِنَ ٱلشَّيْطَـٰنِ ٱلرَّجِيمِ";
export const BASMALAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ";

/**
 * Di bawah ini rekaman patut dicurigai belum memuat seluruh bacaan. Salam,
 * ta'awudz, basmalah, dan enam ayat biasanya butuh 60–90 detik.
 *
 * Sengaja hanya PERINGATAN, bukan penolakan: formulir lama membolehkan peserta
 * yang belum bisa membaca Asy-Syura untuk cukup memperkenalkan diri dan
 * menyampaikannya — rekaman seperti itu memang pendek dan tetap sah.
 */
export const DURASI_WAJAR_MIN_SEC = 30;

export const daftarSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format email tidak valid").max(120),
  nama: z.string().trim().min(2, "Nama minimal 2 karakter").max(80),
  // Program khusus wali murid — admin memakai dua isian ini untuk memastikan
  // pendaftar memang orang tua/wali murid Darsyafii.
  nama_anak: z.string().trim().min(2, "Nama anak minimal 2 karakter").max(160),
  kelas_anak: z.string().trim().min(1, "Isi kelas anak").max(60),
  jenis_kelamin: z
    .enum(["ikhwan", "akhwat"], { message: "Konfirmasi jenis kelamin Anda" })
    .refine((g) => DAR_SYAFII.genderDibuka.includes(g), {
      message: "Pendaftaran untuk jenis kelamin ini belum dibuka",
    }),
  nomor_wa: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(WA_REGEX, "Nomor WA belum benar — ketik setelah +62, cth. 81234567890")),
  usia: z.coerce
    .number({ message: "Usia harus berupa angka" })
    .int("Usia harus bilangan bulat")
    .min(DAR_SYAFII.usiaMin, `Usia minimum ${DAR_SYAFII.usiaMin} tahun`)
    .max(100, "Usia tidak valid"),
  kota: z.string().refine(isKotaValid, "Pilih kota dari daftar"),
  jadwal: z.string().refine((id) => Boolean(findJadwal(id)), "Pilih jam belajar"),
  level: z.enum(["dasar", "lanjutan", "alumni"], { message: "Pilih level kelas" }),
});

export type DaftarInput = z.input<typeof daftarSchema>;
export type DaftarData = z.output<typeof daftarSchema>;
