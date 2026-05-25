"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MPTLogo, MountainGlyph } from "@/components/shared/MPTLogo";
import { Ornament } from "@/components/shared/Ornament";
import { useScrollAnim } from "@/hooks/useScrollAnim";

const ORNAMENT = "blobs" as const;

export default function LandingPage() {
  useScrollAnim();

  return (
    <div style={{ background: "var(--bg)" }}>
      <Hero />
      <TrustStrip />
      <Indikator />
      <Steps />
      <RapotPreview />
      <CTAStrip />
      <LandingFooter />
    </div>
  );
}

/* ============================================================
 * HERO
 * ============================================================ */
function Hero() {
  return (
    <section
      style={{
        position: "relative",
        padding: "80px 32px 100px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -180,
          right: -180,
          width: 720,
          height: 720,
          opacity: 0.18,
          pointerEvents: "none",
        }}
      >
        <Ornament size={720} variant={ORNAMENT} color="var(--primary)" spinning />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: -200,
          left: -200,
          width: 560,
          height: 560,
          opacity: 0.16,
          pointerEvents: "none",
        }}
      >
        <Ornament size={560} variant={ORNAMENT} color="var(--accent)" spinning />
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }}>
        <div
          className="reveal"
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 28,
            animationDelay: "0.1s",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 18px",
              borderRadius: 999,
              background: "var(--paper)",
              border: "1px solid var(--line)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--accent)",
              }}
            />
            Assessment Bacaan Al-Fatihah
          </div>
        </div>

        <div
          className="reveal"
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 40,
            animationDelay: "0.2s",
          }}
        >
          <div style={{ animation: "float 5s ease-in-out infinite" }}>
            <MPTLogo size={220} priority />
          </div>
        </div>

        <h1
          className="font-display reveal"
          style={{
            fontSize: "clamp(44px, 6vw, 80px)",
            lineHeight: 1.02,
            margin: 0,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--ink)",
            textAlign: "center",
            animationDelay: "0.4s",
            textWrap: "balance",
          }}
        >
          Perbaiki bacaan{" "}
          <span style={{ color: "var(--primary)" }}>
            <span className="ink-underline">Al-Fatihah</span>
          </span>
          <br />
          <span style={{ color: "var(--ink-soft)", fontWeight: 700 }}>
            dapatkan umpan balik awalnya di sini.
          </span>
        </h1>

        <p
          className="reveal"
          style={{
            maxWidth: 640,
            margin: "28px auto 0",
            fontSize: 19,
            fontWeight: 400,
            lineHeight: 1.6,
            color: "var(--ink-soft)",
            animationDelay: "0.55s",
            textWrap: "pretty",
            textAlign: "center",
          }}
        >
          Rekam bacaan Al-Fatihah Anda — sistem membantu mengenali{" "}
          <strong style={{ color: "var(--ink)", fontWeight: 700 }}>
            4 jenis kesalahan umum
          </strong>{" "}
          (harakat, huruf, panjang pendek, syaddah) dan menyiapkan pratinjau
          rapot dalam 30 detik.
        </p>

        <div
          className="reveal"
          style={{
            marginTop: 40,
            display: "flex",
            justifyContent: "center",
            gap: 16,
            flexWrap: "wrap",
            animationDelay: "0.7s",
          }}
        >
          <Link className="btn-primary" href="/assessment/consent">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            Mulai Assessment Gratis
          </Link>
          <a className="btn-ghost" href="#cara-kerja">
            Lihat Cara Kerja
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        <div
          className="reveal"
          style={{
            marginTop: 28,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink-mute)",
            animationDelay: "0.85s",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            100% Gratis
          </span>
          <Dot />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Privasi Terjaga
          </span>
          <Dot />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            Audio dihapus 7 hari
          </span>
        </div>

        <div
          className="reveal"
          style={{ marginTop: 72, animationDelay: "0.95s" }}
        >
          <div
            className="hero-waveform-card"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: 24,
              padding: "32px 40px",
              maxWidth: 980,
              margin: "0 auto",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 40px 80px -50px rgba(26,31,42,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ position: "relative", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className="mic-glow" />
                  <div
                    style={{
                      position: "relative",
                      zIndex: 1,
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--primary)",
                      color: "var(--primary-ink)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="9" y="3" width="6" height="12" rx="3" />
                      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--ink-mute)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    Sedang Mendengarkan
                  </div>
                  <div
                    className="font-display"
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: "var(--ink)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Rekaman Bacaan Anda
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--ink-soft)",
                  fontFamily: "monospace",
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#d44",
                    animation: "glowPulse 1.6s ease-in-out infinite",
                  }}
                />
                0:08 / 0:30
              </div>
            </div>
            <Waveform bars={56} height={88} />
          </div>
        </div>

        <div
          className="scroll-hint"
          style={{
            marginTop: 56,
            display: "flex",
            justifyContent: "center",
            color: "var(--ink-mute)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </div>
    </section>
  );
}

