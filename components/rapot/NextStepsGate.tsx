import Link from "next/link";
import {
  GraduationCap,
  Trophy,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowRight,
} from "lucide-react";
import type { ParticipantEligibility } from "@/lib/eligibility";
import { InterestGate } from "@/components/rapot/InterestGate";

interface Props {
  rapotSlug: string;
  submissionId: string;
  jenisKelamin: "ikhwan" | "akhwat";
  eligibility: ParticipantEligibility | null;
}

/**
 * Smart "what's next" section on the rapot page. Picks one of:
 *   - Gate 1 (default): peserta hasn't booked yet → show InterestGate
 *   - Gate 2: peserta attended assessment, not enrolled → cohort enrollment CTA
 *   - Enrolled state: peserta is in a cohort → show schedule + progress
 *   - Gate 3: peserta qualified for HITS → unlock CTA
 */
export function NextStepsGate({
  rapotSlug,
  submissionId,
  jenisKelamin,
  eligibility,
}: Props) {
  if (!eligibility) {
    return (
      <InterestGate
        rapotSlug={rapotSlug}
        submissionId={submissionId}
        jenisKelamin={jenisKelamin}
      />
    );
  }

  // Priority 1: Gate 3 — HITS unlock (highest reward, most engaged peserta)
  if (eligibility.gate3_eligible) {
    return <Gate3HitsSection rapotSlug={rapotSlug} eligibility={eligibility} />;
  }

  // Priority 2: Enrolled in cohort (showing progress, not a gate per se)
  if (eligibility.enrolled_cohort) {
    return <EnrolledSection eligibility={eligibility} />;
  }

  // Priority 3: Gate 2 — Eligible to enroll in Tahsin
  if (eligibility.gate2_eligible) {
    return <Gate2TahsinSection rapotSlug={rapotSlug} />;
  }

  // Default: Gate 1 — Booking assessment
  return (
    <InterestGate
      rapotSlug={rapotSlug}
      submissionId={submissionId}
      jenisKelamin={jenisKelamin}
    />
  );
}

function Gate2TahsinSection({ rapotSlug }: { rapotSlug: string }) {
  return (
    <section
      className="card-mpt"
      style={{
        padding: "26px 24px",
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--accent), transparent 92%), var(--surface))",
        border: "2px solid color-mix(in oklab, var(--accent), transparent 70%)",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 12px",
          borderRadius: 999,
          background: "color-mix(in oklab, var(--accent), transparent 85%)",
          color: "var(--accent)",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        <CheckCircle2 size={12} strokeWidth={2.4} />
        Anda sudah hadir di sesi assessment
      </div>

      <h3
        className="font-display"
        style={{
          fontSize: "clamp(22px, 3vw, 26px)",
          fontWeight: 800,
          margin: "0 0 10px",
          letterSpacing: "-0.025em",
          lineHeight: 1.2,
        }}
      >
        Siap lanjut ke Tahsin Al-Fatihah?
      </h3>

      <p
        style={{
          fontSize: 14,
          color: "var(--ink-soft)",
          lineHeight: 1.65,
          margin: "0 0 20px",
        }}
      >
        Berdasarkan hasil assessment Anda, langkah berikutnya yang paling tepat
        adalah <strong style={{ color: "var(--ink)" }}>Tahsin Al-Fatihah</strong>{" "}
        — 4 sesi × 90 menit yang fokus memperbaiki bacaan surat Al-Fatihah Anda
        secara bertahap.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 22,
        }}
      >
        <Stat
          icon={<Calendar size={14} strokeWidth={2.2} />}
          label="Durasi"
          value="2 minggu"
        />
        <Stat
          icon={<Clock size={14} strokeWidth={2.2} />}
          label="Per Sesi"
          value="90 menit"
        />
        <Stat
          icon={<GraduationCap size={14} strokeWidth={2.2} />}
          label="Total"
          value="4 sesi"
        />
      </div>

      <Link
        href={`/tahsin/${rapotSlug}`}
        className="btn-mpt btn-mpt-accent"
        style={{
          minHeight: 50,
          fontSize: 14,
          fontWeight: 700,
          padding: "10px 20px",
          width: "100%",
          textDecoration: "none",
        }}
      >
        Lihat Cohort Tahsin yang Tersedia
        <ArrowRight size={15} strokeWidth={2.4} />
      </Link>

      <p
        style={{
          fontSize: 11,
          color: "var(--ink-mute)",
          textAlign: "center",
          marginTop: 12,
          lineHeight: 1.5,
        }}
      >
        Cohort dipisah per gender · maksimal 12 peserta per cohort
      </p>
    </section>
  );
}

