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
import { supabaseService } from "@/lib/supabase";
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
  const sb = supabaseService();

  const { data: submission } = await sb
    .from("submissions")
    .select("id, nama, jenis_kelamin, rapot_slug")
    .eq("rapot_slug", slug)
    .maybeSingle();
  if (!submission) return null;

  const { data: enrollment } = await sb
    .from("cohort_enrollments")
    .select(
      `id, status, completed_sessions, qualified_for_hits,
       cohorts:cohort_id(id, name, start_date, end_date, teacher_id,
         teachers:teacher_id(nama))`,
    )
    .eq("submission_id", submission.id)
    .maybeSingle();

  let sessions: {
    session_number: number;
    scheduled_at: string;
    meet_join_url: string | null;
    attended: boolean;
  }[] = [];

  if (enrollment?.cohorts) {
    const cohort = enrollment.cohorts as unknown as {
      id: string;
      name: string;
      start_date: string;
      end_date: string;
      teachers: { nama: string } | null;
    };

    const { data: csData } = await sb
      .from("cohort_sessions")
      .select(
        `session_number,
         slots:slot_id(scheduled_at, meet_join_url)`,
      )
      .eq("cohort_id", cohort.id)
      .order("session_number");

    const { data: attData } = await sb
      .from("attendance")
      .select("cohort_session_id")
      .eq("submission_id", submission.id);

    const attendedSessionIds = new Set(
      attData?.map((a) => a.cohort_session_id).filter(Boolean) ?? [],
    );

    if (csData) {
      const { data: allCs } = await sb
        .from("cohort_sessions")
        .select("id, session_number")
        .eq("cohort_id", cohort.id);

      const sessionIdMap = new Map(
        allCs?.map((cs) => [cs.session_number, cs.id]) ?? [],
      );

      sessions = csData.map((cs) => {
        const slot = cs.slots as unknown as {
          scheduled_at: string;
          meet_join_url: string | null;
        } | null;
        return {
          session_number: cs.session_number,
          scheduled_at: slot?.scheduled_at ?? "",
          meet_join_url: slot?.meet_join_url ?? null,
          attended: attendedSessionIds.has(sessionIdMap.get(cs.session_number) ?? ""),
        };
      });
    }

    return {
      submission,
      enrollment: {
        ...enrollment,
        cohort_name: cohort.name,
        teacher_nama: cohort.teachers?.nama ?? "Pengajar MPT",
        start_date: cohort.start_date,
        end_date: cohort.end_date,
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
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
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
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
      <Link
        href={`/peserta/${slug}`}
        className="btn-mpt btn-mpt-outline"
        style={{
          minHeight: 36,
          fontSize: 12,
          padding: "8px 14px",
          marginBottom: 22,
          display: "inline-flex",
        }}
      >
        <ChevronLeft size={14} strokeWidth={2.4} />
        Kembali ke Dashboard
      </Link>

      <div
        className="card-mpt"
        style={{ padding: "28px 22px", marginBottom: 22 }}
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

      <div className="card-mpt" style={{ padding: "20px 22px", marginBottom: 22 }}>
        <h2
          style={{
            fontSize: 15,
            fontWeight: 700,
            margin: "0 0 14px",
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
        <div className="card-mpt" style={{ padding: "24px 22px", marginBottom: 22 }}>
          <h2
            className="font-display"
            style={{ fontSize: 19, fontWeight: 700, margin: "0 0 10px" }}
          >
            Rapot Tahsin
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 16px", lineHeight: 1.6 }}>
            Lihat perbandingan rapot awal (AI) dengan rapot pengajar setelah
            menyelesaikan 4 sesi Tahsin Al-Fatihah.
          </p>
          <Link
            href={`/peserta/${slug}/tahsin/report?dev=1`}
            className="btn-mpt btn-mpt-accent"
            style={{ minHeight: 48, fontSize: 15, fontWeight: 700, width: "100%" }}
          >
            Lihat Rapot Perbandingan
            <ArrowRight size={16} strokeWidth={2.4} />
          </Link>
        </div>
      )}

      {isComplete && qualified && (
        <div className="card-mpt" style={{ padding: "24px 22px", marginBottom: 22 }}>
          <h2
            className="font-display"
            style={{ fontSize: 19, fontWeight: 700, margin: "0 0 10px" }}
          >
            Langkah Selanjutnya
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 16px", lineHeight: 1.6 }}>
            Selamat! Anda memenuhi syarat untuk melanjutkan ke program berikutnya.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link
              href={`/tahsin/${slug}`}
              className="btn-mpt btn-mpt-outline"
              style={{ minHeight: 44, fontSize: 14, width: "100%" }}
            >
              Ulangi Tahsin Al-Fatihah
            </Link>
            <Link
              href={`/peserta/${slug}/hits?dev=1`}
              className="btn-mpt btn-mpt-accent"
              style={{ minHeight: 48, fontSize: 15, fontWeight: 700, width: "100%" }}
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
