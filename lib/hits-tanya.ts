import { sql } from "@/lib/db";
import { DAR_SYAFII } from "@/lib/hits-dar-syafii";

/**
 * Bacaan tanya-jawab HITS Darsyafii untuk halaman publik. Nama dan nomor
 * penanya tidak pernah dipilih di sini untuk FAQ.
 */

export interface FaqRow {
  id: string;
  pertanyaan: string;
  jawaban: string;
}

/**
 * FAQ untuk halaman pendaftaran. Gagal membaca database tidak boleh
 * menjatuhkan halaman pendaftaran — tanpa FAQ pun orang tetap bisa mendaftar.
 */
export async function fetchFaq(): Promise<FaqRow[]> {
  try {
    return await sql<FaqRow[]>`
      SELECT id, pertanyaan, jawaban
        FROM hits_pertanyaan
       WHERE program = ${DAR_SYAFII.program}
         AND tampil_faq
         AND jawaban IS NOT NULL
       ORDER BY dijawab_at DESC
       LIMIT 20
    `;
  } catch (err) {
    console.error("[hits-tanya] gagal membaca FAQ", err);
    return [];
  }
}

export interface PertanyaanPublik {
  nama: string;
  pertanyaan: string;
  jawaban: string | null;
  created_at: Date;
  dijawab_at: Date | null;
}

export async function fetchPertanyaanBySlug(slug: string): Promise<PertanyaanPublik | null> {
  if (!/^[A-Za-z0-9_-]{12}$/.test(slug)) return null;
  const rows = await sql<PertanyaanPublik[]>`
    SELECT nama, pertanyaan, jawaban, created_at, dijawab_at
      FROM hits_pertanyaan
     WHERE slug = ${slug}
       AND program = ${DAR_SYAFII.program}
     LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Jumlah pertanyaan yang belum dijawab — untuk badge di menu admin. */
export async function countBelumDijawab(): Promise<number> {
  try {
    const rows = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n
        FROM hits_pertanyaan
       WHERE program = ${DAR_SYAFII.program}
         AND jawaban IS NULL
    `;
    return rows[0]?.n ?? 0;
  } catch (err) {
    // Badge bukan alasan menjatuhkan seluruh panel admin.
    console.error("[hits-tanya] gagal menghitung pertanyaan", err);
    return 0;
  }
}
