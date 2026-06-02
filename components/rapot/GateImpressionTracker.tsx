"use client";

import { useEffect, useRef } from "react";

interface Props {
  gate: "gate1_post_rapot" | "gate2_post_assessment" | "gate3_post_tahsin";
  submissionId: string;
}

/**
 * Fire-and-forget impression tracker. Renders nothing visible — purpose is
 * to emit one analytics_events row when the parent gate section mounts.
 *
 * Mount-once guard: re-renders within the same React tree don't double-fire.
 * Refresh / navigate-back will refire (intentional — each impression counts).
 */
export function GateImpressionTracker({ gate, submissionId }: Props) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    // best-effort beacon — don't block render or surface errors to user
    fetch("/api/gate-impression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gate, submission_id: submissionId }),
      keepalive: true,
    }).catch(() => {
      /* ignore */
    });
  }, [gate, submissionId]);

  return null;
}
