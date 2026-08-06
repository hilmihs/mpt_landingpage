import { sql } from "@/lib/db";

/**
 * Pandangan admin atas satu rekaman peserta: siapa pengajarnya, sudah sampai
 * mana, dan sudah berapa lama menunggu.
 *
 * Sebelum berkas ini ada, admin tidak punya permukaan apa pun yang
 * menghubungkan submissions dengan assignments dan teacher_evaluations. Angka
 * di Overview bisa memberi tahu "5 rekaman belum selesai" tapi tidak pernah
 * bisa menjawab rekaman yang mana, di tangan siapa, dan macet karena apa.
 */

/**
 * Ambang rekaman dianggap macet. Disamakan dengan STALE_DAYS di portal pengajar
 * (app/portal-mpt-x7/(authed)/tugas/page.tsx) — kalau dua permukaan memakai
 * ambang berbeda, admin dan pengajar akan berbeda pendapat soal mana yang
 * terlambat, dan tidak ada cara memutuskan siapa yang benar.
 */
export const STALE_DAYS = 3;
export const STALE_SEC = STALE_DAYS * 24 * 60 * 60;

/**
 * Tahap satu rekaman dalam alur penilaian pengajar.
 *
 * Sengaja TERPISAH dari submissions.status (pending/processing/completed/
 * failed), yang menggambarkan pipeline worker AI. Keduanya bergerak sendiri:
 * satu rekaman bisa `failed` di sisi mesin sementara pengajar menilainya
 * dengan sempurna.
 */
export type Tahap =
  | "perlu_penugasan"
  | "wa_gagal"
  | "wa_tertunda"
  | "menunggu_dibuka"
  | "sedang_dinilai"
  | "selesai_tanpa_nilai"
  | "selesai";

export const TAHAP_LABEL: Record<Tahap, string> = {
  perlu_penugasan: "Perlu penugasan",
  wa_gagal: "WA gagal",
  wa_tertunda: "WA tertunda",
  menunggu_dibuka: "Menunggu dibuka",
  sedang_dinilai: "Sedang dinilai",
  selesai_tanpa_nilai: "Selesai tanpa nilai",
  selesai: "Selesai",
};

export const TAHAP_COLOR: Record<Tahap, string> = {
  perlu_penugasan: "var(--danger)",
  wa_gagal: "var(--danger)",
  wa_tertunda: "var(--warning)",
  menunggu_dibuka: "var(--warning)",
  sedang_dinilai: "var(--accent)",
  selesai_tanpa_nilai: "var(--warning)",
  selesai: "var(--success)",
};

/** Urutan tampil: yang paling butuh tindakan admin di atas. */
export const TAHAP_ORDER: Tahap[] = [
  "perlu_penugasan",
  "wa_gagal",
  "wa_tertunda",
  "menunggu_dibuka",
  "sedang_dinilai",
  "selesai_tanpa_nilai",
  "selesai",
];

export interface AssessmentRow {
  submission_id: string;
  nama: string;
  jenis_kelamin: "ikhwan" | "akhwat";
  nomor_wa: string;
  created_at: Date;
  ai_status: string;
  rapot_slug: string | null;
  audio_path: string;
  durasi_sec: number | null;
  peserta_wa_sent_at: Date | null;
  peserta_wa_error: string | null;

  assignment_id: string | null;
  assignment_status: string | null;
  assigned_at: Date | null;
  wa_sent_at: Date | null;
  wa_error: string | null;
  wa_attempts: number | null;
  opened_at: Date | null;
  completed_at: Date | null;
  teacher_id: string | null;

  pengajar_nama: string | null;
  pengajar_wa: string | null;
  pengajar_status: string | null;
  pengajar_fallback: boolean;

  score_min: number | null;
  label_min: string | null;
  eval_source: string | null;
  eval_at: Date | null;

  ai_skor: number | null;

  tahap: Tahap;
  menunggu_sec: number;
  macet: boolean;
}

