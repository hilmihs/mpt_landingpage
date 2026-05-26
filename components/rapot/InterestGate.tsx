"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Heart, CheckCircle2 } from "lucide-react";

interface Props {
  rapotSlug: string;
  submissionId: string;
  jenisKelamin: "ikhwan" | "akhwat";
}

export function InterestGate({ rapotSlug }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<"yes" | "no" | null>(null);
  const [declined, setDeclined] = useState(false);

  async function record(response: "yes" | "no") {
    setSubmitting(response);
    try {
      await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rapot_slug: rapotSlug,
          gate: "gate1_post_rapot",
          response,
        }),
      });
    } catch {
      // best-effort; don't block UI transition
    }

    if (response === "yes") {
      router.push(`/booking/assessment/${rapotSlug}`);
    } else {
      // V2 invariant: HITS Linktree hanya muncul setelah lulus Tahsin
      // Sebelumnya redirect ke linktr.ee — bypass funnel. Sekarang tampilkan
      // thank-you state dengan opsi change-mind.
      setDeclined(true);
      setSubmitting(null);
    }
  }

  if (declined) {
    return (
      <div
        style={{
          padding: "32px 28px",
          borderRadius: 24,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 16px",
            borderRadius: 14,
            background:
              "color-mix(in oklab, var(--success), transparent 85%)",
            color: "var(--success)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <CheckCircle2 size={24} strokeWidth={2.2} />
        </div>
        <h3
          className="font-display"
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: "0 0 10px",
            letterSpacing: "-0.02em",
          }}
        >
          Terima kasih atas masukannya
        </h3>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            lineHeight: 1.65,
            margin: "0 0 22px",
            maxWidth: 460,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Anda bisa kembali kapan saja kalau berubah pikiran. Rapot ini tersimpan
          dan link-nya bisa dibuka ulang.
        </p>
        <button
          type="button"
          onClick={() => {
            setDeclined(false);
          }}
          className="btn-mpt btn-mpt-outline"
          style={{
            minHeight: 44,
            fontSize: 13,
            padding: "8px 18px",
          }}
        >
          Berubah pikiran — daftar sesi pengajar
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "36px 28px",
        borderRadius: 24,
        background: "var(--primary)",
        color: "var(--primary-ink)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -80,
          right: -80,
          width: 280,
          height: 280,
          background: "var(--accent)",
          opacity: 0.18,
          borderRadius: "50%",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
        aria-hidden
      />

      <div style={{ position: "relative", maxWidth: 720 }}>
        <div
          className="pill"
          style={{
            background: "color-mix(in oklab, var(--accent), transparent 70%)",
            color: "color-mix(in oklab, var(--accent), white 30%)",
            marginBottom: 14,
          }}
        >
          Langkah Berikutnya
        </div>
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(24px, 3.5vw, 34px)",
            margin: "0 0 14px",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            lineHeight: 1.15,
          }}
        >
          Tertarik mendalami laporan ini langsung dengan pengajar?
        </h2>
        <p
          style={{
            fontSize: 15,
            opacity: 0.85,
            margin: "0 0 26px",
            lineHeight: 1.65,
          }}
        >
          Anda bisa mendaftar sesi pendampingan 60 menit via Zoom. Pengajar akan
          menjelaskan rapot ini lebih dalam, langsung praktek perbaikan, dan
          memberi catatan personal — bersama maksimal 12 peserta lain dengan
          gender yang sama.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => record("yes")}
            disabled={submitting !== null}
            className="btn-mpt btn-mpt-accent"
            style={{
              minHeight: 56,
              fontSize: 15,
              fontWeight: 700,
              opacity: submitting !== null && submitting !== "yes" ? 0.5 : 1,
            }}
          >
            <Heart size={18} strokeWidth={2.4} />
            {submitting === "yes" ? "Memproses..." : "Ya, saya tertarik"}
            <ArrowRight size={16} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            onClick={() => record("no")}
            disabled={submitting !== null}
            className="btn-mpt btn-mpt-outline"
            style={{
              minHeight: 56,
              fontSize: 14,
              fontWeight: 600,
              borderColor: "color-mix(in oklab, var(--primary-ink), transparent 70%)",
              color: "var(--primary-ink)",
              opacity: submitting !== null && submitting !== "no" ? 0.5 : 1,
            }}
          >
            {submitting === "no" ? "Memproses..." : "Nanti dulu"}
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            fontSize: 12,
            opacity: 0.65,
            lineHeight: 1.6,
          }}
        >
          Gratis untuk peserta MPT · Pengajar gender-matched · Sesi tidak direkam
        </div>
      </div>
    </div>
  );
}
