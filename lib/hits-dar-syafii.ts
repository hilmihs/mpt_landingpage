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
 * didengarkan admin/pengajar — dan hanya untuk level HITS Lanjutan (lihat
 * perluRekaman).
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
  /** Kelas berlangsung di masjid, bukan di gedung sekolah. */
  tempat: "Masjid Dar Syafi'i",
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

/**
 * Setoran rekaman hanya untuk HITS Lanjutan — pengajar perlu mendengar apakah
 * pendaftar memang sudah lepas dari kesalahan fatal. HITS Dasar dan Alumni
 * HITS langsung ditempatkan tanpa ujian masuk.
 */
export function perluRekaman(level: string): boolean {
  return level === "lanjutan";
}

/**
 * Aturan penempatan yang harus diketahui pendaftar SEJAK AWAL: pendaftar
 * Lanjutan yang dinilai lajnah masih buta huruf otomatis masuk HITS Dasar
 * (lihat levelPenempatan). Tampil di pembuka, langkah pilih level, dan WA
 * konfirmasi. Istilah "lahn" sengaja tidak dipakai untuk peserta.
 */
export const CATATAN_PENEMPATAN =
  "Rekaman HITS Lanjutan didengarkan pengajar. Bila bacaan masih memiliki kesalahan fatal, Anda ditempatkan di kelas HITS Dasar.";

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

// ---------------------------------------------------------------------------
// Penilaian rekaman oleh lajnah (admin)
// ---------------------------------------------------------------------------

/**
 * Ambang formula di spreadsheet lajnah: `=IF(L7 > 5, "Buta Huruf", …)`.
 * Hasil formula hanya PEMBANDING di halaman admin — yang menentukan
 * penempatan adalah pilihan manual lajnah (kolom `buta_huruf`).
 */
export const BATAS_JALIY_BUTA_HURUF = 5;

/** Label pilihan persis seperti dropdown di spreadsheet; hanya untuk admin. */
export const LABEL_BUTA_HURUF = { ya: "Buta Huruf", tidak: "Tidak Buta Huruf/Pemula" } as const;

export function formulaButaHuruf(lahnJaliy: number | null): boolean | null {
  if (lahnJaliy === null) return null;
  return lahnJaliy > BATAS_JALIY_BUTA_HURUF;
}

/**
 * Kelas yang benar-benar diikuti. Sama dengan kolom generated
 * `level_penempatan` (migrasi 0015) — database yang jadi sumber kebenaran,
 * fungsi ini untuk menampilkan hasilnya sebelum disimpan.
 */
export function levelPenempatan(level: string, butaHuruf: boolean | null): string {
  return level === "lanjutan" && butaHuruf === true ? "dasar" : level;
}

const jumlahLahn = (nama: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, `Isi jumlah ${nama} dengan angka 0–999`)
    .transform(Number);

export const penilaianSchema = z.object({
  id: z.uuid(),
  lahn_jaliy: jumlahLahn("lahn jaliy"),
  lahn_khofi: jumlahLahn("lahn khofi"),
  buta_huruf: z
    .enum(["ya", "tidak"], { message: "Pilih Buta Huruf atau Tidak Buta Huruf/Pemula" })
    .transform((v) => v === "ya"),
  keterangan: z
    .string()
    .trim()
    .max(500, "Keterangan maksimal 500 karakter")
    .transform((v) => (v === "" ? null : v)),
});

export type PenilaianInput = z.input<typeof penilaianSchema>;

// ---------------------------------------------------------------------------
// Tanya-jawab (pengganti "tanya lewat WA admin")
// ---------------------------------------------------------------------------

export const tanyaSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter").max(80),
  nomor_wa: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(WA_REGEX, "Nomor WA belum benar, cth. 081234567890")),
  pertanyaan: z
    .string()
    .trim()
    .min(5, "Tulis pertanyaan Anda minimal 5 karakter")
    .max(1000, "Pertanyaan maksimal 1000 karakter"),
});

export type TanyaInput = z.input<typeof tanyaSchema>;

export const jawabSchema = z.object({
  id: z.uuid(),
  jawaban: z.string().trim().min(1, "Jawaban belum diisi").max(3000, "Jawaban maksimal 3000 karakter"),
  tampil_faq: z.boolean(),
});

/** Halaman tempat penanya membaca jawaban — tautannya dikirim lewat WhatsApp. */
export function tanyaPath(slug: string): string {
  return `/daftar-hits/dar-syafii/tanya/${slug}`;
}