/**
 * CTE dasar yang dipakai daftar maupun halaman detail.
 *
 * WAJIB berupa fungsi, bukan konstanta tingkat modul. `sql` adalah Proxy yang
 * baru membaca DATABASE_URL saat dipanggil (lib/db.ts:87); membangun fragmen
 * saat impor berarti `next build` menyentuh env yang belum ada dan gagal
 * dengan "Missing DATABASE_URL" — persis yang dicegah lib/db.ts:23-30.
 */
function assessmentBase() {
  return sql`
    WITH b AS (
      SELECT
        s.id                          AS submission_id,
        s.nama,
        s.jenis_kelamin,
        s.nomor_wa,
        s.created_at,
        s.ai_status,
        s.rapot_slug,
        s.audio_path,
        s.audio_duration_sec::float8  AS durasi_sec,
        s.peserta_wa_sent_at,
        s.peserta_wa_error,

        a.assignment_id,
        a.assignment_status,
        a.assigned_at,
        a.wa_sent_at,
        a.wa_error,
        a.wa_attempts,
        a.opened_at,
        a.completed_at,
        a.teacher_id,

        COALESCE(t.nama,     a.teacher_nama) AS pengajar_nama,
        COALESCE(t.nomor_wa, a.teacher_wa)   AS pengajar_wa,
        t.status                             AS pengajar_status,
        (a.assignment_id IS NOT NULL AND a.teacher_id IS NULL) AS pengajar_fallback,

        e.score_min,
        e.label_min,
        e.source     AS eval_source,
        e.created_at AS eval_at,

        ai.score_min AS ai_skor,

        CASE
          WHEN e.submission_id IS NOT NULL       THEN 'selesai'
          WHEN a.assignment_id IS NULL           THEN 'perlu_penugasan'
          WHEN a.assignment_status = 'failed'    THEN 'perlu_penugasan'
          WHEN a.assignment_status = 'completed' THEN 'selesai_tanpa_nilai'
          WHEN a.assignment_status = 'opened'    THEN 'sedang_dinilai'
          WHEN a.assignment_status = 'notified'  THEN 'menunggu_dibuka'
          WHEN a.wa_error IS NOT NULL            THEN 'wa_gagal'
          ELSE                                        'wa_tertunda'
        END AS tahap,

        -- Selisih waktu dihitung Postgres, bukan Node: assigned_at ditulis
        -- dengan jam Postgres, jadi membandingkannya dengan jam aplikasi
        -- menghasilkan "menunggu -2 menit" begitu kedua mesin sedikit berbeda.
        EXTRACT(EPOCH FROM (now() - COALESCE(a.assigned_at, s.created_at)))::float8
          AS menunggu_sec

      FROM submissions s

      -- LATERAL, bukan JOIN biasa: sesudah pemindahan satu submission punya
      -- beberapa baris assignment, dan JOIN biasa akan menggandakan barisnya
      -- di daftar. Yang aktif menang; kalau tidak ada, ambil yang terbaru.
      LEFT JOIN LATERAL (
        SELECT x.id AS assignment_id, x.status AS assignment_status,
               x.teacher_id, x.teacher_nama, x.teacher_wa, x.assigned_at,
               x.wa_sent_at, x.wa_error, x.wa_attempts, x.opened_at, x.completed_at
        FROM assignments x
        WHERE x.submission_id = s.id
        ORDER BY (x.status NOT IN ('completed','failed')) DESC, x.assigned_at DESC
        LIMIT 1
      ) a ON TRUE

      LEFT JOIN teachers t ON t.id = a.teacher_id
      -- teacher_evaluations.submission_id UNIK (0008:22) → JOIN biasa aman.
      LEFT JOIN teacher_evaluations e ON e.submission_id = s.id
      -- ai_evaluations.submission_id UNIK (0010) → JOIN biasa aman.
      -- Skalanya kini SAMA dengan e.score_min: keduanya 1-10 dari rubrik yang
      -- sama, jadi ai_skor dan score_min memang boleh disandingkan.
      LEFT JOIN ai_evaluations ai ON ai.submission_id = s.id
    )
  `;
}

