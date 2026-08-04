import Link from "next/link";
import { History } from "lucide-react";
import { bandFor } from "@/lib/teacher-eval/scoring";

/**
 * Riwayat penilaian seorang peserta.
 *
 * Baru muncul kalau peserta pernah dinilai lebih dari sekali — di situlah
 * gunanya: memperlihatkan bahwa bacaannya membaik, sesuatu yang tidak terlihat
 * dari satu rapot tunggal.
 */

export interface HistoryItem {
  slug: string;
  kegiatan: string | null;
  createdAt: string;
  scoreTen: number | null;
}

const TONE_COLOR: Record<string, string> = {
  danger: "var(--danger)",
  warning: "var(--warning)",
  "warning-orange": "var(--terracotta)",
  info: "var(--accent-deep)",
  success: "var(--success)",
};

function tanggal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function AssessmentHistory({
  items,
  currentSlug,
}: {
  items: HistoryItem[];
  currentSlug: string;
}) {
  // Satu penilaian bukan riwayat — tidak ada yang bisa dibandingkan.
  const lain = items.filter((i) => i.slug !== currentSlug);
  if (lain.length === 0) return null;

  const urut = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="card-mpt" style={{ padding: "22px 20px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 14,
        }}
      >
        <History size={14} strokeWidth={2.4} />
        Riwayat Penilaian
        <span
          style={{
            fontSize: 10,
            padding: "2px 7px",
            borderRadius: 999,
            background: "color-mix(in oklab, var(--ink), transparent 92%)",
            letterSpacing: 0,
          }}
        >
          {urut.length}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {urut.map((item) => {
          const sekarang = item.slug === currentSlug;
          const band = item.scoreTen != null ? bandFor(item.scoreTen) : null;
          const warna = band ? (TONE_COLOR[band.tone] ?? "var(--ink-mute)") : "var(--ink-mute)";

          const isi = (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "11px 12px",
                borderRadius: 10,
                background: sekarang
                  ? "color-mix(in oklab, var(--accent), transparent 88%)"
                  : "transparent",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.kegiatan ?? "Assessment Al-Fatihah"}
                  {sekarang && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: "var(--accent-deep)",
                        marginLeft: 8,
                      }}
                    >
                      sedang dibuka
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>
                  {tanggal(item.createdAt)}
                </div>
              </div>

              <span
                style={{
                  flexShrink: 0,
                  fontSize: 13,
                  fontWeight: 800,
                  color: warna,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: `color-mix(in oklab, ${warna}, transparent 88%)`,
                }}
              >
                {item.scoreTen ?? "—"}
                <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.75 }}>/10</span>
              </span>
            </div>
          );

          return sekarang ? (
            <div key={item.slug}>{isi}</div>
          ) : (
            <Link key={item.slug} href={`/rapot/${item.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
              {isi}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
