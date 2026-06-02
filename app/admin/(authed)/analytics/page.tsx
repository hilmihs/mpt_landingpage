import { Activity } from "lucide-react";
import { supabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface EventCount {
  event_name: string;
  count: number;
}

async function fetchEventCounts(): Promise<EventCount[]> {
  const sb = supabaseService();
  try {
    const { data } = await sb
      .from("analytics_events")
      .select("event_name")
      .gte(
        "occurred_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      );

    if (!data) return [];
    const counts = new Map<string, number>();
    for (const e of data) {
      const name = e.event_name as string;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([event_name, count]) => ({ event_name, count }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export default async function AnalyticsPage() {
  const events = await fetchEventCounts();

  return (
    <div style={{ maxWidth: 880 }}>
      <header style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
            marginBottom: 6,
          }}
        >
          Analytics
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(24px, 3.5vw, 32px)",
            fontWeight: 800,
            margin: 0,
            letterSpacing: "-0.025em",
          }}
        >
          Event Tracking
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            margin: "6px 0 0",
            maxWidth: 600,
          }}
        >
          30 hari terakhir, dari tabel <code>analytics_events</code>.
        </p>
      </header>

      {events.length === 0 ? (
        <div
          className="card-mpt"
          style={{ padding: "48px 28px", textAlign: "center" }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 16px",
              borderRadius: 14,
              background: "color-mix(in oklab, var(--accent), transparent 85%)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Activity size={24} strokeWidth={2.2} />
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-soft)",
              lineHeight: 1.6,
            }}
          >
            Belum ada event terekam.
          </p>
        </div>
      ) : (
        <div
          className="card-mpt"
          style={{
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {events.map((e) => (
            <div
              key={e.event_name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <code
                style={{
                  fontSize: 12,
                  color: "var(--ink)",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                {e.event_name}
              </code>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--accent)",
                }}
              >
                {e.count.toLocaleString("id-ID")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
