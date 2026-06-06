"use client";

import Link from "next/link";
import { use } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  Lock,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  Video,
} from "lucide-react";
import {
  getTierInfo,
  generateDemoSessions,
  getNextTier,
  HITS_TIERS,
  type HitsTier,
} from "@/lib/demo-data";

export default function HitsKelasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const sp = useSearchParams();
  const tier = (sp.get("tier") ?? "dasar") as HitsTier;
  const sim = parseInt(sp.get("sim") ?? "3", 10);

  const info = getTierInfo(tier);
  const sessions = generateDemoSessions(tier, sim);
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const totalDisplay = sessions.length;
  const allDone = completedCount >= totalDisplay;
  const progress = Math.round((completedCount / totalDisplay) * 100);
  const nextTier = getNextTier(tier);
  const teacher = "Ustadz Ahmad Hidayat";

  const completedMateri = Math.min(
    completedCount,
    info.materi.length,
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
      <Link
        href={`/peserta/${slug}/hits`}
        className="btn-mpt btn-mpt-outline"
        style={{
          minHeight: 36,
          fontSize: 12,
          padding: "8px 14px",
          marginBottom: 22,
          display: "inline-flex",
        }}
      >
        <ChevronLeft size={14} strokeWidth={2.4} />
        Kembali
      </Link>

      {/* Header Card */}
      <div
        className="card-mpt"
        style={{
          padding: "24px 22px",
          marginBottom: 22,
          background: allDone
            ? "color-mix(in oklab, var(--success), var(--paper) 92%)"
            : undefined,
          borderColor: allDone
            ? "color-mix(in oklab, var(--success), transparent 60%)"
            : undefined,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--primary)",
              color: "var(--primary-ink)",
              display: "grid",
              placeItems: "center",
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            {info.number}
          </span>
          <div>
            <h1
              className="font-display"
              style={{ fontSize: "clamp(20px, 3vw, 26px)", margin: 0, fontWeight: 800 }}
            >
              {info.name}
            </h1>
            <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>
              {info.duration} · Pengajar: {teacher}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink-soft)",
              marginBottom: 6,
            }}
          >
            <span>Progress</span>
            <span>
              {completedCount}/{totalDisplay} sesi
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: "var(--bg-deep)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: allDone ? "var(--success)" : "var(--accent)",
                borderRadius: 999,
                transition: "width 0.6s ease-out",
              }}
            />
          </div>
        </div>

        {allDone && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
              fontSize: 14,
              fontWeight: 700,
              color: "var(--success)",
            }}
          >
            <CheckCircle2 size={18} strokeWidth={2.4} />
            Alhamdulillah, semua sesi selesai!
          </div>
        )}
      </div>

      {/* Materi Section */}
      <div className="card-mpt" style={{ padding: "22px 20px", marginBottom: 22 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <BookOpen size={16} strokeWidth={2.2} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Materi</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {info.materi.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                color: i < completedMateri ? "var(--ink)" : "var(--ink-mute)",
                fontWeight: i < completedMateri ? 600 : 400,
              }}
            >
              {i < completedMateri ? (
                <CheckCircle2
                  size={16}
                  strokeWidth={2.4}
                  style={{ color: "var(--success)", flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    border: "1.5px solid var(--line-strong)",
                    flexShrink: 0,
                  }}
                />
              )}
              {m}
            </div>
          ))}
        </div>
      </div>

      {/* Sessions List */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          Daftar Pertemuan
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sessions.map((s) => {
            const StatusIcon =
              s.status === "completed"
                ? CheckCircle2
                : s.status === "upcoming"
                  ? Clock
                  : Lock;
            const iconColor =
              s.status === "completed"
                ? "var(--success)"
                : s.status === "upcoming"
                  ? "var(--accent)"
                  : "var(--ink-mute)";

            return (
              <Link
                key={s.number}
                href={
                  s.status !== "locked"
                    ? `/peserta/${slug}/hits/kelas/sesi/${s.number}?tier=${tier}&sim=${sim}`
                    : "#"
                }
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  pointerEvents: s.status === "locked" ? "none" : undefined,
                }}
              >
                <div
                  className="card-mpt"
                  style={{
                    padding: "16px 18px",
                    opacity: s.status === "locked" ? 0.5 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <StatusIcon
                    size={20}
                    strokeWidth={2.2}
                    style={{ color: iconColor, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 2,
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700 }}>
                        Sesi {s.number}
                      </span>
                      {s.isExam && (
                        <span
                          className="pill"
                          style={{
                            background:
                              "color-mix(in oklab, var(--warning), transparent 80%)",
                            color: "var(--warning)",
                            fontSize: 9,
                            padding: "3px 8px",
                          }}
                        >
                          <AlertTriangle size={10} />
                          UJIAN
                        </span>
                      )}
                      {s.status === "completed" && (
                        <span
                          className="pill"
                          style={{
                            background:
                              "color-mix(in oklab, var(--success), transparent 85%)",
                            color: "var(--success)",
                            fontSize: 9,
                            padding: "3px 8px",
                          }}
                        >
                          Hadir
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
                      {s.date} · {s.time}
                    </div>
                  </div>

                  {s.status === "upcoming" && s.meetUrl && (
                    <a
                      href={s.meetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-mpt btn-mpt-accent"
                      style={{
                        fontSize: 11,
                        padding: "8px 12px",
                        minHeight: 0,
                        borderRadius: 10,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Video size={13} />
                      Join
                    </a>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* CTA: Naik Tingkat */}
      {allDone && nextTier && (
        <Link
          href={`/peserta/${slug}/hits/kelas/naik-tingkat?from=${tier}&to=${nextTier}`}
          className="btn-mpt btn-mpt-accent"
          style={{ width: "100%", justifyContent: "center", minHeight: 48, fontSize: 15 }}
        >
          Naik ke Tingkat Berikutnya
          <ArrowRight size={16} strokeWidth={2.4} />
        </Link>
      )}

      {allDone && !nextTier && (
        <div
          className="card-mpt"
          style={{
            padding: "24px 22px",
            textAlign: "center",
            background: "color-mix(in oklab, var(--accent), var(--paper) 92%)",
            borderColor: "color-mix(in oklab, var(--accent), transparent 60%)",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎓</div>
          <h2 className="font-display" style={{ fontSize: 20, margin: "0 0 6px", fontWeight: 800 }}>
            Selamat, Anda Telah Menyelesaikan HITS!
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
            Anda siap melanjutkan ke program MAAHIR, Bahasa Arab, atau program
            lanjutan Majelis Pendidikan lainnya.
          </p>
        </div>
      )}

      {/* Demo sim controls */}
      <div
        style={{
          marginTop: 28,
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
          Demo: Simulasi Progress
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
          {[0, 3, 5, 7, totalDisplay].map((n) => (
            <Link
              key={n}
              href={`/peserta/${slug}/hits/kelas?tier=${tier}&sim=${n}`}
              className="btn-mpt btn-mpt-outline"
              style={{
                minHeight: 32,
                fontSize: 11,
                padding: "6px 12px",
                color: sim === n ? "var(--accent)" : "var(--ink-soft)",
                borderColor: sim === n ? "var(--accent)" : undefined,
              }}
            >
              {n} sesi
            </Link>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
          {HITS_TIERS.map((t) => (
            <Link
              key={t.id}
              href={`/peserta/${slug}/hits/kelas?tier=${t.id}&sim=3`}
              className="btn-mpt btn-mpt-outline"
              style={{
                minHeight: 32,
                fontSize: 11,
                padding: "6px 12px",
                color: tier === t.id ? "var(--accent)" : "var(--ink-soft)",
                borderColor: tier === t.id ? "var(--accent)" : undefined,
              }}
            >
              {t.nameShort}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