function Dot() {
  return (
    <span
      style={{
        width: 3,
        height: 3,
        borderRadius: "50%",
        background: "var(--line-strong)",
      }}
    />
  );
}

/* ============================================================
 * WAVEFORM
 * ============================================================ */
function Waveform({ bars = 56, height = 88 }: { bars?: number; height?: number }) {
  const seeds = useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => {
        const h = 0.3 + Math.abs(Math.sin(i * 0.4) * 0.5) + ((i * 37) % 30) / 100;
        const delay = (i * 0.03) % 1.4;
        const duration = 1.2 + ((i * 53) % 80) / 100;
        return {
          height: `${(h * 100).toFixed(2)}%`,
          delay: `${delay.toFixed(2)}s`,
          duration: `${duration.toFixed(2)}s`,
        };
      }),
    [bars],
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        height,
        padding: "0 24px",
      }}
    >
      {seeds.map((s, i) => (
        <div
          key={i}
          className="wave-bar"
          style={{
            height: s.height,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }}
        />
      ))}
    </div>
  );
}

/* ============================================================
 * TRUST STRIP
 * ============================================================ */
function TrustStrip() {
  const items = [
    "Untuk peserta Program Tahsin",
    "Umpan balik bacaan otomatis",
    "100% gratis untuk seluruh ummat",
    "Hasil dalam ≤ 30 detik",
    "Data residency Indonesia (UU PDP)",
    "Audio peserta dihapus 7 hari",
  ];
  return (
    <section
      style={{
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        background: "color-mix(in oklab, var(--paper), var(--bg-deep) 30%)",
        padding: "20px 0",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(90deg, var(--bg) 0%, transparent 8%, transparent 92%, var(--bg) 100%)",
          zIndex: 1,
        }}
      />
      <div style={{ whiteSpace: "nowrap", display: "flex" }}>
        <div className="marquee-track">
          {[...items, ...items].map((it, i) => (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 16,
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ink-soft)",
                letterSpacing: "0.01em",
              }}
            >
              <MountainGlyph size={20} color="var(--accent)" />
              {it}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * 4 INDIKATOR
 * ============================================================ */
function Indikator() {
  const items = [
    {
      label: "Harakat",
      arab: "حَرَكَة",
      color: "var(--indikator-harakat)",
      desc: "Tanda baca fathah, kasrah, dhammah, sukun — agar makna ayat tidak berubah.",
    },
    {
      label: "Huruf",
      arab: "حُرُوف",
      color: "var(--indikator-huruf)",
      desc: "Pengucapan makharijul huruf yang tepat — ع, ح, ق, ك, dan seterusnya.",
    },
    {
      label: "Mad",
      arab: "مَدّ",
      color: "var(--indikator-mad)",
      desc: "Panjang pendek bacaan sesuai kaidah — 2, 4, atau 6 harakat.",
    },
    {
      label: "Syaddah",
      arab: "شَدَّة",
      color: "var(--indikator-syaddah)",
      desc: "Penekanan huruf bertasydid — diucapkan dengan dua kali ucapan.",
    },
  ];
  return (
    <section
      id="indikator"
      style={{ padding: "120px 32px", position: "relative" }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <div
            className="scroll-anim dot-divider"
            style={{ maxWidth: 380, margin: "0 auto 24px" }}
          >
            <span>4 Indikator Kesalahan</span>
          </div>
          <h2
            className="scroll-anim font-display"
            style={{
              fontSize: "clamp(40px, 4.8vw, 64px)",
              margin: "0 0 20px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--ink)",
              lineHeight: 1.05,
            }}
          >
            Empat hal yang{" "}
            <span style={{ color: "var(--accent-deep)" }}>sistem dengarkan</span>
            <br />
            dalam bacaan Anda.
          </h2>
          <p
            className="scroll-anim"
            style={{
              fontSize: 17,
              color: "var(--ink-soft)",
              maxWidth: 640,
              margin: "0 auto",
              lineHeight: 1.6,
              fontWeight: 400,
            }}
          >
            Lebih dari sekadar transkripsi suara — sistem menyoroti potensi
            kesalahan yang dapat mengubah makna ayat. Hasilnya bersifat umpan
            balik awal, bukan pengganti penilaian Ustadz/Ustadzah langsung.
          </p>
        </div>

        <div
          className="indikator-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
          }}
        >
          {items.map((it, i) => (
            <div
              key={i}
              className="scroll-anim card-accent"
              style={{ transitionDelay: `${i * 0.08}s` }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: 24,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: it.color,
                    boxShadow: `0 0 0 4px color-mix(in oklab, ${it.color}, transparent 80%)`,
                    marginTop: 8,
                  }}
                />
                <div
                  className="font-arabic"
                  dir="rtl"
                  style={{
                    fontSize: 44,
                    fontWeight: 700,
                    color: it.color,
                    lineHeight: 1,
                    opacity: 0.9,
                  }}
                >
                  {it.arab}
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                  marginBottom: 6,
                }}
              >
                Indikator {String(i + 1).padStart(2, "0")}
              </div>
              <h3
                className="font-display"
                style={{
                  fontSize: 26,
                  margin: "0 0 10px",
                  fontWeight: 800,
                  color: "var(--ink)",
                  letterSpacing: "-0.02em",
                }}
              >
                {it.label}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "var(--ink-soft)",
                  margin: 0,
                  fontWeight: 400,
                }}
              >
                {it.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * STEPS
 * ============================================================ */
function Steps() {
  const steps = [
    {
      n: "01",
      title: "Rekam Bacaan",
      desc: "Bismillah, lalu bacakan Al-Fatihah dengan tenang. Maksimal 5 menit di browser Anda.",
      icon: "mic",
    },
    {
      n: "02",
      title: "Analisis Sistem",
      desc: "Sistem menandai potensi kesalahan pada 4 indikator dalam ≤ 30 detik.",
      icon: "scan",
    },
    {
      n: "03",
      title: "Rapot + Rekomendasi",
      desc: "Skor 1–5 lengkap dengan highlight kesalahan, dan undangan ke Program Tahsin.",
      icon: "award",
    },
  ] as const;
  return (
    <section
      id="cara-kerja"
      style={{
        padding: "120px 32px",
        background: "color-mix(in oklab, var(--bg), var(--bg-deep) 50%)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <div
            className="scroll-anim dot-divider"
            style={{ maxWidth: 240, margin: "0 auto 24px" }}
          >
            <span>Tiga Langkah</span>
          </div>
          <h2
            className="scroll-anim font-display"
            style={{
              fontSize: "clamp(40px, 4.8vw, 64px)",
              margin: 0,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            Dari niat hingga rapot —{" "}
            <span style={{ color: "var(--accent-deep)" }}>tiga menit saja</span>.
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 32,
            position: "relative",
          }}
        >
          <div
            className="scroll-anim steps-connector"
            style={{
              position: "absolute",
              top: 40,
              left: "15%",
              right: "15%",
              height: 1,
              background:
                "linear-gradient(90deg, transparent, var(--line-strong) 20%, var(--line-strong) 80%, transparent)",
              zIndex: 0,
            }}
          />
          {steps.map((s, i) => (
            <div
              key={i}
              className="scroll-anim"
              style={{
                position: "relative",
                textAlign: "center",
                transitionDelay: `${0.1 + i * 0.15}s`,
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "var(--paper)",
                  border: "1px solid var(--line-strong)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                  position: "relative",
                  zIndex: 1,
                  color: "var(--primary)",
                  boxShadow: "0 20px 40px -25px rgba(26,31,42,0.3)",
                  transition: "transform 0.4s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.08) rotate(-3deg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1) rotate(0)";
                }}
              >
                <StepIcon kind={s.icon} />
                <span
                  className="font-display"
                  style={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    fontSize: 13,
                    fontWeight: 800,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    color: "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {s.n[1]}
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                  marginBottom: 8,
                }}
              >
                Langkah {s.n}
              </div>
              <h3
                className="font-display"
                style={{
                  fontSize: 26,
                  margin: "0 0 12px",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  fontSize: 15,
                  color: "var(--ink-soft)",
                  margin: "0 auto",
                  lineHeight: 1.6,
                  maxWidth: 320,
                  fontWeight: 400,
                }}
              >
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepIcon({ kind }: { kind: "mic" | "scan" | "award" }) {
  const common = {
    width: 32,
    height: 32,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (kind === "mic") {
    return (
      <svg {...common}>
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    );
  }
  if (kind === "scan") {
    return (
      <svg {...common}>
        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        <line x1="7" y1="12" x2="17" y2="12" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

/* ============================================================
 * RAPOT PREVIEW
 * ============================================================ */
function RapotPreview() {
  const rows = [
    { label: "Harakat", val: 95, color: "var(--indikator-harakat)" },
    { label: "Huruf", val: 88, color: "var(--indikator-huruf)" },
    { label: "Mad", val: 76, color: "var(--indikator-mad)" },
    { label: "Syaddah", val: 92, color: "var(--indikator-syaddah)" },
  ];
  return (
    <section style={{ padding: "120px 32px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          className="scroll-anim scale rapot-preview-grid"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: 28,
            padding: 40,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)",
            gap: 48,
            alignItems: "center",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 40px 80px -50px rgba(26, 31, 42, 0.3)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -100,
              right: -100,
              width: 320,
              height: 320,
              opacity: 0.18,
            }}
          >
            <Ornament size={320} variant="ripples" color="var(--accent)" spinning />
          </div>

          <div
            className="scroll-anim from-left"
            style={{ position: "relative", transitionDelay: "0.2s" }}
          >
            <div
              className="dot-divider"
              style={{ maxWidth: 200, margin: "0 0 20px" }}
            >
              <span>Contoh Rapot</span>
            </div>
            <h3
              className="font-display"
              style={{
                fontSize: 36,
                margin: "0 0 18px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
              }}
            >
              Skor 1–5, bukan angka kosong — tapi{" "}
              <span style={{ color: "var(--accent-deep)" }}>peta langkah</span>{" "}
              berikutnya.
            </h3>
            <p
              style={{
                fontSize: 16,
                color: "var(--ink-soft)",
                margin: "0 0 28px",
                lineHeight: 1.6,
                fontWeight: 400,
              }}
            >
              Setiap rapot menunjukkan ayat & kata mana yang perlu diperbaiki,
              di kategori apa, dan langkah konkret untuk memperbaikinya.
            </p>
            <Link className="btn-ghost" href="/assessment/consent">
              Coba Sekarang
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div
            className="scroll-anim from-right"
            style={{
              background: "var(--bg)",
              border: "1px solid var(--line)",
              borderRadius: 20,
              padding: 28,
              position: "relative",
              transitionDelay: "0.3s",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                }}
              >
                Rapot · Contoh
              </div>
              <MountainGlyph size={28} color="var(--accent)" />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                marginBottom: 4,
              }}
            >
              <span
                className="font-display"
                style={{
                  fontSize: 88,
                  fontWeight: 800,
                  color: "var(--primary)",
                  lineHeight: 1,
                  letterSpacing: "-0.05em",
                }}
              >
                4
              </span>
              <span
                style={{
                  fontSize: 22,
                  color: "var(--ink-mute)",
                  fontWeight: 600,
                }}
              >
                / 5
              </span>
            </div>
            <div
              className="font-display"
              style={{
                fontSize: 22,
                color: "var(--accent-deep)",
                marginBottom: 24,
                fontWeight: 700,
              }}
            >
              Bacaan Sangat Baik
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {rows.map((r, i) => (
                <div key={i}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                      fontSize: 13,
                      color: "var(--ink-soft)",
                      fontWeight: 600,
                    }}
                  >
                    <span>{r.label}</span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        color: "var(--ink)",
                        fontWeight: 700,
                      }}
                    >
                      {r.val}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 999,
                      background: "var(--bg-deep)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      className="scroll-anim bar-grow"
                      style={
                        {
                          height: "100%",
                          background: r.color,
                          borderRadius: 999,
                          transitionDelay: `${0.6 + i * 0.12}s`,
                          "--w": `${r.val}%`,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * CTA STRIP
 * ============================================================ */
function CTAStrip() {
  return (
    <section id="mulai" style={{ padding: "60px 32px 120px", position: "relative" }}>
      <div
        className="scroll-anim scale cta-strip-inner"
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          background: "var(--primary)",
          color: "var(--primary-ink)",
          borderRadius: 32,
          padding: "80px 56px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -100,
            left: -100,
            width: 320,
            height: 320,
            opacity: 0.22,
          }}
        >
          <Ornament size={320} variant={ORNAMENT} color="var(--accent)" spinning />
        </div>
        <div
          style={{
            position: "absolute",
            bottom: -100,
            right: -100,
            width: 320,
            height: 320,
            opacity: 0.22,
          }}
        >
          <Ornament size={320} variant={ORNAMENT} color="var(--accent)" spinning />
        </div>

        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 36,
            }}
          >
            <div style={{ animation: "float 5s ease-in-out infinite" }}>
              <MPTLogo size={150} />
            </div>
          </div>

          <h2
            className="font-display"
            style={{
              fontSize: "clamp(40px, 5vw, 64px)",
              margin: "0 0 20px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            Mari mulai{" "}
            <span style={{ color: "color-mix(in oklab, var(--accent), white 30%)" }}>
              perbaiki
            </span>
            .
          </h2>
          <p
            style={{
              fontSize: 18,
              opacity: 0.8,
              maxWidth: 580,
              margin: "0 auto 40px",
              lineHeight: 1.6,
              fontWeight: 400,
            }}
          >
            Tidak perlu daftar. Tidak ada biaya. Cukup mikrofon, niat, dan tiga
            menit waktu Anda.
          </p>

          <Link
            className="btn-primary"
            href="/assessment/consent"
            style={{
              background: "var(--accent)",
              color: "var(--ink)",
              fontSize: 17,
              padding: "20px 36px",
              fontWeight: 700,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            Mulai Assessment Gratis
          </Link>

          <div
            style={{
              marginTop: 24,
              fontSize: 13,
              opacity: 0.65,
              fontWeight: 500,
            }}
          >
            Gratis · Privasi terjaga · Audio dihapus otomatis dalam 7 hari
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * LANDING FOOTER (4-col marketing)
 * ============================================================ */
function LandingFooter() {
  const cols = [
    {
      h: "Assessment",
      items: ["Mulai Assessment", "Cara Kerja", "4 Indikator", "Contoh Rapot"],
    },
    {
      h: "Program",
      items: ["Tahsin Al-Fatihah", "Tahsin Lanjutan", "Tahfidz", "Jadwal Kelas"],
    },
    {
      h: "Tentang",
      items: ["Tentang Kami", "Privasi", "Syarat & Ketentuan", "Kontak"],
    },
  ];
  return (
    <footer
      id="tahsin"
      style={{
        borderTop: "1px solid var(--line)",
        padding: "60px 32px 40px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          className="footer-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
            gap: 48,
            marginBottom: 48,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <MPTLogo size={80} />
              <div
                style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}
              >
                <span
                  className="font-display"
                  style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)" }}
                >
                  MuhajirProject
                </span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--accent-deep)",
                  }}
                >
                  #Tilawah
                </span>
              </div>
            </div>
            <p
              style={{
                fontSize: 14,
                color: "var(--ink-soft)",
                lineHeight: 1.6,
                margin: 0,
                maxWidth: 360,
                fontWeight: 400,
              }}
            >
              Lembaga pendampingan tilawah Al-Quran di Indonesia. Membantu
              setiap muslim memperbaiki bacaan Al-Fatihah — ayat yang dibaca
              dalam setiap rakaat shalat.
            </p>
          </div>
          {cols.map((col, i) => (
            <div key={i}>
              <h4
                style={{
                  fontSize: 12,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                  margin: "0 0 16px",
                  fontWeight: 700,
                }}
              >
                {col.h}
              </h4>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {col.items.map((it, j) => (
                  <li key={j}>
                    <a
                      href="#"
                      style={{
                        fontSize: 14,
                        color: "var(--ink-soft)",
                        textDecoration: "none",
                        fontWeight: 500,
                        transition: "color 0.2s",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.color = "var(--ink)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.color = "var(--ink-soft)";
                      }}
                    >
                      {it}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          style={{
            paddingTop: 32,
            borderTop: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            fontSize: 12,
            color: "var(--ink-mute)",
            fontWeight: 500,
          }}
        >
          <span>
            © {new Date().getFullYear()} Muhajir Project Tilawah · Audio
            peserta disimpan maksimal 7 hari · Data residency Indonesia
          </span>
        </div>
      </div>
      <style>{`
        @media (max-width: 800px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 520px) {
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  );
}
