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
import { supabaseService } from "@/lib/supabase";
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
  const sb = supabaseService();
  const { data } = await sb
    .from("cohorts")
    .select("id, name, status, start_date, end_date, capacity, enrolled_count, teacher_id")
    .eq("id", id)
    .maybeSingle();
  return (data as CohortDetail | null) ?? null;
}

async function fetchSessions(cohortId: string): Promise<SessionRow[]> {
  const sb = supabaseService();
  const { data } = await sb
    .from("cohort_sessions")
    .select(
      `id, session_number,
       slots:slot_id(scheduled_at, duration_min, status, zoom_join_url)`,
    )
    .eq("cohort_id", cohortId)
    .order("session_number", { ascending: true });

  const rows = (data ?? []) as unknown as {
    id: string;
    session_number: number;
    slots: {
      scheduled_at: string;
      duration_min: number;
      status: string;
      zoom_join_url: string | null;
    } | null;
  }[];

  return rows
    .filter((r) => r.slots)
    .map((r) => ({
      id: r.id,
      session_number: r.session_number,
      scheduled_at: r.slots!.scheduled_at,
      duration_min: r.slots!.duration_min,
      status: r.slots!.status,
      zoom_join_url: r.slots!.zoom_join_url,
    }));
}

async function fetchEnrollments(cohortId: string): Promise<EnrollmentRow[]> {
  const sb = supabaseService();
  const { data } = await sb
    .from("cohort_enrollments")
    .select(
      `id, status, completed_sessions, qualified_for_hits, submission_id,
       submissions:submission_id(nama, nomor_wa)`,
    )
    .eq("cohort_id", cohortId);

  const rows = (data ?? []) as unknown as {
    id: string;
    status: string;
    completed_sessions: number;
    qualified_for_hits: boolean;
    submission_id: string;
    submissions: { nama: string; nomor_wa: string } | null;
  }[];

  return rows
    .filter((r) => r.submissions)
    .map((r) => ({
      id: r.id,
      status: r.status,
      completed_sessions: r.completed_sessions,
      qualified_for_hits: r.qualified_for_hits,
      submission_id: r.submission_id,
      participant_nama: r.submissions!.nama,
      participant_wa: r.submissions!.nomor_wa,
    }))
    .sort((a, b) => a.participant_nama.localeCompare(b.participant_nama));
}

async function fetchAttendanceMap(
  sessionIds: string[],
  submissionIds: string[],
): Promise<AttendanceMap> {
  if (sessionIds.length === 0 || submissionIds.length === 0) return {};
  const sb = supabaseService();
  const { data } = await sb
    .from("attendance")
    .select("cohort_session_id, submission_id, attended")
    .in("cohort_session_id", sessionIds)
    .in("submission_id", submissionIds);

  const map: AttendanceMap = {};
  for (const row of (data ?? []) as {
    cohort_session_id: string;
    submission_id: string;
    attended: boolean;
  }[]) {
    map[`${row.cohort_session_id}:${row.submission_id}`] = row.attended;
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
            Otomatis ter-record via Zoom webhook setelah meeting selesai.
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
