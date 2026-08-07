import { notFound } from "next/navigation";
import { Clock, User, Volume2 } from "lucide-react";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { sql } from "@/lib/db";
import { signedAudioUrl } from "@/lib/storage";
import { EvaluationForm } from "@/components/portal/EvaluationForm";
import { ambilUsulan } from "@/lib/ai-eval/usulan";

export const dynamic = "force-dynamic";

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

  // Penugasan yang sudah dialihkan admin ke pengajar lain berhenti di sini.
  //
  // Tautan di WhatsApp tidak bisa ditarik kembali, jadi pengajar lama masih
  // memegangnya. Tanpa penjagaan ini dia tetap bisa mengisi formulir, dan
  // karena teacher_evaluations unik per submission lalu di-upsert, kiriman itu
  // akan MENIMPA penilaian pengajar baru tanpa jejak. Rekamannya tidak
  // ditampilkan sama sekali — sekali dialihkan, bukan lagi amanah dia.
  if (row.status === "failed") {
    return (
      <div style={{ maxWidth: 560 }}>
        <div className="card-mpt" style={{ padding: "28px 24px" }}>
          <h1
            className="font-display"
            style={{ fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}
          >
            Penugasan sudah dialihkan
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.65, margin: 0 }}>
            Rekaman ini sekarang dinilai pengajar lain, jadi tidak perlu Anda
            kerjakan. Tugas Anda yang masih menunggu ada di halaman{" "}
            <strong>Tugas Penilaian</strong>. Barakallahu fiik.
          </p>
        </div>
      </div>
    );
  }

  const audioUrl = await signedAudioUrl(row.audio_path, 3600);
  const sudahDinilai = row.kode_unik != null || row.score_min != null;

  // Usulan mesin, kalau rekaman ini kebagian. Kegagalan di sini tidak boleh
  // menghalangi penilaian — mesin ini pembantu, bukan prasyarat.
  const usulan = sudahDinilai
    ? null
    : await ambilUsulan(row.submission_id).catch((err) => {
        console.error("[portal.nilai] usulan gagal:", (err as Error).message);
        return null;
      });

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
        Putar rekamannya, lalu centang kesalahan yang Anda dengar pada tiap
        segmen. Pemutar tetap menempel di atas layar selama Anda menggulir.
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

      {/* Pemutar rekaman menempel di atas layar: pengajar mencentang 110
          pilihan sambil mengulang-ulang bagian yang meragukan, jadi tombol
          putarnya harus selalu terjangkau tanpa menggulir balik. */}
      <div
        className="card-mpt"
        style={{
          padding: 20,
          marginBottom: 18,
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
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

      <EvaluationForm
        assignmentId={row.assignment_id}
        usulan={usulan}
        existing={
          sudahDinilai
            ? {
                skor: row.score_min,
                label: row.label_min,
                kodeUnik: row.kode_unik,
              }
            : null
        }
      />
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
