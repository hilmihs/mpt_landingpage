"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, GraduationCap } from "lucide-react";

export default function DaftarHitsPage() {
  const router = useRouter();
  const [nama, setNama] = useState("");
  const [gender, setGender] = useState<"ikhwan" | "akhwat" | "">("");
  const [wa, setWa] = useState("");
  const [motivasi, setMotivasi] = useState("");

  const canSubmit = nama && gender && wa;

  const handleSubmit = () => {
    const params = new URLSearchParams({
      nama,
      gender,
      wa,
    });
    router.push(`/daftar-hits/penempatan?${params}`);
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background:
          "radial-gradient(circle at top, color-mix(in oklab, var(--primary), transparent 92%), var(--bg) 50%)",
        padding: "40px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--ink-mute)",
            textDecoration: "none",
            fontWeight: 600,
            marginBottom: 22,
          }}
        >
          <ArrowLeft size={13} strokeWidth={2.4} />
          Kembali ke Beranda
        </Link>

        <div className="card-mpt" style={{ padding: "28px 22px", marginBottom: 22 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "color-mix(in oklab, var(--primary), transparent 88%)",
              color: "var(--primary)",
              display: "grid",
              placeItems: "center",
              marginBottom: 16,
            }}
          >
            <GraduationCap size={28} />
          </div>
          <h1
            className="font-display"
            style={{ fontSize: "clamp(22px, 3.5vw, 28px)", margin: "0 0 6px", fontWeight: 800 }}
          >
            Daftar HITS Berjenjang
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
            Sudah bisa membaca Al-Quran? Langsung daftar, ikuti tes penempatan
            singkat, dan masuk kelas sesuai level Anda.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 22,
          }}
        >
          {["Data Diri", "Tes Penempatan", "Hasil"].map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: i === 0 ? "var(--accent)" : "var(--line)",
                  marginBottom: 4,
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  fontWeight: i === 0 ? 700 : 400,
                  color: i === 0 ? "var(--accent)" : "var(--ink-mute)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {s}
              </div>
            </div>
          ))}
        </div>

        <div className="card-mpt" style={{ padding: "24px 22px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Field label="Nama Lengkap *">
              <input
                className="input-mpt"
                placeholder="Nama lengkap Anda"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
              />
            </Field>

            <Field label="Jenis Kelamin *">
              <div style={{ display: "flex", gap: 10 }}>
                {(["ikhwan", "akhwat"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`pill-btn${gender === g ? " active" : ""}`}
                    style={{ flex: 1 }}
                    onClick={() => setGender(g)}
                  >
                    {g === "ikhwan" ? "Ikhwan (Laki-laki)" : "Akhwat (Perempuan)"}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Nomor WhatsApp *">
              <input
                className="input-mpt"
                placeholder="08xxxxxxxxxx"
                value={wa}
                onChange={(e) => setWa(e.target.value)}
              />
            </Field>

            <Field label="Motivasi Belajar (opsional)">
              <textarea
                className="input-mpt"
                placeholder="Ceritakan motivasi Anda ingin belajar Al-Quran..."
                rows={3}
                value={motivasi}
                onChange={(e) => setMotivasi(e.target.value)}
                style={{ resize: "vertical" }}
              />
            </Field>

            <button
              className="btn-mpt btn-mpt-primary"
              disabled={!canSubmit}
              onClick={handleSubmit}
              style={{ width: "100%", minHeight: 48, fontSize: 15, marginTop: 8 }}
            >
              Lanjut ke Tes Penempatan
              <ArrowRight size={16} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink-soft)",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
