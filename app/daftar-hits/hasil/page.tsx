"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GraduationCap, ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import {
  getTierInfo,
  DEMO_SLUG,
  type HitsTier,
} from "@/lib/demo-data";

export default function HasilPenempatanPage() {
  const sp = useSearchParams();
  const tier = (sp.get("tier") ?? "dasar") as HitsTier;
  const nama = sp.get("nama") ?? "Peserta";
  const skor = sp.get("skor") ?? "0";
  const total = sp.get("total") ?? "6";

  const info = getTierInfo(tier);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background:
          "radial-gradient(circle at top, color-mix(in oklab, var(--accent), transparent 90%), var(--bg) 50%)",
        padding: "40px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 22 }}>
          {["Data Diri", "Tes Penempatan", "Hasil"].map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: "var(--accent)",
                  marginBottom: 4,
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  fontWeight: i === 2 ? 700 : 400,
                  color: i === 2 ? "var(--accent)" : "var(--ink-mute)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {s}
              </div>
            </div>
          ))}
        </div>

        <div
          className="card-mpt screen-enter"
          style={{ padding: "32px 24px", textAlign: "center", marginBottom: 22 }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              margin: "0 auto 16px",
              borderRadius: 20,
              background: "color-mix(in oklab, var(--accent), transparent 85%)",
              color: "var(--accent-deep)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <GraduationCap size={36} />
          </div>

          <h1
            className="font-display"
            style={{ fontSize: 24, margin: "0 0 8px", fontWeight: 800 }}
          >
            Hasil Tes Penempatan
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--ink-soft)",
              margin: "0 0 6px",
              lineHeight: 1.6,
            }}
          >
            {nama}, skor Anda: <strong>{skor}/{total}</strong>
          </p>
          <p
            style={{
              fontSize: 14,
              color: "var(--ink-soft)",
              margin: "0 0 24px",
              lineHeight: 1.6,
            }}
          >
            Berdasarkan hasil tes, Anda ditempatkan di:
          </p>

          <div
            style={{
              padding: "20px 24px",
              borderRadius: 16,
              background: "color-mix(in oklab, var(--primary), transparent 92%)",
              border: "2px solid color-mix(in oklab, var(--primary), transparent 70%)",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: "var(--primary)",
                  color: "var(--primary-ink)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 15,
                  fontWeight: 800,
                }}
              >
                {info.number}
              </span>
              <span className="font-display" style={{ fontSize: 22, fontWeight: 800 }}>
                {info.name}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.5 }}>
              {info.description}
            </p>
          </div>
        </div>

        <div className="card-mpt" style={{ padding: "22px 20px", marginBottom: 22 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <BookOpen size={18} strokeWidth={2.2} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              Tentang {info.name}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            <InfoRow label="Durasi" value={info.duration} />
            <InfoRow label="Modul" value={info.modul} />
            <InfoRow label="Hafalan" value={info.hafalan} />
            <InfoRow label="Jumlah Sesi" value={`${info.totalSessions} pertemuan`} />
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>
            Materi yang akan dipelajari:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {info.materi.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--ink-soft)",
                  lineHeight: 1.5,
                }}
              >
                <CheckCircle2
                  size={14}
                  strokeWidth={2.4}
                  style={{ color: "var(--success)", marginTop: 3, flexShrink: 0 }}
                />
                {m}
              </div>
            ))}
          </div>
        </div>

        <Link
          href={`/peserta/${DEMO_SLUG}/hits?tier=${tier}&from=jalur2`}
          className="btn-mpt btn-mpt-accent"
          style={{ width: "100%", justifyContent: "center", minHeight: 48, fontSize: 15 }}
        >
          Pilih Jadwal & Daftar Kelas
          <ArrowRight size={16} strokeWidth={2.4} />
        </Link>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid var(--line)",
        fontSize: 14,
      }}
    >
      <span style={{ color: "var(--ink-mute)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
