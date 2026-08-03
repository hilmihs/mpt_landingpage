import { notFound } from "next/navigation";
import { ExternalLink, Clock, User, Volume2 } from "lucide-react";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { sql } from "@/lib/db";
import { signedAudioUrl } from "@/lib/storage";
import { KodeUnikForm } from "@/components/portal/KodeUnikForm";

export const dynamic = "force-dynamic";

const FILAMENT_CREATE_URL =
  process.env.MPT_EVAL_FORM_URL ??
  "https://assesment-alfatihah.muhajirproject.com/recitation-evaluations/create";

interface Row {
  assignment_id: string;
  status: string;
  assigned_at: Date;
  submission_id: string;
  nama: string;
  jenis_kelamin: string;
  audio_path: string;
  audio_duration_sec: number | null;
  teacher_id: string | null;
  kode_unik: string | null;
  score_min: number | null;
  label_min: string | null;
}

export default async function NilaiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teacher = await getCurrentTeacher();
  if (!teacher) notFound();

  const rows = await sql<Row[]>`
    SELECT
      a.id AS assignment_id, a.status, a.assigned_at, a.teacher_id,
      s.id AS submission_id, s.nama, s.jenis_kelamin,
      s.audio_path, s.audio_duration_sec,
      e.kode_unik, e.score_min, e.label_min
    FROM assignments a
    JOIN submissions s ON s.id = a.submission_id
    LEFT JOIN teacher_evaluations e ON e.submission_id = s.id
    WHERE a.id = ${id}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) notFound();

  // Penugasan milik pengajar lain tidak boleh dibuka. Tidak ada RLS yang
  // menahan ini, jadi pengecekannya harus di sini.
  // teacher_id null berarti jatuh ke superadmin — biarkan lewat supaya
  // rekaman tidak terkunci saat daftar pengajar belum diisi.
  if (row.teacher_id && row.teacher_id !== teacher.teacherId) notFound();

  const audioUrl = await signedAudioUrl(row.audio_path, 3600);
  const done = Boolean(row.kode_unik);

  const durasi =
    row.audio_duration_sec != null
      ? `${Math.floor(row.audio_duration_sec / 60)}m ${Math.round(row.audio_duration_sec % 60)}d`
      : "—";

  return (
    <div style={{ maxWidth: 760 }}>
      <h1
        className="font-display"
        style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.025em" }}
      >
        Penilaian Al-Fatihah
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 24px" }}>
        Dengarkan rekaman di bawah, lalu isi formulir penilaian. Terakhir,
        tempelkan kode unik yang Anda terima agar hasilnya masuk ke sistem.
      </p>

      {/* Identitas peserta */}
      <div className="card-mpt" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
          <Fact icon={<User size={15} strokeWidth={2.2} />} label="Peserta" value={row.nama} />
          <Fact
            icon={<Volume2 size={15} strokeWidth={2.2} />}
            label="Gender"
            value={row.jenis_kelamin === "ikhwan" ? "Ikhwan" : "Akhwat"}
          />
          <Fact icon={<Clock size={15} strokeWidth={2.2} />} label="Durasi" value={durasi} />
        </div>
      </div>

      {/* Pemutar rekaman — sengaja di paling atas */}
      <div className="card-mpt" style={{ padding: 20, marginBottom: 18 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
            marginBottom: 12,
          }}
        >
          Rekaman Peserta
        </div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls preload="metadata" src={audioUrl} style={{ width: "100%" }} />
      </div>

      {/* Formulir penilaian di sistem sebelah */}
      <div className="card-mpt" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
          Langkah 1 — Isi formulir penilaian
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 14px", lineHeight: 1.6 }}>
          Formulir terbuka di tab baru. Setelah submit, Anda akan menerima{" "}
          <strong>kode unik</strong> — salin kode itu, lalu kembali ke halaman ini.
        </p>
        <a
          href={FILAMENT_CREATE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-mpt btn-mpt-accent"
          style={{ minHeight: 46, fontSize: 14, fontWeight: 700, display: "inline-flex", gap: 8 }}
        >
          Buka Formulir Penilaian
          <ExternalLink size={15} strokeWidth={2.4} />
        </a>
      </div>

      {/* Kode unik */}
      <div className="card-mpt" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
          Langkah 2 — Tempelkan kode unik
        </div>
        {done ? (
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
            Sudah selesai. Kode <strong>{row.kode_unik}</strong>
            {row.score_min != null && (
              <>
                {" "}
                — skor {row.score_min}
                {row.label_min ? ` (${row.label_min})` : ""}
              </>
            )}
            . Rapotnya sudah dikirim ke peserta lewat WhatsApp.
          </p>
        ) : (
          <KodeUnikForm assignmentId={row.assignment_id} />
        )}
      </div>
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 4,
        }}
      >
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
