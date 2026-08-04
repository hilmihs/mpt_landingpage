import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, Clock3, CheckCircle2, ArrowRight } from "lucide-react";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { sql } from "@/lib/db";

/**
 * Daftar penugasan penilaian milik pengajar yang sedang login.
 *
 * Sebelum halaman ini ada, satu-satunya jalan ke formulir penilaian adalah
 * tautan di pesan WhatsApp. Kalau pesan itu tertimbun atau terhapus, rekaman
 * peserta menggantung tanpa ada yang tahu — tidak ada permukaan lain yang
 * menampilkannya. Halaman ini menutup celah itu.
 */

export const dynamic = "force-dynamic";

/** Di atas ambang ini peserta sudah menunggu terlalu lama dan barisnya disorot. */
const STALE_DAYS = 3;
const STALE_SEC = STALE_DAYS * 24 * 60 * 60;

interface PendingRow {
  assignment_id: string;
  waited_sec: number;
  nama: string;
  jenis_kelamin: string;
  audio_duration_sec: number | null;
}

interface DoneRow {
  assignment_id: string;
  nama: string;
  jenis_kelamin: string;
  selesai_at: Date | null;
  score_min: number | null;
  label_min: string | null;
}

export default async function TugasPage() {
  // Layout sudah menolak sesi tak sah, tapi teacherId hanya bisa didapat dari
  // sini — dan tanpa itu query di bawah tidak punya batas kepemilikan.
  const teacher = await getCurrentTeacher();
  if (!teacher) notFound();

  // teacher_id NULL berarti penugasan jatuh ke superadmin: ikut ditampilkan
  // supaya rekaman tidak terkunci saat daftar pengajar belum lengkap.
  // Evaluasi diambil lewat LATERAL karena satu submission bisa dinilai
  // berulang kali — JOIN biasa akan menggandakan barisnya.
  // Lama menunggu dihitung di database, bukan dari jam proses Node: assigned_at
  // ditulis dengan jam Postgres, jadi membandingkannya dengan jam aplikasi bisa
  // menghasilkan "menunggu -2 menit" begitu kedua mesin sedikit berbeda.
  const pending = await sql<PendingRow[]>`
    SELECT
      a.id AS assignment_id,
      EXTRACT(EPOCH FROM (now() - a.assigned_at))::float8 AS waited_sec,
      s.nama,
      s.jenis_kelamin,
      s.audio_duration_sec::float8 AS audio_duration_sec
    FROM assignments a
    JOIN submissions s ON s.id = a.submission_id
    WHERE (a.teacher_id = ${teacher.teacherId} OR a.teacher_id IS NULL)
      AND a.status NOT IN ('completed', 'failed')
    ORDER BY a.assigned_at ASC
  `;

  const done = await sql<DoneRow[]>`
    SELECT
      a.id AS assignment_id,
      s.nama,
      s.jenis_kelamin,
      COALESCE(e.created_at, a.completed_at) AS selesai_at,
      e.score_min,
      e.label_min
    FROM assignments a
    JOIN submissions s ON s.id = a.submission_id
    LEFT JOIN LATERAL (
      SELECT te.score_min, te.label_min, te.created_at
      FROM teacher_evaluations te
      WHERE te.submission_id = s.id
      ORDER BY te.created_at DESC
      LIMIT 1
    ) e ON TRUE
    WHERE (a.teacher_id = ${teacher.teacherId} OR a.teacher_id IS NULL)
      AND a.status = 'completed'
    ORDER BY COALESCE(e.created_at, a.completed_at) DESC NULLS LAST
    LIMIT 20
  `;

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "color-mix(in oklab, var(--accent), transparent 85%)",
            color: "var(--accent)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <ClipboardCheck size={22} strokeWidth={2.2} />
        </div>
        <div>
          <h1
            className="font-display"
            style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.025em" }}
          >
            Tugas Penilaian
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "2px 0 0" }}>
            Rekaman peserta yang menunggu Anda nilai, beserta riwayat yang sudah selesai.
          </p>
        </div>
      </div>

      {/* Menunggu dinilai — terlama di atas, karena peserta itulah yang paling lama menanti */}
      <section style={{ marginBottom: 36 }}>
        <SectionHead
          icon={<Clock3 size={16} strokeWidth={2.2} color="var(--warning)" />}
          title="Menunggu Dinilai"
          count={pending.length}
          color="var(--warning)"
        />

        {pending.length === 0 ? (
          <EmptyState
            title="Tidak ada tugas yang menunggu"
            body="Semua rekaman yang ditugaskan kepada Anda sudah dinilai. Barakallahu fiik — nanti akan muncul di sini begitu ada rekaman baru."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pending.map((r) => {
              const waited = r.waited_sec;
              const stale = waited >= STALE_SEC;
              return (
                <div
                  key={r.assignment_id}
                  className="card-mpt"
                  style={{
                    padding: "16px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 14,
                    borderColor: stale ? "var(--danger)" : undefined,
                    background: stale
                      ? "color-mix(in oklab, var(--danger), transparent 94%)"
                      : undefined,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{r.nama}</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ink-mute)",
                        marginTop: 3,
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      <span>{genderLabel(r.jenis_kelamin)}</span>
                      <Dot />
                      <span>{durationLabel(r.audio_duration_sec)}</span>
                      <Dot />
                      <span style={stale ? { color: "var(--danger)", fontWeight: 700 } : undefined}>
                        menunggu {sinceLabel(waited)}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/portal-mpt-x7/nilai/${r.assignment_id}`}
                    className="btn-mpt btn-mpt-accent"
                    style={{
                      minHeight: 40,
                      padding: "0 16px",
                      fontSize: 13,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      textDecoration: "none",
                    }}
                  >
                    Nilai
                    <ArrowRight size={15} strokeWidth={2.4} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Selesai */}
      <section>
        <SectionHead
          icon={<CheckCircle2 size={16} strokeWidth={2.2} color="var(--success)" />}
          title="Selesai"
          count={done.length}
          color="var(--success)"
        />

        {done.length === 0 ? (
          <EmptyState
            title="Belum ada penilaian yang selesai"
            body="Penilaian yang sudah Anda kirimkan akan tercatat di sini."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {done.map((r) => (
              <div
                key={r.assignment_id}
                className="card-mpt"
                style={{
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  opacity: 0.85,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{r.nama}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>
                    {genderLabel(r.jenis_kelamin)} · {dateLabel(r.selesai_at)}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {r.label_min && (
                    <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{r.label_min}</span>
                  )}
                  <span
                    className="pill"
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      background:
                        r.score_min != null
                          ? `color-mix(in oklab, ${bandColor(r.score_min)}, transparent 86%)`
                          : "color-mix(in oklab, var(--ink-mute), transparent 90%)",
                      color: r.score_min != null ? bandColor(r.score_min) : "var(--ink-mute)",
                    }}
                  >
                    {r.score_min != null ? `${r.score_min}/10` : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHead({
  icon,
  title,
  count,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  color: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      {icon}
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>
      <span
        className="pill"
        style={{
          fontSize: 11,
          background: `color-mix(in oklab, ${color}, transparent 82%)`,
          color,
        }}
      >
        {count}
      </span>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card-mpt" style={{ padding: "30px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <p
        style={{
          fontSize: 13,
          color: "var(--ink-soft)",
          lineHeight: 1.65,
          margin: "0 auto",
          maxWidth: 420,
        }}
      >
        {body}
      </p>
    </div>
  );
}

function Dot() {
  return <span style={{ color: "var(--line-strong)" }}>·</span>;
}

function genderLabel(g: string): string {
  return g === "ikhwan" ? "Ikhwan" : "Akhwat";
}

function durationLabel(sec: number | null): string {
  if (sec == null) return "durasi —";
  return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}d`;
}

/** Jarak waktu kasar; angka presisi tidak menolong pengajar mengambil keputusan. */
function sinceLabel(detik: number): string {
  const menit = Math.floor(detik / 60);
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam`;
  return `${Math.floor(jam / 24)} hari`;
}

function dateLabel(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

/** Ambang warna mengikuti band 1-10 yang dipakai di rapot peserta. */
function bandColor(score: number): string {
  if (score <= 2) return "var(--danger)";
  if (score <= 6) return "var(--warning)";
  if (score <= 8) return "var(--accent)";
  return "var(--success)";
}
