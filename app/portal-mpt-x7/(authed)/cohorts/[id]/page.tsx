import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Users,
  Trophy,
  ArrowLeft,
  Video,
  CheckCircle2,
  CircleHelp,
} from "lucide-react";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { supabaseService } from "@/lib/supabase";

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

interface SessionRow {
  id: string;
  session_number: number;
  slot_id: string;
  scheduled_at: string;
  duration_min: number;
  status: string;
  zoom_join_url: string | null;
  attendance_count: number;
}

interface EnrollmentRow {
  id: string;
  status: string;
  completed_sessions: number;
  qualified_for_hits: boolean;
  participant_nama: string;
  participant_wa: string;
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

async function fetchSessionsWithAttendance(cohortId: string): Promise<SessionRow[]> {
  const sb = supabaseService();
  const { data } = await sb
    .from("cohort_sessions")
    .select(
      `id, session_number, slot_id,
       slots:slot_id(scheduled_at, duration_min, status, zoom_join_url),
       attendance(attended)`,
    )
    .eq("cohort_id", cohortId)
    .order("session_number", { ascending: true });

  const rows = (data ?? []) as unknown as {
    id: string;
    session_number: number;
    slot_id: string;
    slots: {
      scheduled_at: string;
      duration_min: number;
      status: string;
      zoom_join_url: string | null;
    } | null;
    attendance: { attended: boolean }[] | null;
  }[];

  return rows
    .filter((r) => r.slots)
    .map((r) => ({
      id: r.id,
      session_number: r.session_number,
      slot_id: r.slot_id,
      scheduled_at: r.slots!.scheduled_at,
      duration_min: r.slots!.duration_min,
      status: r.slots!.status,
      zoom_join_url: r.slots!.zoom_join_url,
      attendance_count: (r.attendance ?? []).filter((a) => a.attended).length,
    }));
}

async function fetchEnrollments(cohortId: string): Promise<EnrollmentRow[]> {
  const sb = supabaseService();
  const { data } = await sb
    .from("cohort_enrollments")
    .select(
      `id, status, completed_sessions, qualified_for_hits,
       submissions:submission_id(nama, nomor_wa)`,
    )
    .eq("cohort_id", cohortId);

  const rows = (data ?? []) as unknown as {
    id: string;
    status: string;
    completed_sessions: number;
    qualified_for_hits: boolean;
    submissions: { nama: string; nomor_wa: string } | null;
  }[];

  return rows
    .filter((r) => r.submissions)
    .map((r) => ({
      id: r.id,
      status: r.status,
      completed_sessions: r.completed_sessions,
      qualified_for_hits: r.qualified_for_hits,
      participant_nama: r.submissions!.nama,
      participant_wa: r.submissions!.nomor_wa,
    }))
    .sort((a, b) => a.participant_nama.localeCompare(b.participant_nama));
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
    fetchSessionsWithAttendance(id),
    fetchEnrollments(id),
  ]);

  const qualifiedCount = enrollments.filter((e) => e.qualified_for_hits).length;
  // Server component renders once per request — Date.now() here is intentional
  // and stable for this render.
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
        <h2
          className="font-display"
          style={{
            fontSize: 18,
            fontWeight: 700,
            margin: "0 0 12px",
            letterSpacing: "-0.02em",
          }}
        >
          Jadwal 4 Sesi
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              enrolledCount={cohort.enrolled_count}
              nowMs={nowMs}
            />
          ))}
        </div>
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

function SessionRow({
  session,
  enrolledCount,
  nowMs,
}: {
  session: SessionRow;
  enrolledCount: number;
  nowMs: number;
}) {
  const d = new Date(session.scheduled_at);
  const dateStr = d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const start = `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;

  const isPast = d.getTime() < nowMs;
  const showAttendance = isPast || session.status === "completed" || session.status === "in_progress";

  return (
    <div
      className="card-mpt"
      style={{
        padding: "14px 18px",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 14,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "color-mix(in oklab, var(--accent), transparent 85%)",
          color: "var(--accent)",
          display: "grid",
          placeItems: "center",
          fontSize: 14,
          fontWeight: 800,
        }}
      >
        {session.session_number}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{dateStr}</div>
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-soft)",
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginTop: 2,
            flexWrap: "wrap",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Clock size={11} strokeWidth={2.2} />
            {start}
          </span>
          <span>{session.duration_min}m</span>
          {showAttendance && (
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>
              {session.attendance_count}/{enrolledCount} hadir
            </span>
          )}
        </div>
      </div>
      {session.zoom_join_url && (
        <a
          href={session.zoom_join_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-mpt btn-mpt-accent"
          style={{ minHeight: 32, fontSize: 11, padding: "4px 10px" }}
        >
          <Video size={12} strokeWidth={2.4} />
          Zoom
        </a>
      )}
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
