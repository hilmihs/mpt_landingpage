import Link from "next/link";
import { GraduationCap, Users, Calendar, Trophy } from "lucide-react";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { supabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface CohortRow {
  id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  capacity: number;
  enrolled_count: number;
  session_count: number;
  qualified_count: number;
}

const STATUS_COLOR: Record<string, string> = {
  open: "var(--success)",
  closed: "var(--warning)",
  in_progress: "var(--accent)",
  completed: "var(--ink-mute)",
  cancelled: "var(--danger)",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  in_progress: "Berjalan",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

async function fetchTeacherCohorts(teacherId: string): Promise<CohortRow[]> {
  const sb = supabaseService();
  try {
    const { data } = await sb
      .from("cohorts")
      .select(
        `id, name, status, start_date, end_date, capacity, enrolled_count,
         cohort_sessions(count),
         cohort_enrollments(qualified_for_hits)`,
      )
      .eq("teacher_id", teacherId)
      .order("start_date", { ascending: false });

    const rows = (data ?? []) as unknown as {
      id: string;
      name: string;
      status: string;
      start_date: string;
      end_date: string;
      capacity: number;
      enrolled_count: number;
      cohort_sessions: { count: number }[];
      cohort_enrollments: { qualified_for_hits: boolean }[];
    }[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      start_date: r.start_date,
      end_date: r.end_date,
      capacity: r.capacity,
      enrolled_count: r.enrolled_count,
      session_count: r.cohort_sessions?.[0]?.count ?? 0,
      qualified_count:
        r.cohort_enrollments?.filter((e) => e.qualified_for_hits).length ?? 0,
    }));
  } catch {
    return [];
  }
}

export default async function CohortsPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) return null;

  const cohorts = await fetchTeacherCohorts(teacher.teacherId);

  return (
    <div style={{ maxWidth: 880 }}>
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
          Cohort Saya
        </h1>
      </header>

      {cohorts.length === 0 ? (
        <div
          className="card-mpt"
          style={{ padding: "48px 28px", textAlign: "center" }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 16px",
              borderRadius: 14,
              background: "color-mix(in oklab, var(--accent), transparent 85%)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <GraduationCap size={24} strokeWidth={2.2} />
          </div>
          <h2
            className="font-display"
            style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}
          >
            Belum ada cohort
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-soft)",
              lineHeight: 1.6,
              maxWidth: 420,
              margin: "0 auto",
            }}
          >
            Admin akan membuat cohort dan menugaskan Anda sebagai pengajar.
            Setelah itu, cohort akan muncul di sini.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cohorts.map((c) => {
            const statusColor = STATUS_COLOR[c.status] ?? "var(--ink-mute)";
            return (
              <Link
                key={c.id}
                href={`/portal-mpt-x7/cohorts/${c.id}`}
                className="card-mpt"
                style={{
                  padding: "16px 20px",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 14,
                  alignItems: "center",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 5,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--ink)",
                      }}
                    >
                      {c.name}
                    </div>
                    <span
                      style={{
                        padding: "2px 8px",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        borderRadius: 5,
                        background: `color-mix(in oklab, ${statusColor}, transparent 85%)`,
                        color: statusColor,
                      }}
                    >
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-soft)",
                      display: "flex",
                      gap: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={11} strokeWidth={2.2} />
                      {fmtDate(c.start_date)} – {fmtDate(c.end_date)}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Users size={11} strokeWidth={2.2} />
                      {c.enrolled_count}/{c.capacity}
                    </span>
                    {c.qualified_count > 0 && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "var(--success)",
                          fontWeight: 600,
                        }}
                      >
                        <Trophy size={11} strokeWidth={2.4} />
                        {c.qualified_count} lulus
                      </span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--accent)",
                  }}
                >
                  Detail →
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fmtDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}
