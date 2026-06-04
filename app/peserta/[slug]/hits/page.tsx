"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronLeft,
  BookOpen,
  GraduationCap,
  Calendar,
  Clock,
  CheckCircle2,
  ArrowRight,
  SkipForward,
} from "lucide-react";

interface HitsProgram {
  id: string;
  name: string;
  level: "dasar" | "lanjutan";
  scheduleType: "weekday" | "weekend";
  days: string;
  time: string;
  teacher: string;
  gender: "ikhwan" | "akhwat";
  capacity: number;
  enrolled: number;
}

const DUMMY_PROGRAMS: HitsProgram[] = [
  {
    id: "hits-dasar-wd-1",
    name: "HITS Dasar — Weekday Pagi",
    level: "dasar",
    scheduleType: "weekday",
    days: "Senin & Rabu",
    time: "08.00 – 09.30 WIB",
    teacher: "Ustadz Ahmad Hidayat",
    gender: "ikhwan",
    capacity: 20,
    enrolled: 8,
  },
  {
    id: "hits-dasar-wd-2",
    name: "HITS Dasar — Weekday Malam",
    level: "dasar",
    scheduleType: "weekday",
    days: "Selasa & Kamis",
    time: "19.30 – 21.00 WIB",
    teacher: "Ustadzah Aisyah Rahmawati",
    gender: "akhwat",
    capacity: 20,
    enrolled: 12,
  },
  {
    id: "hits-dasar-we-1",
    name: "HITS Dasar — Weekend",
    level: "dasar",
    scheduleType: "weekend",
    days: "Sabtu & Ahad",
    time: "09.00 – 10.30 WIB",
    teacher: "Ustadz Yusuf Mahmud",
    gender: "ikhwan",
    capacity: 20,
    enrolled: 5,
  },
  {
    id: "hits-dasar-we-2",
    name: "HITS Dasar — Weekend Sore",
    level: "dasar",
    scheduleType: "weekend",
    days: "Sabtu & Ahad",
    time: "15.00 – 16.30 WIB",
    teacher: "Ustadzah Fatimah Az-Zahra",
    gender: "akhwat",
    capacity: 20,
    enrolled: 14,
  },
  {
    id: "hits-lanjut-wd-1",
    name: "HITS Lanjutan — Weekday Malam",
    level: "lanjutan",
    scheduleType: "weekday",
    days: "Senin & Rabu",
    time: "19.30 – 21.00 WIB",
    teacher: "Ustadz Ahmad Hidayat",
    gender: "ikhwan",
    capacity: 15,
    enrolled: 6,
  },
  {
    id: "hits-lanjut-wd-2",
    name: "HITS Lanjutan — Weekday Sore",
    level: "lanjutan",
    scheduleType: "weekday",
    days: "Selasa & Kamis",
    time: "16.00 – 17.30 WIB",
    teacher: "Ustadzah Aisyah Rahmawati",
    gender: "akhwat",
    capacity: 15,
    enrolled: 9,
  },
  {
    id: "hits-lanjut-we-1",
    name: "HITS Lanjutan — Weekend",
    level: "lanjutan",
    scheduleType: "weekend",
    days: "Sabtu & Ahad",
    time: "10.30 – 12.00 WIB",
    teacher: "Ustadz Yusuf Mahmud",
    gender: "ikhwan",
    capacity: 15,
    enrolled: 3,
  },
  {
    id: "hits-lanjut-we-2",
    name: "HITS Lanjutan — Weekend Sore",
    level: "lanjutan",
    scheduleType: "weekend",
    days: "Sabtu & Ahad",
    time: "16.30 – 18.00 WIB",
    teacher: "Ustadzah Fatimah Az-Zahra",
    gender: "akhwat",
    capacity: 15,
    enrolled: 7,
  },
];

type Step = "level" | "schedule" | "program" | "confirm";

