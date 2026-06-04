import Link from "next/link";
import { notFound } from "next/navigation";
import {
  User,
  FileText,
  Calendar,
  BookOpen,
  Video,
  TrendingUp,
  ArrowRight,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { supabaseService } from "@/lib/supabase";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Dashboard Peserta — Muhajir Project Tilawah",
  robots: { index: false, follow: false },
};

async function fetchDashboardData(slug: string) {
  const sb = supabaseService();

  const { data: submission } = await sb
    .from("submissions")
    .select("id, nama, jenis_kelamin, nomor_wa, rapot_slug, created_at")
    .eq("rapot_slug", slug)
    .maybeSingle();
  if (!submission) return null;

  const { data: rapot } = await sb
    .from("rapot")
    .select("slug, skor, status_label, weighted_score")
    .eq("slug", slug)
    .maybeSingle();

  const { data: bookings } = await sb
    .from("bookings")
    .select(
      `id, status, created_at,
       slots:slot_id(scheduled_at, duration_min, kind, meet_join_url,
         teachers:teacher_id(nama))`,
    )
    .eq("submission_id", submission.id)
    .order("created_at", { ascending: false });

  const { data: enrollments } = await sb
    .from("cohort_enrollments")
    .select(
      `id, status, completed_sessions, qualified_for_hits,
       cohorts:cohort_id(name, start_date, end_date,
         teachers:teacher_id(nama))`,
    )
    .eq("submission_id", submission.id);

  const { data: attendance } = await sb
    .from("attendance")
    .select("id, status, attended_at")
    .eq("submission_id", submission.id)
    .eq("status", "present");

  return {
    submission,
    rapot,
    bookings: bookings ?? [],
    enrollments: enrollments ?? [],
    attendanceCount: attendance?.length ?? 0,
  };
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Ags", "Sep", "Okt", "Nov", "Des",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const time = `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  return `${days[d.getDay()]}, ${d.getDate()} ${["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"][d.getMonth()]} · ${time} WIB`;
}

export default async function PesertaDashboard({ params }: Props) {
  const { slug } = await params;
  const data = await fetchDashboardData(slug);
  if (!data) notFound();

  const { submission, rapot, bookings, enrollments, attendanceCount } = data;

  const upcomingBookings = bookings.filter((b) => {
    const slot = b.slots as unknown as { scheduled_at: string } | null;
    return (
      slot &&
      new Date(slot.scheduled_at) > new Date() &&
      b.status !== "cancelled"
    );
  });

  const activeEnrollments = enrollments.filter(
    (e) => e.status !== "dropped",
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
      <div
        className="card-mpt"
        style={{
          padding: "28px 22px",
          marginBottom: 22,
          background: "linear-gradient(135deg, color-mix(in oklab, var(--primary), var(--surface) 85%), var(--surface))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 14,
              background: "var(--primary)",
              color: "var(--primary-ink)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <User size={24} strokeWidth={2} />
          </div>
          <div>
            <h1
              className="font-display"
              style={{
                fontSize: "clamp(20px, 3vw, 26px)",
                margin: 0,
                fontWeight: 800,
              }}
            >
              Assalamu&apos;alaikum, {submission.nama.split(" ")[0]}!
            </h1>
            <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: 0 }}>
              Terdaftar sejak {fmtDate(submission.created_at)}
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          marginBottom: 22,
        }}
      >
        <StatCard
          icon={<FileText size={18} />}
          value={rapot ? String(rapot.skor) : "-"}
          label="Skor AI"
          color="var(--accent)"
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          value={String(attendanceCount)}
          label="Kehadiran"
          color="var(--success)"
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          value={activeEnrollments.length > 0 ? "Aktif" : "-"}
          label="Program"
          color="var(--primary)"
        />
      </div>

      {upcomingBookings.length > 0 && (
        <div className="card-mpt" style={{ padding: "20px 22px", marginBottom: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={16} strokeWidth={2.2} />
            Jadwal Mendatang
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {upcomingBookings.map((b) => {
              const slot = b.slots as unknown as {
                scheduled_at: string;
                duration_min: number;
                kind: string;
                meet_join_url: string | null;
                teachers: { nama: string } | null;
              };
              return (
                <div
                  key={b.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {slot.kind === "assessment" ? "Assessment" : "Tahsin"} &middot;{" "}
                      {slot.teachers?.nama ?? "Pengajar MPT"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={11} />
                      {fmtDateTime(slot.scheduled_at)}
                    </div>
                  </div>
                  {slot.meet_join_url && (
                    <a
                      href={slot.meet_join_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-mpt btn-mpt-outline"
                      style={{ minHeight: 32, fontSize: 11, padding: "4px 10px" }}
                    >
                      <Video size={12} />
                      Meet
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card-mpt" style={{ padding: "20px 22px", marginBottom: 22 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={16} strokeWidth={2.2} />
          Rapot Saya
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rapot && (
            <Link
              href={`/rapot/${rapot.slug}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px",
                borderRadius: 10,
                background: "var(--surface)",
                border: "1px solid var(--line)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Rapot Assessment AI</div>
                <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                  Skor {rapot.skor}/5 &middot; {rapot.status_label}
                </div>
              </div>
              <ArrowRight size={16} color="var(--ink-mute)" />
            </Link>
          )}
          <Link
            href={`/peserta/${slug}/assessment-result?dev=1`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 16px",
              borderRadius: 10,
              background: "var(--surface)",
              border: "1px solid var(--line)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Rapot Assessment Pengajar</div>
              <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                Evaluasi langsung dari pengajar MPT
              </div>
            </div>
            <ArrowRight size={16} color="var(--ink-mute)" />
          </Link>
          {activeEnrollments.some((e) => e.completed_sessions >= 4) && (
            <Link
              href={`/peserta/${slug}/tahsin/report?dev=1`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px",
                borderRadius: 10,
                background: "color-mix(in oklab, var(--success), transparent 93%)",
                border: "1px solid color-mix(in oklab, var(--success), transparent 70%)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--success)" }}>
                  Rapot Perbandingan Tahsin
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                  Sebelum vs sesudah 4 sesi tahsin
                </div>
              </div>
              <ArrowRight size={16} color="var(--success)" />
            </Link>
          )}
        </div>
      </div>

      {activeEnrollments.length > 0 && (
        <div className="card-mpt" style={{ padding: "20px 22px", marginBottom: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <BookOpen size={16} strokeWidth={2.2} />
            Program Saya
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activeEnrollments.map((e) => {
              const cohort = e.cohorts as unknown as {
                name: string;
                start_date: string;
                end_date: string;
                teachers: { nama: string } | null;
              };
              const progress = Math.round(
                (e.completed_sessions / 4) * 100,
              );
              return (
                <Link
                  key={e.id}
                  href={`/peserta/${slug}/tahsin?dev=1`}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    textDecoration: "none",
                    color: "inherit",
                    display: "block",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {cohort.name}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: e.qualified_for_hits ? "var(--success)" : "var(--accent)",
                        textTransform: "uppercase",
                      }}
                    >
                      {e.completed_sessions}/4 sesi
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 8 }}>
                    Pengajar: {cohort.teachers?.nama ?? "MPT"} &middot;{" "}
                    {fmtDate(cohort.start_date)} – {fmtDate(cohort.end_date)}
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: "var(--line)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${progress}%`,
                        borderRadius: 3,
                        background: e.qualified_for_hits
                          ? "var(--success)"
                          : "var(--accent)",
                      }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div
      className="card-mpt"
      style={{ padding: "14px 12px", textAlign: "center" }}
    >
      <div style={{ color, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
    </div>
  );
}
