import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Trophy, ExternalLink, ArrowLeft } from "lucide-react";
import { getParticipantEligibilityBySlug } from "@/lib/eligibility";
import { trackEvent, FUNNEL_EVENTS } from "@/lib/analytics";

export const dynamic = "force-dynamic";

const HITS_URL = "https://linktr.ee/muhajirprojecttilawah";

export default async function HitsUnlockPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const eligibility = await getParticipantEligibilityBySlug(slug);
  if (!eligibility) notFound();

  // Hard gate: only peserta who completed Tahsin (≥3 sessions attended) can pass
  if (!eligibility.enrolled_cohort?.qualified_for_hits) {
    redirect(`/rapot/${slug}?hits_locked=1`);
  }

  // Track view + click event in one go (page load = "shown")
  await trackEvent({
    event_name: FUNNEL_EVENTS.GATE3_SHOWN,
    submission_id: eligibility.submission_id,
    metadata: { cohort_id: eligibility.enrolled_cohort.id },
  });

  return (
    <div
      style={{
        minHeight: "100dvh",
        background:
          "radial-gradient(circle at top, color-mix(in oklab, var(--accent), transparent 90%), var(--bg) 60%)",
        padding: "40px 20px 60px",
      }}
    >
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
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

        <div
          style={{
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              margin: "0 auto 22px",
              borderRadius: 22,
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--accent), white 10%), color-mix(in oklab, var(--accent), black 20%))",
              color: "white",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 16px 40px color-mix(in oklab, var(--accent), transparent 50%)",
            }}
          >
            <Trophy size={42} strokeWidth={2.2} />
          </div>

          <div
            style={{
              display: "inline-block",
              padding: "5px 14px",
              borderRadius: 999,
              background: "color-mix(in oklab, var(--success), transparent 85%)",
              color: "var(--success)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Lulus Tahsin Al-Fatihah
          </div>

          <h1
            className="font-display"
            style={{
              fontSize: "clamp(28px, 5vw, 42px)",
              fontWeight: 800,
              margin: "0 0 14px",
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
            }}
          >
            Barakallahu fiik, {eligibility.nama.split(" ")[0]}
          </h1>

          <p
            style={{
              fontSize: 16,
              color: "var(--ink-soft)",
              lineHeight: 1.65,
              maxWidth: 480,
              margin: "0 auto 28px",
            }}
          >
            Anda telah menyelesaikan{" "}
            <strong style={{ color: "var(--ink)" }}>
              {eligibility.enrolled_cohort.completed_sessions} dari 4 sesi
            </strong>{" "}
            program Tahsin Al-Fatihah. Selamat — Anda kini eligible untuk lanjut ke
            program lanjutan di Hilmi Institute of Tilawah Studies (HITS).
          </p>
        </div>

        <div
          className="card-mpt"
          style={{
            padding: "26px 24px",
            background: "var(--surface)",
            border: "2px solid color-mix(in oklab, var(--accent), transparent 75%)",
          }}
        >
          <h2
            className="font-display"
            style={{
              fontSize: 19,
              fontWeight: 700,
              margin: "0 0 8px",
              letterSpacing: "-0.02em",
            }}
          >
            Program Lanjutan HITS
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-soft)",
              lineHeight: 1.6,
              margin: "0 0 18px",
            }}
          >
            HITS Linktree berisi program-program tilawah lanjutan: Tahsin Surat,
            Tahfizh, Tajwid Mutqin, Qiraat Sab&apos;ah, dan kajian khusus. Khusus untuk
            alumni Tahsin Al-Fatihah.
          </p>

          <form action={`/api/hits/click?slug=${slug}`} method="POST">
            <button
              type="submit"
              className="btn-mpt btn-mpt-accent"
              style={{
                width: "100%",
                minHeight: 54,
                fontSize: 14,
                fontWeight: 700,
                gap: 8,
              }}
            >
              Buka HITS Linktree
              <ExternalLink size={15} strokeWidth={2.4} />
            </button>
          </form>

          <p
            style={{
              fontSize: 11,
              color: "var(--ink-mute)",
              textAlign: "center",
              marginTop: 12,
              lineHeight: 1.5,
            }}
          >
            Anda akan diarahkan ke{" "}
            <code style={{ fontSize: 10 }}>{HITS_URL}</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