export default function HitsEnrollmentPage({
  params: _params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("level");
  const [level, setLevel] = useState<"dasar" | "lanjutan" | null>(null);
  const [scheduleType, setScheduleType] = useState<"weekday" | "weekend" | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<HitsProgram | null>(null);
  const [enrolled, setEnrolled] = useState(false);

  if (!slug) {
    _params.then((p) => setSlug(p.slug));
  }

  const filteredPrograms = DUMMY_PROGRAMS.filter(
    (p) =>
      p.level === level &&
      p.scheduleType === scheduleType &&
      p.enrolled < p.capacity,
  );

  if (enrolled && selectedProgram) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
        <div
          className="card-mpt"
          style={{
            padding: "32px 22px",
            textAlign: "center",
            background: "color-mix(in oklab, var(--success), var(--surface) 92%)",
            borderColor: "color-mix(in oklab, var(--success), transparent 60%)",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 16px",
              borderRadius: 16,
              background: "var(--success)",
              color: "white",
              display: "grid",
              placeItems: "center",
            }}
          >
            <CheckCircle2 size={32} strokeWidth={2.4} />
          </div>
          <h1
            className="font-display"
            style={{ fontSize: 26, margin: "0 0 8px", fontWeight: 800 }}
          >
            Pendaftaran HITS Berhasil!
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 20px", lineHeight: 1.6 }}>
            Anda terdaftar di <strong>{selectedProgram.name}</strong>.
            Jadwal: {selectedProgram.days}, {selectedProgram.time}.
            Pengajar: {selectedProgram.teacher}.
          </p>
        </div>

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
            Dev Mode
          </div>
          <Link
            href={`/peserta/${slug}?dev=1`}
            className="btn-mpt btn-mpt-outline"
            style={{ minHeight: 36, fontSize: 12, color: "var(--ink-soft)" }}
          >
            <SkipForward size={14} strokeWidth={2.2} />
            Ke Dashboard Peserta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
      {slug && (
        <Link
          href={`/peserta/${slug}/tahsin/report?dev=1`}
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
      )}

      <div className="card-mpt" style={{ padding: "28px 22px", marginBottom: 22 }}>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(22px, 3.5vw, 28px)",
            margin: "0 0 6px",
            fontWeight: 800,
          }}
        >
          Daftar HITS
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
          Halaqah Intensif Tahsin — program lanjutan untuk mendalami tajwid dan
          memperbaiki bacaan Al-Quran secara intensif.
        </p>
      </div>

      <StepIndicator current={step} />

      {step === "level" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
          <OptionCard
            icon={<BookOpen size={24} />}
            title="Kelas Dasar"
            description="Untuk yang baru mengenal tajwid atau ingin menguatkan fondasi. Cocok untuk pemula."
            selected={level === "dasar"}
            onClick={() => { setLevel("dasar"); setStep("schedule"); }}
          />
          <OptionCard
            icon={<GraduationCap size={24} />}
            title="Kelas Lanjutan"
            description="Untuk yang sudah memahami dasar tajwid dan ingin mendalami. Terdapat pre-test."
            selected={level === "lanjutan"}
            onClick={() => { setLevel("lanjutan"); setStep("schedule"); }}
          />
        </div>
      )}

      {step === "schedule" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
          <button
            onClick={() => setStep("level")}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent)",
              fontSize: 13,
              cursor: "pointer",
              textAlign: "left",
              padding: 0,
              marginBottom: 4,
            }}
          >
            ← Ganti level
          </button>
          <OptionCard
            icon={<Calendar size={24} />}
            title="Weekday"
            description="Pilih hari belajar di hari kerja. Pilihan hari & jam di step berikutnya."
            selected={scheduleType === "weekday"}
            onClick={() => { setScheduleType("weekday"); setStep("program"); }}
          />
          <OptionCard
            icon={<Calendar size={24} />}
            title="Weekend"
            description="Otomatis Sabtu & Ahad. Pilih jam di step berikutnya."
            selected={scheduleType === "weekend"}
            onClick={() => { setScheduleType("weekend"); setStep("program"); }}
          />
        </div>
      )}

      {step === "program" && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setStep("schedule")}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent)",
              fontSize: 13,
              cursor: "pointer",
              padding: 0,
              marginBottom: 14,
            }}
          >
            ← Ganti jadwal
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredPrograms.length === 0 ? (
              <div
                className="card-mpt"
                style={{ padding: "24px 22px", textAlign: "center" }}
              >
                <p style={{ fontSize: 14, color: "var(--ink-soft)" }}>
                  Belum ada kelas tersedia untuk pilihan ini. Coba jadwal lain.
                </p>
              </div>
            ) : (
              filteredPrograms.map((p) => (
                <div
                  key={p.id}
                  className="card-mpt"
                  style={{
                    padding: "18px 20px",
                    cursor: "pointer",
                    borderColor:
                      selectedProgram?.id === p.id
                        ? "var(--accent)"
                        : undefined,
                    borderWidth: selectedProgram?.id === p.id ? 2 : 1,
                  }}
                  onClick={() => {
                    setSelectedProgram(p);
                    setStep("confirm");
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                        {p.days}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-soft)" }}>
                        <Clock size={13} strokeWidth={2.2} />
                        {p.time}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4 }}>
                        Pengajar: {p.teacher}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>Tersisa</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>
                        {p.capacity - p.enrolled}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {step === "confirm" && selectedProgram && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setStep("program")}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent)",
              fontSize: 13,
              cursor: "pointer",
              padding: 0,
              marginBottom: 14,
            }}
          >
            ← Pilih kelas lain
          </button>
          <div className="card-mpt" style={{ padding: "24px 22px" }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 16px" }}>
              Konfirmasi Pendaftaran
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <InfoRow label="Program" value={selectedProgram.name} />
              <InfoRow label="Level" value={selectedProgram.level === "dasar" ? "Kelas Dasar" : "Kelas Lanjutan"} />
              <InfoRow label="Jadwal" value={`${selectedProgram.days}, ${selectedProgram.time}`} />
              <InfoRow label="Pengajar" value={selectedProgram.teacher} />
              <InfoRow label="Kuota tersisa" value={`${selectedProgram.capacity - selectedProgram.enrolled} dari ${selectedProgram.capacity}`} />
            </div>
            <button
              className="btn-mpt btn-mpt-accent"
              style={{
                minHeight: 48,
                fontSize: 15,
                fontWeight: 700,
                width: "100%",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => setEnrolled(true)}
            >
              Daftar HITS
              <ArrowRight size={16} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "level", label: "Level" },
    { key: "schedule", label: "Jadwal" },
    { key: "program", label: "Kelas" },
    { key: "confirm", label: "Konfirmasi" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === current);
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
      {steps.map((s, i) => (
        <div key={s.key} style={{ flex: 1, textAlign: "center" }}>
          <div
            style={{
              height: 4,
              borderRadius: 2,
              background:
                i <= currentIdx
                  ? "var(--accent)"
                  : "var(--line)",
              marginBottom: 4,
            }}
          />
          <div
            style={{
              fontSize: 10,
              fontWeight: i <= currentIdx ? 700 : 400,
              color: i <= currentIdx ? "var(--accent)" : "var(--ink-mute)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function OptionCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className="card-mpt"
      style={{
        padding: "22px 20px",
        cursor: "pointer",
        borderColor: selected ? "var(--accent)" : undefined,
        borderWidth: selected ? 2 : 1,
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
      }}
      onClick={onClick}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "color-mix(in oklab, var(--accent), transparent 88%)",
          color: "var(--accent)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>
          {description}
        </div>
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
