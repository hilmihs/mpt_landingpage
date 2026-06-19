"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Users } from "lucide-react";

const PROGRAMS = [
  "HITS Assessment Al-Fatihah",
  "HITS Tahsin Al-Fatihah",
  "HITS Dasar",
  "HITS Lanjutan Awal",
  "HITS Lanjutan Menengah",
  "HITS Lanjutan Expert",
  "HITS Ramadhan (HIRS)",
];

export default function PengajuanPage() {
  const router = useRouter();
  const [org, setOrg] = useState("");
  const [pic, setPic] = useState("");
  const [wa, setWa] = useState("");
  const [email, setEmail] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [programs, setPrograms] = useState<string[]>([]);
  const [jadwal, setJadwal] = useState("");
  const [catatan, setCatatan] = useState("");

  const toggleProgram = (p: string) => {
    setPrograms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const canSubmit = org && pic && wa && jumlah && programs.length > 0;

  const handleSubmit = () => {
    const params = new URLSearchParams({ org, pic, wa });
    router.push(`/pengajuan/konfirmasi?${params}`);
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background:
          "radial-gradient(circle at top, color-mix(in oklab, var(--accent), transparent 92%), var(--bg) 50%)",
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
              background: "color-mix(in oklab, var(--accent-deep), transparent 88%)",
              color: "var(--accent-deep)",
              display: "grid",
              placeItems: "center",
              marginBottom: 16,
            }}
          >
            <Users size={28} />
          </div>
          <h1
            className="font-display"
            style={{ fontSize: "clamp(22px, 3.5vw, 28px)", margin: "0 0 6px", fontWeight: 800 }}
          >
            Pengajuan Halaqah
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
            Untuk komunitas, masjid, perusahaan, atau kelompok yang ingin
            mengadakan program HITS secara private untuk anggotanya.
          </p>
        </div>

        <div className="card-mpt" style={{ padding: "24px 22px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Field label="Nama Organisasi / Komunitas *">
              <input
                className="input-mpt"
                placeholder="Masjid Nurul Iman, PT Contoh, dll."
                value={org}
                onChange={(e) => setOrg(e.target.value)}
              />
            </Field>

            <Field label="Nama PIC (Penanggung Jawab) *">
              <input
                className="input-mpt"
                placeholder="Nama lengkap"
                value={pic}
                onChange={(e) => setPic(e.target.value)}
              />
            </Field>

            <div className="grid-2col-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Nomor WhatsApp PIC *">
                <input
                  className="input-mpt"
                  placeholder="08xxxxxxxxxx"
                  value={wa}
                  onChange={(e) => setWa(e.target.value)}
                />
              </Field>
              <Field label="Email PIC">
                <input
                  className="input-mpt"
                  placeholder="email@contoh.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Estimasi Jumlah Peserta *">
              <input
                className="input-mpt"
                placeholder="Contoh: 30"
                type="number"
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
              />
            </Field>

            <Field label="Program yang Diminta *">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PROGRAMS.map((p) => {
                  const active = programs.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`pill-btn${active ? " active" : ""}`}
                      style={{ fontSize: 12, padding: "10px 14px" }}
                      onClick={() => toggleProgram(p)}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Jadwal Preferensi">
              <input
                className="input-mpt"
                placeholder="Contoh: Weekday malam, 2x/minggu"
                value={jadwal}
                onChange={(e) => setJadwal(e.target.value)}
              />
            </Field>

            <Field label="Catatan Tambahan">
              <textarea
                className="input-mpt"
                placeholder="Informasi tambahan yang perlu kami ketahui..."
                rows={3}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                style={{ resize: "vertical" }}
              />
            </Field>

            <button
              className="btn-mpt btn-mpt-accent"
              disabled={!canSubmit}
              onClick={handleSubmit}
              style={{ width: "100%", minHeight: 48, fontSize: 15, marginTop: 8 }}
            >
              Kirim Pengajuan
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