function EnrolledSection({
  eligibility,
}: {
  eligibility: ParticipantEligibility;
}) {
  const c = eligibility.enrolled_cohort!;
  const startStr = new Date(c.start_date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
  });
  const endStr = new Date(c.end_date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
  });
  const isCompleted = c.completed_sessions >= 4;

  return (
    <section
      className="card-mpt"
      style={{
        padding: "26px 24px",
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--success), transparent 92%), var(--surface))",
        border: "2px solid color-mix(in oklab, var(--success), transparent 75%)",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 12px",
          borderRadius: 999,
          background: "color-mix(in oklab, var(--success), transparent 80%)",
          color: "var(--success)",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        <CheckCircle2 size={12} strokeWidth={2.4} />
        Terdaftar di Cohort Tahsin
      </div>

      <h3
        className="font-display"
        style={{
          fontSize: "clamp(20px, 2.8vw, 24px)",
          fontWeight: 800,
          margin: "0 0 10px",
          letterSpacing: "-0.02em",
          lineHeight: 1.25,
        }}
      >
        {c.name}
      </h3>

      <div
        style={{
          fontSize: 13,
          color: "var(--ink-soft)",
          marginBottom: 18,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Calendar size={12} strokeWidth={2.2} />
          {startStr} – {endStr}
        </span>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
            marginBottom: 6,
          }}
        >
          <span>Progress</span>
          <span>{c.completed_sessions} / 4 sesi hadir</span>
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
              width: `${(c.completed_sessions / 4) * 100}%`,
              height: "100%",
              background:
                "linear-gradient(90deg, var(--success), color-mix(in oklab, var(--success), white 20%))",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {!isCompleted && (
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-soft)",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {c.completed_sessions === 0 ? (
            <>Sesi pertama akan dimulai pada {startStr}. Tunggu link Zoom dari pengajar Anda.</>
          ) : c.completed_sessions < 3 ? (
            <>
              Hadiri minimal <strong>{3 - c.completed_sessions} sesi lagi</strong>{" "}
              untuk mendapatkan akses ke program lanjutan HITS.
            </>
          ) : (
            <>
              <strong style={{ color: "var(--success)" }}>
                ✓ Anda sudah memenuhi syarat HITS!
              </strong>{" "}
              Selesaikan sesi terakhir untuk experience optimal.
            </>
          )}
        </p>
      )}
    </section>
  );
}

function Gate3HitsSection({
  rapotSlug,
  eligibility,
}: {
  rapotSlug: string;
  eligibility: ParticipantEligibility;
}) {
  const c = eligibility.enrolled_cohort!;

  return (
    <section
      className="card-mpt"
      style={{
        padding: "30px 26px",
        background:
          "radial-gradient(circle at top right, color-mix(in oklab, var(--accent), transparent 80%), var(--surface) 80%)",
        border: "2px solid color-mix(in oklab, var(--accent), transparent 60%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--accent), white 10%), color-mix(in oklab, var(--accent), black 20%))",
          color: "white",
          display: "grid",
          placeItems: "center",
          marginBottom: 16,
          boxShadow:
            "0 12px 28px color-mix(in oklab, var(--accent), transparent 60%)",
        }}
      >
        <Trophy size={28} strokeWidth={2.2} />
      </div>

      <div
        style={{
          display: "inline-block",
          padding: "4px 12px",
          borderRadius: 999,
          background: "color-mix(in oklab, var(--success), transparent 85%)",
          color: "var(--success)",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        Lulus Tahsin Al-Fatihah
      </div>

      <h3
        className="font-display"
        style={{
          fontSize: "clamp(22px, 3.2vw, 28px)",
          fontWeight: 800,
          margin: "0 0 10px",
          letterSpacing: "-0.025em",
          lineHeight: 1.2,
        }}
      >
        Anda eligible untuk HITS!
      </h3>

      <p
        style={{
          fontSize: 14,
          color: "var(--ink-soft)",
          lineHeight: 1.65,
          margin: "0 0 22px",
        }}
      >
        Anda menyelesaikan{" "}
        <strong style={{ color: "var(--ink)" }}>
          {c.completed_sessions} dari 4 sesi
        </strong>{" "}
        Tahsin Al-Fatihah. Program-program lanjutan tilawah di Hilmi Institute
        of Tilawah Studies sekarang terbuka untuk Anda.
      </p>

      <Link
        href={`/hits/${rapotSlug}`}
        className="btn-mpt btn-mpt-accent"
        style={{
          minHeight: 52,
          fontSize: 14,
          fontWeight: 700,
          padding: "10px 22px",
          width: "100%",
          textDecoration: "none",
        }}
      >
        Buka Program Lanjutan HITS
        <ArrowRight size={15} strokeWidth={2.4} />
      </Link>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--surface)",
        borderRadius: 8,
        border: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <div style={{ color: "var(--accent)" }}>{icon}</div>
        <div
          style={{
            fontSize: 10,
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
          fontSize: 18,
          fontWeight: 800,
          color: "var(--ink)",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}
