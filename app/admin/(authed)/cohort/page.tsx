import { sql } from "@/lib/db";
import { CohortManager } from "@/components/admin/CohortManager";

export const dynamic = "force-dynamic";

interface CohortRow {
  id: string;
  name: string;
  status: string;
  gender_target: string;
  start_date: string;
  end_date: string;
  capacity: number;
  enrolled_count: number;
  teacher_nama: string;
  teacher_id: string;
  session_count: number;
}

interface Teacher {
  id: string;
  nama: string;
  jenis_kelamin: "ikhwan" | "akhwat";
}

async function fetchCohorts(): Promise<CohortRow[]> {
  try {
    const rows = await sql<
      {
        id: string;
        name: string;
        status: string;
        gender_target: string;
        start_date: string;
        end_date: string;
        capacity: number;
        enrolled_count: number;
        teacher_id: string;
        teacher_nama: string | null;
        session_count: number;
      }[]
    >`
      SELECT c.id, c.name, c.status, c.gender_target,
             to_char(c.start_date, 'YYYY-MM-DD') AS start_date,
             to_char(c.end_date, 'YYYY-MM-DD') AS end_date,
             c.capacity, c.enrolled_count, c.teacher_id,
             t.nama AS teacher_nama,
             (SELECT count(*) FROM cohort_sessions cs WHERE cs.cohort_id = c.id)::int
               AS session_count
      FROM cohorts c
      LEFT JOIN teachers t ON t.id = c.teacher_id
      ORDER BY c.start_date DESC
    `;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      gender_target: r.gender_target,
      start_date: r.start_date,
      end_date: r.end_date,
      capacity: r.capacity,
      enrolled_count: r.enrolled_count,
      teacher_id: r.teacher_id,
      teacher_nama: r.teacher_nama ?? "—",
      session_count: r.session_count ?? 0,
    }));
  } catch {
    return [];
  }
}

async function fetchActiveTeachers(): Promise<Teacher[]> {
  try {
    const rows = await sql<Teacher[]>`
      SELECT id, nama, jenis_kelamin
      FROM teachers
      WHERE status = ${"active"}
      ORDER BY nama ASC
    `;
    return rows;
  } catch {
    return [];
  }
}

export default async function CohortAdminPage() {
  const [cohorts, teachers] = await Promise.all([
    fetchCohorts(),
    fetchActiveTeachers(),
  ]);

  return (
    <div style={{ maxWidth: 1080 }}>
      <header style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
            marginBottom: 6,
          }}
        >
          Tahsin Al-Fatihah
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(24px, 3.5vw, 32px)",
            fontWeight: 800,
            margin: 0,
            letterSpacing: "-0.025em",
          }}
        >
          Manajemen Cohort
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            margin: "6px 0 0",
            maxWidth: 600,
          }}
        >
          Setiap cohort terdiri dari 4 sesi × 90 menit, kapasitas 12 peserta,
          gender-matched. Pilih 4 slot Tahsin yang sudah di-generate untuk
          mengikatnya jadi cohort.
        </p>
      </header>

      <CohortManager initialCohorts={cohorts} teachers={teachers} />
    </div>
  );
}
