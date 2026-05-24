"use client";

import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 2500; // ≥ 2 detik per CLAUDE.md

export interface StatusResponse {
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  rapot_url?: string;
  error_message?: string;
}

export function useRapotPolling(slug: string | null) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/rapot/${slug}/status`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: StatusResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setNetworkError(null);
        if (json.status === "completed" || json.status === "failed") return;
        timer = window.setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        setNetworkError((err as Error).message);
        timer = window.setTimeout(poll, POLL_INTERVAL_MS * 2);
      }
    };

    let timer = window.setTimeout(poll, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slug]);

  return { data, networkError };
}
