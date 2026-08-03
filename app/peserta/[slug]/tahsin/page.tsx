import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  CheckCircle2,
  Circle,
  Clock,
  Video,
  ArrowRight,
} from "lucide-react";
import { sql } from "@/lib/db";
import { SkipSessionButton } from "@/components/tahsin/SkipSessionButton";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: "Progress Tahsin Al-Fatihah — Muhajir Project Tilawah",
  robots: { index: false, follow: false },
};

async function fetchTahsinData(slug: string) {
  const submissionRows = await sql<
    {
      id: string;
      nama: string;
      jenis_kelamin: string;
      rapot_slug: string | null;
    }[]
  >`
    SELECT id, nama, jenis_kelamin, rapot_slug
      FROM submissions
     WHERE rapot_slug = ${slug}
     LIMIT 1
  `;
  const submission = submissionRows[0];
  if (!submission) return null;

  const enrollmentRows = await sql<
    {
      id: string;
      status: string;
      completed_sessions: number;
      qualified_for_hits: boolean;
      cohort_id: string | null;
      cohort_name: string | null;
      start_date: string | null;
      end_date: string | null;
      teacher_nama: string | null;
    }[]
  >`
    SELECT e.id, e.status, e.completed_sessions, e.qualified_for_hits,
           c.id AS cohort_id, c.name AS cohort_name,
           c.start_date::text AS start_date, c.end_date::text AS end_date,
           t.nama AS teacher_nama
      FROM cohort_enrollments e
      LEFT JOIN cohorts c ON c.id = e.cohort_id
      LEFT JOIN teachers t ON t.id = c.teacher_id
     WHERE e.submission_id = ${submission.id}
     LIMIT 1
  `;
  const enrollment = enrollmentRows[0] ?? null;

  let sessions: {
    session_number: number;
    scheduled_at: string;
    meet_join_url: string | null;
    attended: boolean;
  }[] = [];

  if (enrollment?.cohort_id) {
    const cohortId = enrollment.cohort_id;

    const csData = await sql<
      {
        session_number: number;
        scheduled_at: Date | null;
        meet_join_url: string | null;
      }[]
    >`
      SELECT cs.session_number, s.scheduled_at, s.meet_join_url
        FROM cohort_sessions cs
        LEFT JOIN slots s ON s.id = cs.slot_id
       WHERE cs.cohort_id = ${cohortId}
       ORDER BY cs.session_number
    `;

    const attData = await sql<{ cohort_session_id: string | null }[]>`
      SELECT cohort_session_id
        FROM attendance
       WHERE submission_id = ${submission.id}
    `;

    const attendedSessionIds = new Set(
      attData.map((a) => a.cohort_session_id).filter(Boolean),
    );

    if (csData.length > 0) {
      const allCs = await sql<{ id: string; session_number: number }[]>`
        SELECT id, session_number
          FROM cohort_sessions
         WHERE cohort_id = ${cohortId}
      `;

      const sessionIdMap = new Map(
        allCs.map((cs) => [cs.session_number, cs.id]),
      );

      sessions = csData.map((cs) => ({
        session_number: cs.session_number,
        scheduled_at: cs.scheduled_at?.toISOString() ?? "",
        meet_join_url: cs.meet_join_url ?? null,
        attended: attendedSessionIds.has(
          sessionIdMap.get(cs.session_number) ?? "",
        ),
      }));
    }

    return {
      submission,
      enrollment: {
        ...enrollment,
        cohort_name: enrollment.cohort_name,
        teacher_nama: enrollment.teacher_nama ?? "Pengajar MPT",
        start_date: enrollment.start_date,
        end_date: enrollment.end_date,
      },
      sessions,
    };
  }

  return { submission, enrollment: null, sessions: [] };
}

function fmtDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Ags", "Sep", "Okt", "Nov", "Des",
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function fmtTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")} WIB`;
}

