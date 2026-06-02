"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

interface Props {
  rapotSlug: string;
  submissionId: string;
  gate: "gate1_post_rapot" | "gate2_post_assessment" | "gate3_post_tahsin";
  ctaLabel: string;
  ctaHref: string;
}

/**
 * Decline-recovery affordance. POSTs response='yes' to /api/interest
 * (upserts over the prior 'no' / 'later'), then navigates to the gate
 * destination. Used by NextStepsGate's Gate2Declined / Gate3Declined
 * sections so users who deferred earlier can still proceed.
 */
export function ChangeMindButton({
  rapotSlug,
  submissionId,
  gate,
  ctaLabel,
  ctaHref,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rapot_slug: rapotSlug,
          gate,
          response: "yes",
        }),
      });
    } catch {
      // best-effort — proceed even if POST fails
    }
    router.push(ctaHref);
    router.refresh();
  }

  // submissionId is kept as a prop so consumers don't accidentally drop it;
  // analytics impression is fired separately via GateImpressionTracker.
  void submissionId;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="btn-mpt btn-mpt-accent"
      style={{
        minHeight: 44,
        fontSize: 13,
        padding: "8px 18px",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "Memproses..." : ctaLabel}
      <ArrowRight size={14} strokeWidth={2.4} />
    </button>
  );
}
