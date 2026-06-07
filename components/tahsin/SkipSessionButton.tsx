"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SkipForward, Loader2 } from "lucide-react";

export function SkipSessionButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function skip() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/dev/skip-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error ?? "Gagal");
        return;
      }
      setResult(
        data.done
          ? `Semua sesi selesai (${data.completed}/${data.total})`
          : `Sesi ${data.skipped_session} ditandai hadir (${data.completed}/${data.total})`,
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 20,
        padding: "16px 20px",
        borderRadius: 12,
        border: "1px dashed var(--ink-mute)",
        background: "color-mix(in oklab, var(--warning), transparent 92%)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 8,
        }}
      >
        Dev Mode
      </div>
      <button
        onClick={skip}
        disabled={loading}
        className="btn-mpt btn-mpt-outline"
        style={{
          minHeight: 38,
          fontSize: 12,
          color: "var(--ink-soft)",
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? (
          <Loader2 size={14} strokeWidth={2.2} className="animate-spin" />
        ) : (
          <SkipForward size={14} strokeWidth={2.2} />
        )}
        Skip 1 Pertemuan (insert attendance)
      </button>
      {result && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "var(--ink-soft)",
            fontWeight: 600,
          }}
        >
          {result}
        </div>
      )}
    </div>
  );
}
