import { supabaseService } from "@/lib/supabase";
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
  const sb = supabaseService();
  try {
    const { data } = await sb
      .from("cohorts")
      .select(
        `id, name, status, gender_target, start_date, end_date, capacity, enrolled_count, teacher_id,
         teachers:teacher_id(nama),
         cohort_sessions(count)`,
      )
      .order("start_date", { ascending: false });

    const rows = (data ?? []) as unknown as {
      id: string;
      name: string;
      status: string;
      gender_target: string;
      start_date: string;
      end_date: string;
      capacity: number;
      enrolled_count: number;
      teacher_id: string;
      teachers: { nama: string } | null;
      cohort_sessions: { count: number }[];
    }[];

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
      teacher_nama: r.teachers?.nama ?? "—",
      session_count: r.cohort_sessions?.[0]?.count ?? 0,
    }));
  } catch {
    return [];
  }
}

async function fetchActiveTeachers(): Promise<Teacher[]> {
  const sb = supabaseService();
  try {
    const { data } = await sb
      .from("teachers")
      .select("id, nama, jenis_kelamin")
      .eq("status", "active")
      .order("nama", { ascending: true });
    return (data ?? []) as Teacher[];
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
