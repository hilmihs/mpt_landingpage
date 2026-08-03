import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Users,
  Trophy,
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
} from "lucide-react";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { sql } from "@/lib/db";
import {
  SessionAttendanceEditor,
  type SessionRow,
  type EnrolledPeserta,
  type AttendanceMap,
} from "@/components/portal/SessionAttendanceEditor";

export const dynamic = "force-dynamic";

interface CohortDetail {
  id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  capacity: number;
  enrolled_count: number;
  teacher_id: string;
}

interface EnrollmentRow {
  id: string;
  status: string;
  completed_sessions: number;
  qualified_for_hits: boolean;
  participant_nama: string;
  participant_wa: string;
  submission_id: string;
}

async function fetchCohort(id: string): Promise<CohortDetail | null> {
  try {
    const rows = await sql<CohortDetail[]>`
      SELECT id, name, status,
             start_date::text AS start_date,
             end_date::text AS end_date,
             capacity, enrolled_count, teacher_id
        FROM cohorts
       WHERE id = ${id}
       LIMIT 1`;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function fetchSessions(cohortId: string): Promise<SessionRow[]> {
  try {
    const rows = await sql<
      {
        id: string;
        session_number: number;
        scheduled_at: Date;
        duration_min: number;
        status: string;
        meet_join_url: string | null;
      }[]
    >`
      SELECT cs.id,
             cs.session_number,
             s.scheduled_at,
             s.duration_min,
             s.status,
             s.meet_join_url
        FROM cohort_sessions cs
        JOIN slots s ON s.id = cs.slot_id
       WHERE cs.cohort_id = ${cohortId}
       ORDER BY cs.session_number ASC`;

    return rows.map((r) => ({
      id: r.id,
      session_number: r.session_number,
      scheduled_at: r.scheduled_at.toISOString(),
      duration_min: r.duration_min,
      status: r.status,
      meet_join_url: r.meet_join_url,
    }));
  } catch {
    return [];
  }
}

async function fetchEnrollments(cohortId: string): Promise<EnrollmentRow[]> {
  try {
    const rows = await sql<
      {
        id: string;
        status: string;
        completed_sessions: number;
        qualified_for_hits: boolean;
        submission_id: string;
        nama: string;
        nomor_wa: string;
      }[]
    >`
      SELECT ce.id,
             ce.status,
             ce.completed_sessions,
             ce.qualified_for_hits,
             ce.submission_id,
             sub.nama,
             sub.nomor_wa
        FROM cohort_enrollments ce
        JOIN submissions sub ON sub.id = ce.submission_id
       WHERE ce.cohort_id = ${cohortId}`;

    return rows
      .map((r) => ({
        id: r.id,
        status: r.status,
        completed_sessions: r.completed_sessions,
        qualified_for_hits: r.qualified_for_hits,
        submission_id: r.submission_id,
        participant_nama: r.nama,
        participant_wa: r.nomor_wa,
      }))
      .sort((a, b) => a.participant_nama.localeCompare(b.participant_nama));
  } catch {
    return [];
  }
}

async function fetchAttendanceMap(
  sessionIds: string[],
  submissionIds: string[],
): Promise<AttendanceMap> {
  if (sessionIds.length === 0 || submissionIds.length === 0) return {};

  const map: AttendanceMap = {};
  try {
    const rows = await sql<
      {
        cohort_session_id: string;
        submission_id: string;
        attended: boolean;
      }[]
    >`
      SELECT cohort_session_id, submission_id, attended
        FROM attendance
       WHERE cohort_session_id = ANY(${sessionIds}::uuid[])
         AND submission_id = ANY(${submissionIds}::uuid[])`;

    for (const row of rows) {
      map[`${row.cohort_session_id}:${row.submission_id}`] = row.attended;
    }
  } catch {
    return map;
  }
  return map;
}

export default async function TeacherCohortDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return null;

  const { id } = await params;
  const cohort = await fetchCohort(id);
  if (!cohort) notFound();

  // Authorization: teacher only sees their own cohorts
  if (cohort.teacher_id !== teacher.teacherId) {
    redirect("/portal-mpt-x7/cohorts");
  }

  const [sessions, enrollments] = await Promise.all([
    fetchSessions(id),
    fetchEnrollments(id),
  ]);

  const peserta: EnrolledPeserta[] = enrollments
    .filter((e) => e.status !== "dropped")
    .map((e) => ({
      submission_id: e.submission_id,
      nama: e.participant_nama,
      nomor_wa: e.participant_wa,
    }));

  const attendance = await fetchAttendanceMap(
    sessions.map((s) => s.id),
    peserta.map((p) => p.submission_id),
  );

  const qualifiedCount = enrollments.filter((e) => e.qualified_for_hits).length;
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/portal-mpt-x7/cohorts"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--ink-mute)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={13} strokeWidth={2.4} />
          Cohort Saya
        </Link>
      </div>

      <header style={{ marginBottom: 28 }}>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(22px, 3vw, 30px)",
            fontWeight: 800,
            margin: 0,
            letterSpacing: "-0.025em",
            marginBottom: 8,
          }}
        >
          {cohort.name}
        </h1>
        <div
          style={{
            display: "flex",
            gap: 16,
            fontSize: 13,
            color: "var(--ink-soft)",
            flexWrap: "wrap",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Calendar size={13} strokeWidth={2.2} />
            {fmtDate(cohort.start_date)} – {fmtDate(cohort.end_date)}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Users size={13} strokeWidth={2.2} />
            {cohort.enrolled_count}/{cohort.capacity} peserta
          </span>
          {qualifiedCount > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                color: "var(--success)",
                fontWeight: 600,
              }}
            >
              <Trophy size={13} strokeWidth={2.4} />
              {qualifiedCount} lulus
            </span>
          )}
        </div>
      </header>

      <section style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 12 }}>
          <h2
            className="font-display"
            style={{
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Jadwal & Kehadiran
          </h2>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "4px 0 0" }}>
            Klik sesi yang sudah lewat untuk review/override kehadiran peserta.
            Otomatis ter-record via Google Meet setelah meeting selesai.
          </p>
        </div>
        <SessionAttendanceEditor
          sessions={sessions}
          peserta={peserta}
          attendance={attendance}
          nowMs={nowMs}
        />
      </section>

      <section>
        <h2
          className="font-display"
          style={{
            fontSize: 18,
            fontWeight: 700,
            margin: "0 0 12px",
            letterSpacing: "-0.02em",
          }}
        >
          Peserta ({enrollments.length})
        </h2>
        {enrollments.length === 0 ? (
          <div
            className="card-mpt"
            style={{ padding: "24px 22px", textAlign: "center", color: "var(--ink-soft)" }}
          >
            <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              Belum ada peserta yang enroll.
            </p>
          </div>
        ) : (
          <div className="card-mpt" style={{ padding: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead>
                <tr style={{ background: "var(--surface-soft)" }}>
                  <Th>Peserta</Th>
                  <Th>Kontak</Th>
                  <Th>Hadir</Th>
                  <Th>HITS</Th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e) => (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <Td bold>{e.participant_nama}</Td>
                    <Td>{e.participant_wa}</Td>
                    <Td>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color:
                            e.completed_sessions >= 3
                              ? "var(--success)"
                              : "var(--ink)",
                        }}
                      >
                        {e.completed_sessions}/4
                      </span>
                    </Td>
                    <Td>
                      {e.qualified_for_hits ? (
                        <CheckCircle2 size={15} strokeWidth={2.4} color="var(--success)" />
                      ) : (
                        <CircleHelp size={15} strokeWidth={2.2} color="var(--ink-mute)" />
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "10px 16px",
        textAlign: "left",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-mute)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  bold = false,
}: {
  children: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <td
      style={{
        padding: "12px 16px",
        fontSize: 13,
        color: "var(--ink)",
        fontWeight: bold ? 600 : 400,
      }}
    >
      {children}
    </td>
  );
}

function fmtDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