export interface AssessmentFilter {
  tahap?: Tahap;
  gender?: "ikhwan" | "akhwat";
  /** UUID pengajar, atau "fallback" untuk baris yang jatuh ke superadmin. */
  pengajar?: string;
  macet?: boolean;
  q?: string;
}

const LIST_LIMIT = 200;

/**
 * Daftar rekaman untuk halaman admin, terurut menurut kebutuhan tindakan.
 *
 * Melempar kalau database bermasalah; pemanggil yang memutuskan cara
 * menampilkannya.
 */
export async function fetchAssessments(
  f: AssessmentFilter,
): Promise<AssessmentRow[]> {
  const fallbackOnly = f.pengajar === "fallback";
  const teacherId = fallbackOnly ? undefined : f.pengajar;

  const rows = await sql<AssessmentRow[]>`
    ${assessmentBase()}
    SELECT b.*, (b.tahap <> 'selesai' AND b.menunggu_sec >= ${STALE_SEC}) AS macet
    FROM b
    WHERE TRUE
      ${f.tahap ? sql`AND b.tahap = ${f.tahap}` : sql``}
      ${f.gender ? sql`AND b.jenis_kelamin = ${f.gender}` : sql``}
      ${teacherId ? sql`AND b.teacher_id = ${teacherId}` : sql``}
      ${fallbackOnly ? sql`AND b.assignment_id IS NOT NULL AND b.teacher_id IS NULL` : sql``}
      ${f.macet ? sql`AND b.tahap <> 'selesai' AND b.menunggu_sec >= ${STALE_SEC}` : sql``}
      ${
        f.q
          ? sql`AND (b.nama ILIKE ${"%" + f.q + "%"} OR b.nomor_wa ILIKE ${"%" + f.q + "%"})`
          : sql``
      }
    ORDER BY
      CASE b.tahap
        WHEN 'perlu_penugasan'     THEN 0
        WHEN 'wa_gagal'            THEN 1
        WHEN 'wa_tertunda'         THEN 2
        WHEN 'menunggu_dibuka'     THEN 3
        WHEN 'sedang_dinilai'      THEN 4
        WHEN 'selesai_tanpa_nilai' THEN 5
        ELSE 6
      END,
      b.menunggu_sec DESC
    LIMIT ${LIST_LIMIT}
  `;
  return rows;
}

/** Satu baris untuk halaman detail. */
export async function fetchAssessment(
  submissionId: string,
): Promise<AssessmentRow | null> {
  const rows = await sql<AssessmentRow[]>`
    ${assessmentBase()}
    SELECT b.*, (b.tahap <> 'selesai' AND b.menunggu_sec >= ${STALE_SEC}) AS macet
    FROM b
    WHERE b.submission_id = ${submissionId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Cacah per tahap untuk chip filter.
 *
 * Sengaja TIDAK ikut menyaring: chip harus tetap menampilkan angka keseluruhan
 * walau salah satu tahap sedang dipilih, kalau tidak semua chip lain jadi nol
 * dan admin kehilangan jalan kembali.
 */
export async function countByTahap(): Promise<Record<string, number>> {
  // count(*) bertipe bigint dan postgres.js mengembalikannya sebagai string —
  // ::int wajib supaya yang sampai ke React benar-benar number.
  const rows = await sql<{ tahap: string; n: number }[]>`
    ${assessmentBase()}
    SELECT b.tahap, count(*)::int AS n FROM b GROUP BY b.tahap
  `;
  const out: Record<string, number> = {};
  for (const r of rows) out[r.tahap] = r.n;
  return out;
}

/** Jarak waktu kasar; angka presisi tidak menolong admin mengambil keputusan. */
export function sinceLabel(detik: number): string {
  const menit = Math.floor(detik / 60);
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam`;
  return `${Math.floor(jam / 24)} hari`;
}

/** Ambang warna mengikuti band 1-10 yang dipakai di rapot peserta. */
export function bandColor(score: number): string {
  if (score <= 2) return "var(--danger)";
  if (score <= 6) return "var(--warning)";
  if (score <= 8) return "var(--accent)";
  return "var(--success)";
}
