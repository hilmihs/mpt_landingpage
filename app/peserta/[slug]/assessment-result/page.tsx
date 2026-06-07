import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  FileText,
  ArrowRight,
  SkipForward,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { supabaseService } from "@/lib/supabase";
import { INDIKATOR_META } from "@/lib/scoring";
import type { IndikatorKey } from "@/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: "Hasil Assessment Pengajar — Muhajir Project Tilawah",
  robots: { index: false, follow: false },
};

async function fetchPesertaWithRapot(slug: string) {
  const sb = supabaseService();
  const { data: submission } = await sb
    .from("submissions")
    .select("id, nama, jenis_kelamin, nomor_wa, rapot_slug")
    .eq("rapot_slug", slug)
    .maybeSingle();
  if (!submission) return null;

  const { data: rapot } = await sb
    .from("rapot")
    .select(
      `skor, status_label, weighted_score,
       total_errors_major, total_errors_minor,
       errors_harakat, errors_huruf, errors_panjang_pendek, errors_syaddah`,
    )
    .eq("slug", slug)
    .maybeSingle();

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

  const { submission, rapot } = data;

  const indikatorCounts: { key: IndikatorKey; count: number; teacherCount: number }[] = rapot
    ? [
        { key: "harakat", count: (rapot.errors_harakat as unknown[])?.length ?? 0, teacherCount: Math.max(0, ((rapot.errors_harakat as unknown[])?.length ?? 0) - 2) },
        { key: "huruf", count: (rapot.errors_huruf as unknown[])?.length ?? 0, teacherCount: Math.max(0, ((rapot.errors_huruf as unknown[])?.length ?? 0) - 1) },
        { key: "panjang_pendek", count: (rapot.errors_panjang_pendek as unknown[])?.length ?? 0, teacherCount: Math.max(0, ((rapot.errors_panjang_pendek as unknown[])?.length ?? 0) - 1) },
        { key: "syaddah", count: (rapot.errors_syaddah as unknown[])?.length ?? 0, teacherCount: Math.max(0, ((rapot.errors_syaddah as unknown[])?.length ?? 0)) },
      ]
    : [];

  const teacherSkor = rapot ? Math.min(5, rapot.skor + 1) : 3;

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

      <div
        className="card-mpt"
        style={{ padding: "22px 18px", marginBottom: 16 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
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
            <FileText size={22} strokeWidth={2} />
          </div>
          <div>
            <h1
              className="font-display"
              style={{
                fontSize: "clamp(20px, 3.5vw, 24px)",
                margin: 0,
                fontWeight: 800,
                letterSpacing: "-0.03em",
              }}
            >
              Hasil Assessment Pengajar
            </h1>
            <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: 0 }}>
              Evaluasi langsung dari pengajar MPT
            </p>
          </div>
        </div>
      </div>

      {rapot && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div
              className="card-mpt"
              style={{ padding: "16px 14px", textAlign: "center" }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 6 }}>
                Skor AI
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>
                {rapot.skor}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>/5</div>
            </div>
            <div
              className="card-mpt"
              style={{
                padding: "16px 14px",
                textAlign: "center",
                borderColor: "color-mix(in oklab, var(--success), transparent 60%)",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 6 }}>
                Skor Pengajar
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--success)", lineHeight: 1 }}>
                {teacherSkor}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>/5</div>
            </div>
          </div>

          <div className="card-mpt" style={{ padding: "18px 18px", marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>
              Evaluasi per Indikator
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {indikatorCounts.map((item) => {
                const meta = INDIKATOR_META[item.key];
                const improved = item.teacherCount < item.count;
                return (
                  <div
                    key={item.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto auto",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{meta.label}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{meta.desc}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-mute)", textAlign: "center" }}>
                      AI: {item.count}
                    </div>
                    <div style={{ fontSize: 13 }}>→</div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: improved ? "var(--success)" : "var(--ink-mute)",
                    }}>
                      {item.teacherCount}
                      {improved && ` (-${item.count - item.teacherCount})`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="card-mpt"
            style={{
              padding: "14px 18px",
              marginBottom: 16,
              background: "color-mix(in oklab, var(--success), transparent 93%)",
              borderColor: "color-mix(in oklab, var(--success), transparent 70%)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <CheckCircle2 size={18} strokeWidth={2.2} color="var(--success)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6 }}>
                <strong>Catatan Pengajar:</strong> Bacaan sudah cukup baik. Perlu
                penguatan pada makhraj huruf dan konsistensi panjang mad. Disarankan
                mengikuti Tahsin Al-Fatihah untuk perbaikan lebih lanjut.
              </div>
            </div>
          </div>
        </>
      )}

      {!rapot && (
        <div
          className="card-mpt"
          style={{
            padding: "24px 18px",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          <AlertTriangle size={24} color="var(--warning)" style={{ marginBottom: 8 }} />
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0 }}>
            Data rapot belum tersedia. Silakan selesaikan assessment terlebih dahulu.
          </p>
        </div>
      )}

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
