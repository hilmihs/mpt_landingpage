import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { supabaseService } from "@/lib/supabase";
import { getParticipantEligibilityBySlug } from "@/lib/eligibility";
import { CohortPicker } from "@/components/tahsin/CohortPicker";

export const dynamic = "force-dynamic";

interface CohortListItem {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  capacity: number;
  enrolled_count: number;
  teacher_nama: string;
  sessions: { scheduled_at: string; duration_min: number }[];
}

async function fetchAvailableCohorts(
  gender: "ikhwan" | "akhwat",
): Promise<CohortListItem[]> {
  const sb = supabaseService();
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data } = await sb
    .from("cohorts")
    .select(
      `id, name, status, gender_target, start_date, end_date, capacity, enrolled_count,
       teachers:teacher_id(nama),
       cohort_sessions(slot_id, slots:slot_id(scheduled_at, duration_min))`,
    )
    .eq("status", "open")
    .eq("gender_target", gender)
    .gte("start_date", todayStr)
    .order("start_date", { ascending: true });

  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    capacity: number;
    enrolled_count: number;
    start_date: string;
    end_date: string;
    teachers: { nama: string } | null;
    cohort_sessions: {
      slot_id: string;
      slots: { scheduled_at: string; duration_min: number } | null;
    }[];
  }[];

  return rows
    .filter((c) => c.enrolled_count < c.capacity)
    .map((c) => ({
      id: c.id,
      name: c.name,
      start_date: c.start_date,
      end_date: c.end_date,
      capacity: c.capacity,
      enrolled_count: c.enrolled_count,
      teacher_nama: c.teachers?.nama ?? "—",
      sessions: c.cohort_sessions
        .filter((s) => s.slots)
        .map((s) => ({
          scheduled_at: s.slots!.scheduled_at,
          duration_min: s.slots!.duration_min,
        }))
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    }));
}

export default async function TahsinEnrollPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const eligibility = await getParticipantEligibilityBySlug(slug);
  if (!eligibility) notFound();

  // Already enrolled → bounce back to rapot
  if (eligibility.enrolled_cohort) {
    redirect(`/rapot/${slug}?already_enrolled=1`);
  }

  // Not yet attended assessment → block with friendly message
  if (!eligibility.gate2_eligible) {
    return (
      <NotEligibleState
        slug={slug}
        attendedAt={eligibility.attended_assessment_at}
      />
    );
  }

  const cohorts = await fetchAvailableCohorts(eligibility.jenis_kelamin);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        padding: "32px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 16 }}>
          <Link
            href={`/rapot/${slug}`}
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
            Kembali ke Rapot
          </Link>
        </div>

        <header style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 12px",
              borderRadius: 999,
              background: "color-mix(in oklab, var(--accent), transparent 85%)",
              color: "var(--accent)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            <GraduationCap size={13} strokeWidth={2.4} />
            Gate 2 — Tahsin Al-Fatihah
          </div>
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(26px, 4vw, 36px)",
              fontWeight: 800,
              margin: 0,
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
            }}
          >
            Pilih Cohort Tahsin Anda
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--ink-soft)",
              margin: "10px 0 0",
              lineHeight: 1.6,
              maxWidth: 580,
            }}
          >
            Assalamu&apos;alaikum {eligibility.nama.split(" ")[0]}. Program Tahsin Al-Fatihah
            terdiri dari <strong>4 sesi × 90 menit</strong>, dijalankan dua kali seminggu
            selama dua minggu. Pilih cohort yang waktunya cocok dengan jadwal Anda.
          </p>
        </header>

        <CohortPicker rapotSlug={slug} cohorts={cohorts} />
      </div>
    </div>
  );
}

function NotEligibleState({
  slug,
  attendedAt,
}: {
  slug: string;
  attendedAt: string | null;
}) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
      }}
    >
      <div className="card-mpt" style={{ padding: "32px 28px", maxWidth: 480, textAlign: "center" }}>
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 16px",
            borderRadius: 14,
            background: "color-mix(in oklab, var(--warning), transparent 85%)",
            color: "var(--warning)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <GraduationCap size={24} strokeWidth={2.2} />
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: "0 0 10px",
            letterSpacing: "-0.02em",
          }}
        >
          Pendaftaran Tahsin Belum Tersedia
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            lineHeight: 1.65,
            margin: "0 0 22px",
          }}
        >
          {attendedAt ? (
            <>
              Anda perlu menyelesaikan sesi assessment dengan pengajar terlebih
              dahulu. Bila Anda yakin sudah hadir, mungkin pengajar belum
              menandai kehadiran—silakan tunggu sebentar.
            </>
          ) : (
            <>
              Anda perlu menyelesaikan sesi assessment dengan pengajar terlebih
              dahulu sebelum mendaftar program Tahsin Al-Fatihah.
            </>
          )}
        </p>
        <Link
          href={`/rapot/${slug}`}
          className="btn-mpt btn-mpt-accent"
          style={{
            minHeight: 44,
            fontSize: 13,
            padding: "10px 20px",
            textDecoration: "none",
            display: "inline-flex",
          }}
        >
          Kembali ke Rapot
        </Link>
      </div>
    </div>
  );
}
