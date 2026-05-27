import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar,
  Clock,
  Users,
  GraduationCap,
  ArrowLeft,
  Trophy,
  Video,
  CheckCircle2,
  XCircle,
  CircleHelp,
} from "lucide-react";
import { supabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface CohortDetail {
  id: string;
  name: string;
  status: string;
  gender_target: string;
  start_date: string;
  end_date: string;
  capacity: number;
  enrolled_count: number;
  teacher_id: string;
  teacher_nama: string;
}

interface SessionRow {
  id: string;
  session_number: number;
  slot_id: string;
  scheduled_at: string;
  duration_min: number;
  status: string;
  zoom_join_url: string | null;
  reserved_count: number;
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

const STATUS_COLOR: Record<string, string> = {
  open: "var(--success)",
  closed: "var(--warning)",
  in_progress: "var(--accent)",
  completed: "var(--ink-mute)",
  cancelled: "var(--danger)",
};

const SLOT_STATUS_COLOR: Record<string, string> = {
  scheduled: "var(--success)",
  in_progress: "var(--accent)",
  completed: "var(--ink-mute)",
  cancelled: "var(--danger)",
};

async function fetchCohort(id: string): Promise<CohortDetail | null> {
  const sb = supabaseService();
  const { data } = await sb
    .from("cohorts")
    .select(
      `id, name, status, gender_target, start_date, end_date, capacity, enrolled_count, teacher_id,
       teachers:teacher_id(nama)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  const row = data as unknown as CohortDetail & {
    teachers: { nama: string } | null;
  };
  return { ...row, teacher_nama: row.teachers?.nama ?? "—" };
}

async function fetchSessions(cohortId: string): Promise<SessionRow[]> {
  const sb = supabaseService();
  const { data } = await sb
    .from("cohort_sessions")
    .select(
      `id, session_number, slot_id,
       slots:slot_id(scheduled_at, duration_min, status, zoom_join_url, reserved_count)`,
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
      reserved_count: number;
    } | null;
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
      reserved_count: r.slots!.reserved_count,
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
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: true });

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
    }));
}

export default async function CohortDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cohort = await fetchCohort(id);
  if (!cohort) notFound();

  const [sessions, enrollments] = await Promise.all([
    fetchSessions(id),
    fetchEnrollments(id),
  ]);

  const qualifiedCount = enrollments.filter((e) => e.qualified_for_hits).length;
  const statusColor = STATUS_COLOR[cohort.status] ?? "var(--ink-mute)";

  return (
    <div style={{ maxWidth: 1080 }}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/admin/cohort"
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
          Semua Cohort
        </Link>
      </div>

      <header style={{ marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 6,
            flexWrap: "wrap",
          }}
        >
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(22px, 3vw, 30px)",
              fontWeight: 800,
              margin: 0,
              letterSpacing: "-0.025em",
            }}
          >
            {cohort.name}
          </h1>
          <span
            style={{
              padding: "3px 10px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              borderRadius: 6,
              background: `color-mix(in oklab, ${statusColor}, transparent 85%)`,
              color: statusColor,
            }}
          >
            {cohort.status}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 18,
            fontSize: 13,
            color: "var(--ink-soft)",
            flexWrap: "wrap",
          }}
        >
          <span>{cohort.teacher_nama}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Calendar size={13} strokeWidth={2.2} />
            {fmtDate(cohort.start_date)} – {fmtDate(cohort.end_date)}
          </span>
          <span
            style={{
              padding: "1px 8px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              borderRadius: 4,
              background: "color-mix(in oklab, var(--accent), transparent 85%)",
              color: "var(--accent)",
            }}
          >
            {cohort.gender_target}
          </span>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 32,
        }}
      >
        <StatCard
          icon={<Users size={16} strokeWidth={2.2} />}
          label="Peserta"
          value={`${cohort.enrolled_count}/${cohort.capacity}`}
          color="var(--accent)"
        />
        <StatCard
          icon={<GraduationCap size={16} strokeWidth={2.2} />}
          label="Sesi"
          value={`${sessions.length}/4`}
          color="var(--accent)"
        />
        <StatCard
          icon={<Trophy size={16} strokeWidth={2.2} />}
          label="Lulus (≥3 hadir)"
          value={`${qualifiedCount}`}
          color="var(--success)"
        />
      </div>

      <Section
        title="Jadwal Sesi"
        subtitle={`4 sesi terikat ke cohort ini.`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </div>
      </Section>

      <div style={{ marginTop: 36 }}>
        <Section
          title="Peserta Terdaftar"
          subtitle={`${enrollments.length} dari ${cohort.capacity} kuota terisi.`}
        >
          {enrollments.length === 0 ? (
            <EmptyEnrollments />
          ) : (
            <div className="card-mpt" style={{ padding: 0, overflow: "auto" }}>
              <table
                style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}
              >
                <thead>
                  <tr style={{ background: "var(--surface-soft)" }}>
                    <Th>Peserta</Th>
                    <Th>WhatsApp</Th>
                    <Th>Hadir</Th>
                    <Th>Status</Th>
                    <Th>HITS</Th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => (
                    <tr key={e.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <Td bold>{e.participant_nama}</Td>
                      <Td>{e.participant_wa}</Td>
                      <Td>{e.completed_sessions} / 4</Td>
                      <Td>
                        <span
                          style={{
                            padding: "2px 8px",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            borderRadius: 4,
                            background:
                              e.status === "completed"
                                ? "color-mix(in oklab, var(--success), transparent 85%)"
                                : e.status === "dropped"
                                  ? "color-mix(in oklab, var(--danger), transparent 85%)"
                                  : "color-mix(in oklab, var(--accent), transparent 85%)",
                            color:
                              e.status === "completed"
                                ? "var(--success)"
                                : e.status === "dropped"
                                  ? "var(--danger)"
                                  : "var(--accent)",
                          }}
                        >
                          {e.status}
                        </span>
                      </Td>
                      <Td>
                        {e.qualified_for_hits ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              color: "var(--success)",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            <CheckCircle2 size={13} strokeWidth={2.4} />
                            Eligible
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              color: "var(--ink-mute)",
                              fontSize: 12,
                            }}
                          >
                            <CircleHelp size={13} strokeWidth={2.2} />
                            Belum
                          </span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
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
          {title}
        </h2>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "3px 0 0" }}>
          {subtitle}
        </p>
      </div>
      {children}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="card-mpt" style={{ padding: "16px 18px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: `color-mix(in oklab, ${color}, transparent 88%)`,
            color,
            display: "grid",
            placeItems: "center",
          }}
        >
          {icon}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
          }}
        >
          {label}
        </div>
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: "var(--ink)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SessionRow({ session }: { session: SessionRow }) {
  const d = new Date(session.scheduled_at);
  const dateStr = d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const start = `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  const statusColor = SLOT_STATUS_COLOR[session.status] ?? "var(--ink-mute)";

  return (
    <div
      className="card-mpt"
      style={{
        padding: "14px 18px",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
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
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Clock size={11} strokeWidth={2.2} />
            {start}
          </span>
          <span>{session.duration_min} menit</span>
        </div>
      </div>
      {session.zoom_join_url ? (
        <a
          href={session.zoom_join_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Zoom"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "color-mix(in oklab, var(--accent), transparent 85%)",
            color: "var(--accent)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Video size={14} strokeWidth={2.2} />
        </a>
      ) : (
        <div style={{ width: 32 }} />
      )}
      <span
        style={{
          padding: "3px 8px",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          borderRadius: 5,
          background: `color-mix(in oklab, ${statusColor}, transparent 85%)`,
          color: statusColor,
        }}
      >
        {session.status}
      </span>
    </div>
  );
}

function EmptyEnrollments() {
  return (
    <div
      className="card-mpt"
      style={{ padding: "32px 22px", textAlign: "center" }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          margin: "0 auto 10px",
          borderRadius: 10,
          background: "color-mix(in oklab, var(--accent), transparent 85%)",
          color: "var(--accent)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <XCircle size={18} strokeWidth={2.2} />
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.5 }}>
        Belum ada peserta yang enroll. Cohort ini akan terisi setelah peserta
        lulus Gate 2 di flow assessment.
      </p>
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
