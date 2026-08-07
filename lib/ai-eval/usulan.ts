import { sql } from "@/lib/db";
import { projectToEvaluationAyat } from "@/lib/ai-eval/project";
import { EVALUATION_OPTIONS } from "@/lib/teacher-eval/catalog";
import { SEGMENT_KEYS, type EvaluationAyat, type SegmentKey } from "@/lib/teacher-eval/types";
import type { ErrorItem, MLPredictResult } from "@/types";

type FieldTemuan =
  | "errors_harakat"
  | "errors_ketepatan_huruf"
  | "errors_panjang_pendek"
  | "errors_tasydid"
  | "errors_hukum_tajwid";

const KATEGORI_KE_FIELD: Record<string, FieldTemuan> = {
  harakat: "errors_harakat",
  ketepatan_huruf: "errors_ketepatan_huruf",
  panjang_pendek: "errors_panjang_pendek",
  tasydid: "errors_tasydid",
  hukum_tajwid: "errors_hukum_tajwid",
};

/**
 * Usulan mesin untuk formulir pengajar.
 *
 * Aturan yang tidak boleh dilanggar, dan alasannya:
 *
 * 1. TIDAK PRA-CENTANG. Usulan cuma ditandai; pengajar sendiri yang mencentang.
 *    Kalau sudah tercentang duluan, orang cenderung menerima saja — dan mutu
 *    penilaian turun tanpa terlihat, karena penilaiannya jadi sepakat dengan
 *    mesin secara konstruksi.
 *
 * 2. HANYA YANG BERNAMA. Temuan mesin yang tidak punya padanan opsi katalog
 *    tidak ditampilkan sama sekali. Tanpa kotak untuk dicentang, ia cuma
 *    kalimat asing yang harus dibaca pengajar tanpa bisa ditindaklanjuti.
 *
 * 3. SEBAGIAN TIDAK DIBERI USULAN. Lihat db/migrations/0011_usulan_mesin.sql.
 */

export type KelompokUsulan = "diberi_usulan" | "pembanding";

/** Bagian rekaman yang sengaja tidak diberi usulan, sebagai pembanding. */
export const PORSI_PEMBANDING = 0.5;

/**
 * Kelompok satu rekaman. Ditentukan dari submission_id, bukan diundi.
 *
 * Sengaja deterministik: halaman penilaian bisa dibuka berkali-kali, dan
 * penugasan bisa dialihkan ke pengajar lain. Kalau diundi tiap kali tampil,
 * pengajar yang sama bisa melihat usulan lalu kehilangannya saat menyegarkan
 * halaman — membingungkan, dan pembandingnya jadi tidak sahih.
 */
export function kelompokUntuk(submissionId: string): KelompokUsulan {
  // FNV-1a, cukup untuk membagi rata dan tidak perlu kriptografis.
  let h = 0x811c9dc5;
  for (let i = 0; i < submissionId.length; i++) {
    h ^= submissionId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const pecahan = (h >>> 0) / 0x100000000;
  return pecahan < PORSI_PEMBANDING ? "pembanding" : "diberi_usulan";
}

/** Kumpulan kalimat opsi katalog yang sah, untuk menyaring usulan. */
const OPSI_SAH: ReadonlySet<string> = new Set(
  SEGMENT_KEYS.flatMap((s) => [
    ...EVALUATION_OPTIONS[s].jaliy,
    ...EVALUATION_OPTIONS[s].khafiy,
  ]),
);

export interface UsulanMesin {
  kelompok: KelompokUsulan;
  /** Kalimat opsi katalog per segmen. Kosong kalau tidak ada usulan. */
  perSegmen: Record<SegmentKey, string[]>;
  /** Semua kalimat yang diusulkan, untuk dicatat saat pengajar mengirim. */
  semua: string[];
}

function kosong(kelompok: KelompokUsulan): UsulanMesin {
  const perSegmen = SEGMENT_KEYS.reduce(
    (acc, k) => {
      acc[k] = [];
      return acc;
    },
    {} as Record<SegmentKey, string[]>,
  );
  return { kelompok, perSegmen, semua: [] };
}

/** Saring hasil proyeksi ke kalimat yang benar-benar ada di katalog. */
function hanyaBernama(ayat: EvaluationAyat): Record<SegmentKey, string[]> {
  return SEGMENT_KEYS.reduce(
    (acc, k) => {
      acc[k] = [...ayat[k].jaliy, ...ayat[k].khafiy].filter((s) => OPSI_SAH.has(s));
      return acc;
    },
    {} as Record<SegmentKey, string[]>,
  );
}

/**
 * Ambil usulan untuk satu rekaman.
 *
 * Mengembalikan usulan kosong — bukan melempar — kalau mesin belum punya hasil
 * atau tabelnya belum ada. Penilaian pengajar tidak boleh terhalang oleh
 * ketiadaan mesin; mesin ini pembantu, bukan prasyarat.
 */
export async function ambilUsulan(submissionId: string): Promise<UsulanMesin> {
  const kelompok = kelompokUntuk(submissionId);
  if (kelompok === "pembanding") return kosong(kelompok);

  let baris: { findings: unknown; ml_model_version: string }[] = [];
  try {
    baris = await sql`
      SELECT findings, ml_model_version
      FROM ai_evaluations
      WHERE submission_id = ${submissionId}
      LIMIT 1
    `;
  } catch (err) {
    console.error("[usulan] gagal membaca ai_evaluations:", (err as Error).message);
    return kosong(kelompok);
  }

  const row = baris[0];
  if (!row) return kosong(kelompok);
  // Baris mock berisi bilangan acak. Menampilkannya ke pengajar berarti
  // meminta ia menilai berdasarkan tebakan generator acak.
  if ((row.ml_model_version ?? "").startsWith("mock")) return kosong(kelompok);

  const findings: ErrorItem[] = Array.isArray(row.findings) ? row.findings : [];
  if (findings.length === 0) return kosong(kelompok);

  // `findings` menyimpan kelima kategori sebagai satu daftar datar, jadi
  // dikembalikan ke bentuk MLPredictResult lewat `kategori` yang dibawa tiap
  // temuan. Sebagian aturan pencocokan katalog menyaring berdasarkan kategori
  // — tanpa pengelompokan ini, temuan tasydid dan harakat tidak akan cocok.
  const hasil: MLPredictResult = {
    errors_harakat: [],
    errors_ketepatan_huruf: [],
    errors_panjang_pendek: [],
    errors_tasydid: [],
    errors_hukum_tajwid: [],
    ml_model_version: row.ml_model_version,
    ml_confidence: 0,
  };
  for (const f of findings) {
    const kunci = KATEGORI_KE_FIELD[f.kategori ?? ""] ?? "errors_ketepatan_huruf";
    hasil[kunci].push(f);
  }

  const { ayat } = projectToEvaluationAyat(hasil);
  const perSegmen = hanyaBernama(ayat);
  return {
    kelompok,
    perSegmen,
    semua: SEGMENT_KEYS.flatMap((k) => perSegmen[k]),
  };
}