export default async function TahsinProgressPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const devMode = sp.dev === "1";
  const simSession = devMode ? Number(sp.sim ?? 0) : 0;

  const data = await fetchTahsinData(slug);
  if (!data) notFound();

  const { submission, enrollment, sessions } = data;

  if (!enrollment) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 48px" }}>
        <div className="card-mpt" style={{ padding: "32px 22px", textAlign: "center" }}>
          <h1 className="font-display" style={{ fontSize: 24, margin: "0 0 12px" }}>
            Belum Terdaftar Tahsin
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 20px" }}>
            Anda belum terdaftar di program Tahsin Al-Fatihah.
          </p>
          <Link
            href={`/tahsin/${slug}`}
            className="btn-mpt btn-mpt-accent"
            style={{ minHeight: 44, fontSize: 14 }}
          >
            Daftar Tahsin
          </Link>
        </div>
      </div>
    );
  }

  const completedCount = simSession > 0
    ? simSession
    : enrollment.completed_sessions;
  const totalSessions = sessions.length || 4;
  const isComplete = completedCount >= totalSessions;
  const qualified = completedCount >= 3;
  const progressPct = Math.round((completedCount / totalSessions) * 100);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 48px" }}>
      <Link
        href={`/peserta/${slug}`}
        className="btn-mpt btn-mpt-outline"
        style={{
          minHeight: 36,
          fontSize: 12,
          padding: "8px 14px",
          marginBottom: 16,
          display: "inline-flex",
        }}
      >
        <ChevronLeft size={14} strokeWidth={2.4} />
        Kembali ke Dashboard
      </Link>

      <div
        className="card-mpt"
        style={{ padding: "22px 18px", marginBottom: 14 }}
      >
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(22px, 3.5vw, 28px)",
            margin: "0 0 6px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          Tahsin Al-Fatihah
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 20px" }}>
          {enrollment.cohort_name} &middot; Pengajar: {enrollment.teacher_nama}
        </p>

        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            <span>Progress</span>
            <span>{completedCount}/{totalSessions} sesi</span>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 5,
              background: "var(--line)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                borderRadius: 5,
                background: qualified ? "var(--success)" : "var(--accent)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {isComplete && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "color-mix(in oklab, var(--success), transparent 90%)",
              color: "var(--success)",
              fontSize: 13,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            Alhamdulillah, Anda telah menyelesaikan semua sesi!
          </div>
        )}
      </div>

      <div className="card-mpt" style={{ padding: "18px 18px", marginBottom: 14 }}>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 700,
            margin: "0 0 12px",
            letterSpacing: "-0.01em",
          }}
        >
          Detail Sesi
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sessions.map((s) => {
            const done = simSession > 0
              ? s.session_number <= simSession
              : s.attended;
            const isPast = new Date(s.scheduled_at) < new Date();
            return (
              <div
                key={s.session_number}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: done
                    ? "color-mix(in oklab, var(--success), transparent 93%)"
                    : "var(--surface)",
                  border: `1px solid ${done ? "color-mix(in oklab, var(--success), transparent 70%)" : "var(--line)"}`,
                }}
              >
                <div>
                  {done ? (
                    <CheckCircle2 size={22} strokeWidth={2.2} color="var(--success)" />
                  ) : isPast ? (
                    <Circle size={22} strokeWidth={2.2} color="var(--ink-mute)" />
                  ) : (
                    <Clock size={22} strokeWidth={2.2} color="var(--accent)" />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    Sesi {s.session_number}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                    {fmtDate(s.scheduled_at)} &middot; {fmtTime(s.scheduled_at)}
                  </div>
                </div>
                {!done && !isPast && s.meet_join_url && (
                  <a
                    href={s.meet_join_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-mpt btn-mpt-outline"
                    style={{ minHeight: 32, fontSize: 11, padding: "4px 10px" }}
                  >
                    <Video size={12} strokeWidth={2.4} />
                    Meet
                  </a>
                )}
                {done && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--success)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Hadir
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isComplete && (
        <div className="card-mpt" style={{ padding: "20px 18px", marginBottom: 14 }}>
          <h2
            className="font-display"
            style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}
          >
            Rapot Tahsin
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 12px", lineHeight: 1.6 }}>
            Lihat perbandingan rapot awal (AI) dengan rapot pengajar setelah
            menyelesaikan 4 sesi Tahsin Al-Fatihah.
          </p>
          <Link
            href={`/peserta/${slug}/tahsin/report`}
            className="btn-mpt btn-mpt-accent"
            style={{ minHeight: 44, fontSize: 14, fontWeight: 700, width: "100%" }}
          >
            Lihat Rapot Perbandingan
            <ArrowRight size={16} strokeWidth={2.4} />
          </Link>
        </div>
      )}

      {isComplete && qualified && (
        <div className="card-mpt" style={{ padding: "20px 18px", marginBottom: 14 }}>
          <h2
            className="font-display"
            style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}
          >
            Langkah Selanjutnya
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 12px", lineHeight: 1.6 }}>
            Selamat! Anda memenuhi syarat untuk melanjutkan ke program berikutnya.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link
              href={`/tahsin/${slug}`}
              className="btn-mpt btn-mpt-outline"
              style={{ minHeight: 40, fontSize: 13, width: "100%" }}
            >
              Ulangi Tahsin Al-Fatihah
            </Link>
            <Link
              href={`/peserta/${slug}/hits?gender=${submission.jenis_kelamin}`}
              className="btn-mpt btn-mpt-accent"
              style={{ minHeight: 44, fontSize: 14, fontWeight: 700, width: "100%" }}
            >
              Daftar HITS (Halaqah Intensif Tahsin)
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
          </div>
        </div>
      )}

      {devMode && !isComplete && (
        <SkipSessionButton slug={slug} />
      )}
    </div>
  );
}
