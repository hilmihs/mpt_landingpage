"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAssessmentStore } from "@/lib/store";

const ICONS = {
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),
} as const;

const ITEMS = [
  {
    icon: "clock" as const,
    title: "Audio disimpan 7 hari",
    desc: "Rekaman suara dihapus otomatis setelah 7 hari.",
  },
  {
    icon: "shield" as const,
    title: "Tidak dibagikan",
    desc: "Audio hanya diproses oleh sistem MPT. Tidak diberikan ke pihak ketiga.",
  },
  {
    icon: "phone" as const,
    title: "Untuk tindak lanjut",
    desc: "Nama & nomor WA digunakan untuk pengiriman hasil dan ajakan Program Perbaikan Bacaan (opsional).",
  },
  {
    icon: "info" as const,
    title: "Sebagai referensi",
    desc: "Hasil bersifat referensi belajar, bukan pengganti penilaian dari pengajar langsung.",
  },
];

export default function ConsentPage() {
  const router = useRouter();
  const setConsent = useAssessmentStore((s) => s.setConsent);

  const handleAgree = () => {
    setConsent(true);
    router.push("/assessment/record");
  };

  return (
    <div
      className="screen-enter"
      style={{
        maxWidth: 680,
        margin: "0 auto",
        padding: "48px 20px 80px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div
          className="pill"
          style={{
            background: "var(--paper)",
            color: "var(--ink-soft)",
            border: "1px solid var(--line)",
            marginBottom: 16,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--accent)",
            }}
          />
          Sebelum mulai
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(32px, 5vw, 52px)",
            margin: "0 0 14px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
          }}
        >
          Persetujuan{" "}
          <span style={{ color: "var(--accent-deep)" }}>Privasi</span>
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--ink-soft)",
            margin: "0 auto",
            lineHeight: 1.6,
            maxWidth: 480,
          }}
        >
          Bismillah. Mohon baca dan setujui ketentuan berikut sebelum mulai
          merekam.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 36,
        }}
      >
        {ITEMS.map((it, i) => (
          <div
            key={i}
            className="card-mpt"
            style={{
              padding: 18,
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              animation: `fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) ${
                0.12 + i * 0.1
              }s both`,
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background:
                  "color-mix(in oklab, var(--accent), transparent 80%)",
                color: "var(--accent-deep)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICONS[it.icon]}
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginBottom: 4,
                }}
              >
                {it.title}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--ink-soft)",
                  lineHeight: 1.55,
                }}
              >
                {it.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          animation: "fadeUp 0.6s 0.6s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <button
          className="btn-mpt btn-mpt-primary"
          onClick={handleAgree}
          style={{ minHeight: 56, fontSize: 16 }}
        >
          Saya setuju, lanjutkan
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
        <Link
          href="/"
          className="btn-mpt btn-mpt-outline"
          style={{ minHeight: 52 }}
        >
          Batal
        </Link>
      </div>
    </div>
  );
}
