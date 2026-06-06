"use client";

import Link from "next/link";
import { use } from "react";
import { useSearchParams } from "next/navigation";
import { Trophy, ArrowRight, Star } from "lucide-react";
import { getTierInfo, getNextTier, HITS_TIERS, type HitsTier } from "@/lib/demo-data";

export default function NaikTingkatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const sp = useSearchParams();
  const from = (sp.get("from") ?? "dasar") as HitsTier;
  const to = (sp.get("to") ?? "lanjutan_awal") as HitsTier;

  const fromInfo = getTierInfo(from);
  const toInfo = getTierInfo(to);
  const isGraduation = !getNextTier(from);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background:
          "radial-gradient(circle at top, color-mix(in oklab, var(--accent), transparent 88%), var(--bg) 60%)",
        padding: "40px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div
          className="card-mpt screen-enter"
          style={{
            padding: "40px 28px",
            textAlign: "center",
            marginBottom: 22,
          }}
        >
          {/* Trophy */}
          <div
            style={{
              width: 88,
              height: 88,
              margin: "0 auto 20px",
              borderRadius: 24,
              background:
                "linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent), var(--primary) 30%))",
              color: "var(--ink)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 16px 40px -16px rgba(212, 162, 86, 0.5)",
            }}
          >
            {isGraduation ? <Star size={42} strokeWidth={1.8} /> : <Trophy size={42} strokeWidth={1.8} />}
          </div>

          {/* Badge */}
          <span
            className="pill"
            style={{
              background: "color-mix(in oklab, var(--success), transparent 85%)",
              color: "var(--success)",
              fontSize: 11,
              marginBottom: 16,
              display: "inline-flex",
            }}
          >
            {isGraduation ? "WISUDA" : "LULUS"}
          </span>

          <h1
            className="font-display"
            style={{
              fontSize: "clamp(24px, 4vw, 32px)",
              margin: "0 0 10px",
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            {isGraduation
              ? "Barakallahu fiik!"
              : `Naik ke ${toInfo.name}!`}
          </h1>

          <p
            style={{
              fontSize: 15,
              color: "var(--ink-soft)",
              margin: "0 0 28px",
              lineHeight: 1.6,
              maxWidth: 440,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {isGraduation
              ? `Anda telah menyelesaikan seluruh jenjang HITS hingga ${fromInfo.name}. Anda siap melanjutkan ke program MAAHIR, Bahasa Arab, atau program lanjutan Majelis Pendidikan lainnya.`
              : `Alhamdulillah, Anda telah menyelesaikan seluruh sesi dan lulus ujian ${fromInfo.name}. Sekarang Anda siap melanjutkan ke tingkat berikutnya.`}
          </p>

          {/* Progression Visual */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              marginBottom: 28,
              flexWrap: "wrap",
            }}
          >
            {HITS_TIERS.map((t, i) => {
              const isDone = t.number <= fromInfo.number;
              const isCurrent = t.id === to;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {i > 0 && (
                    <div
                      style={{
                        width: 24,
                        height: 2,
                        background: isDone ? "var(--accent)" : "var(--line)",
                      }}
                    />
                  )}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: isDone
                        ? "var(--success)"
                        : isCurrent
                          ? "var(--accent)"
                          : "var(--bg-deep)",
                      color: isDone || isCurrent ? "white" : "var(--ink-mute)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 14,
                      fontWeight: 800,
                      border: isCurrent ? "2px solid var(--accent)" : "none",
                    }}
                  >
                    {t.number}
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          {isGraduation ? (
            <div
              style={{
                padding: "16px 20px",
                borderRadius: 12,
                background: "var(--bg)",
                fontSize: 14,
                color: "var(--ink-soft)",
                lineHeight: 1.6,
              }}
            >
              Hubungi pengajar atau admin untuk informasi program lanjutan
              Majelis Pendidikan.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320, margin: "0 auto" }}>
              <Link
                href={`/peserta/${slug}/hits/kelas?tier=${to}&sim=0`}
                className="btn-mpt btn-mpt-accent"
                style={{ width: "100%", justifyContent: "center", minHeight: 48 }}
              >
                Mulai {toInfo.name}
                <ArrowRight size={16} strokeWidth={2.4} />
              </Link>
              <Link
                href={`/peserta/${slug}/hits/kelas?tier=${from}&sim=8`}
                className="btn-mpt btn-mpt-outline"
                style={{ width: "100%", justifyContent: "center", fontSize: 13 }}
              >
                Kembali ke {fromInfo.name}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
