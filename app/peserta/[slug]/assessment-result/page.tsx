import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Bot,
  ArrowRight,
  SkipForward,
  AlertTriangle,
} from "lucide-react";
import { sql } from "@/lib/db";
import { fetchTeacherAssessment } from "@/lib/teacher-assessment";
import { AssessmentScaleNote } from "@/components/rapot/AssessmentScaleNote";
import { TeacherReport } from "@/components/rapot/TeacherReport";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: "Hasil Assessment — Muhajir Project Tilawah",
  robots: { index: false, follow: false },
};

async function fetchPesertaWithRapot(slug: string) {
  const submissionRows = await sql<
    {
      id: string;
      nama: string;
      jenis_kelamin: string;
      nomor_wa: string;
      rapot_slug: string | null;
    }[]
  >`
    SELECT id, nama, jenis_kelamin, nomor_wa, rapot_slug
      FROM submissions
     WHERE rapot_slug = ${slug}
     LIMIT 1
  `;
  const submission = submissionRows[0];
  if (!submission) return null;

  const rapotRows = await sql<{ skor: number; status_label: string }[]>`
    SELECT skor, status_label
      FROM rapot
     WHERE slug = ${slug}
     LIMIT 1
  `;
  const rapot = rapotRows[0] ?? null;

  return { submission, rapot };
}

export default async function AssessmentResultPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const devMode = sp.dev === "1";

  const data = await fetchPesertaWithRapot(slug);
  if (!data) notFound();

  const { rapot } = data;
  const teacher = await fetchTeacherAssessment(slug);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 48px" }}>
      <Link
        href={`/peserta/${slug}`}
        className="btn-mpt btn-mpt-outline"
        style={{
          minHeight: 36,
          fontSize: 12,
          padding: "8px 14px",
          marginBottom: 18,
          display: "inline-flex",
        }}
      >
        <ChevronLeft size={14} strokeWidth={2.4} />
        Kembali ke Dashboard
      </Link>

      <h1
        className="font-display"
        style={{
          fontSize: "clamp(22px, 4vw, 26px)",
          margin: "0 0 16px",
          fontWeight: 800,
          letterSpacing: "-0.03em",
        }}
      >
        Hasil Assessment
      </h1>

      <AssessmentScaleNote />

      {/* ── Penilaian Pengajar (skala 1–10) ── */}
      {teacher ? (
        <div style={{ marginBottom: 16 }}>
          <TeacherReport data={teacher} />
        </div>
      ) : (
        <div
          className="card-mpt"
          style={{ padding: "20px 18px", marginBottom: 16, textAlign: "center" }}
        >
          <AlertTriangle
            size={22}
            color="var(--warning)"
            style={{ marginBottom: 8 }}
          />
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            Penilaian Pengajar belum tersedia
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
            Hasil dari pengajar akan muncul di sini setelah sesi assessment selesai
            dinilai.
          </p>
        </div>
      )}

      {/* ── Penilaian AI (skala 1–5) — laporan terpisah, ringkas ── */}
      {rapot && (
        <div className="card-mpt" style={{ padding: "20px 18px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 11,
                background: "var(--accent)",
                color: "white",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Bot size={22} strokeWidth={2} />
            </div>
            <div>
              <h2
                className="font-display"
                style={{
                  fontSize: "clamp(18px, 3.4vw, 22px)",
                  margin: 0,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                }}
              >
                Penilaian AI
              </h2>
              <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: 0 }}>
                Deteksi kesalahan fatal (lahn jaliy)
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 8,
              background: "var(--surface)",
              border: "1px solid var(--line)",
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{rapot.status_label}</div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>Skala 1–5</div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 800,
                  color: "var(--accent)",
                  lineHeight: 1,
                }}
              >
                {rapot.skor}
              </span>
              <span style={{ fontSize: 14, color: "var(--ink-mute)", fontWeight: 600 }}>
                /5
              </span>
            </div>
          </div>

          <Link
            href={`/rapot/${slug}`}
            className="btn-mpt btn-mpt-outline"
            style={{ minHeight: 42, fontSize: 13, fontWeight: 700, width: "100%" }}
          >
            Lihat Rapot AI Lengkap
            <ArrowRight size={15} strokeWidth={2.4} />
          </Link>
        </div>
      )}

      {/* ── Langkah selanjutnya ── */}
      <div className="card-mpt" style={{ padding: "20px 18px", marginBottom: 16 }}>
        <h2
          className="font-display"
          style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}
        >
          Langkah Selanjutnya
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 14px", lineHeight: 1.6 }}>
          Berdasarkan hasil assessment, kami menyarankan Anda mengikuti{" "}
          <strong>Tahsin Al-Fatihah</strong> — program pendampingan 4 pertemuan
          bersama pengajar berpengalaman.
        </p>
        <Link
          href={`/tahsin/${slug}`}
          className="btn-mpt btn-mpt-accent"
          style={{ minHeight: 44, fontSize: 14, fontWeight: 700, width: "100%" }}
        >
          Daftar Tahsin Al-Fatihah
          <ArrowRight size={16} strokeWidth={2.4} />
        </Link>
      </div>

      {devMode && (
        <div
          style={{
            marginTop: 14,
            padding: "14px 18px",
            borderRadius: 12,
            border: "1px dashed var(--ink-mute)",
            background: "color-mix(in oklab, var(--warning), transparent 92%)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 6 }}>
            Dev Mode
          </div>
          <Link
            href={`/peserta/${slug}/tahsin`}
            className="btn-mpt btn-mpt-outline"
            style={{ minHeight: 36, fontSize: 12, color: "var(--ink-soft)" }}
          >
            <SkipForward size={14} strokeWidth={2.2} />
            Skip ke Tahsin Progress (sudah terdaftar)
          </Link>
        </div>
      )}
    </div>
  );
}
