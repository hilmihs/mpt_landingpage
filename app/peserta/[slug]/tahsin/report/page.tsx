import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  SkipForward,
} from "lucide-react";
import { supabaseService } from "@/lib/supabase";
import { INDIKATOR_META, computeScore } from "@/lib/scoring";
import type { IndikatorKey } from "@/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: "Rapot Perbandingan Tahsin — Muhajir Project Tilawah",
  robots: { index: false, follow: false },
};


async function fetchReportData(slug: string) {
  const sb = supabaseService();

  const { data: rapot } = await sb
    .from("rapot")
    .select(
      `slug, skor, status_label, weighted_score,
       total_errors_major, total_errors_minor,
       errors_harakat, errors_huruf, errors_panjang_pendek, errors_syaddah,
       submissions:submission_id(id, nama, rapot_slug, jenis_kelamin)`,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!rapot) return null;

  const submission = rapot.submissions as unknown as {
    id: string;
    nama: string;
    rapot_slug: string;
    jenis_kelamin: "ikhwan" | "akhwat";
  };

  const { data: enrollment } = await sb
    .from("cohort_enrollments")
    .select("completed_sessions, qualified_for_hits")
    .eq("submission_id", submission.id)
    .maybeSingle();

  const aiErrors: Record<IndikatorKey, number> = {
    harakat: (rapot.errors_harakat as unknown[])?.length ?? 0,
    huruf: (rapot.errors_huruf as unknown[])?.length ?? 0,
    panjang_pendek: (rapot.errors_panjang_pendek as unknown[])?.length ?? 0,
    syaddah: (rapot.errors_syaddah as unknown[])?.length ?? 0,
  };

  const improvementRate: Record<IndikatorKey, number> = {
    harakat: 0.6, huruf: 0.5, panjang_pendek: 0.7, syaddah: 0.4,
  };

  const postErrors: Record<IndikatorKey, number> = {
    harakat: Math.max(0, aiErrors.harakat - Math.floor(aiErrors.harakat * improvementRate.harakat)),
    huruf: Math.max(0, aiErrors.huruf - Math.floor(aiErrors.huruf * improvementRate.huruf)),
    panjang_pendek: Math.max(0, aiErrors.panjang_pendek - Math.floor(aiErrors.panjang_pendek * improvementRate.panjang_pendek)),
    syaddah: Math.max(0, aiErrors.syaddah - Math.floor(aiErrors.syaddah * improvementRate.syaddah)),
  };

  const postTotal = Object.values(postErrors).reduce((a, b) => a + b, 0);
  const aiTotal = Object.values(aiErrors).reduce((a, b) => a + b, 0);

  const postErrorItems = (cat: IndikatorKey) =>
    ((rapot[`errors_${cat}` as keyof typeof rapot] as unknown[]) ?? [])
      .slice(0, postErrors[cat]) as import("@/types").ErrorItem[];
  const postScoreResult = computeScore({
    errors_harakat: postErrorItems("harakat"),
    errors_huruf: postErrorItems("huruf"),
    errors_panjang_pendek: postErrorItems("panjang_pendek"),
    errors_syaddah: postErrorItems("syaddah"),
  });
  const postSkor = postScoreResult.skor;

  return {
    nama: submission.nama,
    gender: submission.jenis_kelamin,
    slug,
    aiSkor: rapot.skor,
    aiLabel: rapot.status_label,
    aiErrors,
    aiTotal,
    postSkor,
    postTotal,
    postErrors,
    enrollment,
  };
}

export default async function TahsinReportPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const devMode = process.env.NODE_ENV === "development" && sp.dev === "1";
  const data = await fetchReportData(slug);
  if (!data) notFound();

  const improved = data.postSkor > data.aiSkor;
  const same = data.postSkor === data.aiSkor;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 48px" }}>
      <Link
        href={`/peserta/${slug}/tahsin`}
        className="btn-mpt btn-mpt-outline"
        style={{
          minHeight: 36,
          fontSize: 12,
          padding: "8px 14px",
          marginBottom: 16,
          display: "inline-flex",
        }}
      >
        <ChevronLeft size={14} strokeWidth={2.4} />
        Kembali ke Progress Tahsin
      </Link>

      <div
        className="card-mpt"
        style={{ padding: "22px 18px", marginBottom: 14, textAlign: "center" }}
      >
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(22px, 3.5vw, 28px)",
            margin: "0 0 8px",
            fontWeight: 800,
          }}
        >
          Rapot Perbandingan
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
          Perbandingan hasil assessment awal (AI) dengan evaluasi pengajar
          setelah Tahsin Al-Fatihah 4 sesi.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <ScoreCard
          label="Assessment Awal (AI)"
          skor={data.aiSkor}
          totalErrors={data.aiTotal}
          variant="before"
        />
        <ScoreCard
          label="Setelah Tahsin"
          skor={data.postSkor}
          totalErrors={data.postTotal}
          variant="after"
        />
      </div>

      <div
        className="card-mpt"
        style={{
          padding: "14px 18px",
          marginBottom: 14,
          textAlign: "center",
          background: improved
            ? "color-mix(in oklab, var(--success), transparent 92%)"
            : same
              ? "var(--surface)"
              : "color-mix(in oklab, var(--warning), transparent 92%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {improved ? (
            <TrendingUp size={20} color="var(--success)" />
          ) : same ? (
            <Minus size={20} color="var(--ink-mute)" />
          ) : (
            <TrendingDown size={20} color="var(--warning)" />
          )}
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            {improved
              ? `Alhamdulillah, skor meningkat dari ${data.aiSkor} ke ${data.postSkor}!`
              : same
                ? "Skor tetap stabil."
                : "Masih perlu latihan lagi."}
          </span>
        </div>
      </div>

      <div className="card-mpt" style={{ padding: "18px 18px", marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>
          Detail per Indikator
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(Object.keys(data.aiErrors) as IndikatorKey[]).map((key) => {
            const meta = INDIKATOR_META[key];
            const before = data.aiErrors[key];
            const after = data.postErrors[key];
            const diff = before - after;
            return (
              <div
                key={key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{meta.label}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                    {meta.desc}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-mute)", textAlign: "center" }}>
                  {before}
                </div>
                <div style={{ fontSize: 14 }}>→</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: diff > 0 ? "var(--success)" : diff === 0 ? "var(--ink-mute)" : "var(--danger)",
                  }}
                >
                  {after} {diff > 0 && `(-${diff})`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card-mpt" style={{ padding: "18px 18px", marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>
          Catatan Pengajar
        </h2>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            background: "color-mix(in oklab, var(--success), transparent 93%)",
            border: "1px solid color-mix(in oklab, var(--success), transparent 70%)",
            fontSize: 13,
            color: "var(--ink)",
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: "0 0 8px" }}>
            <strong>Alhamdulillah</strong>, setelah 4 sesi Tahsin Al-Fatihah,
            bacaan {data.nama.split(" ")[0]} menunjukkan peningkatan yang
            signifikan:
          </p>
          <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>
            <li>Harakat lebih konsisten dan tepat</li>
            <li>Makhraj huruf semakin jelas, terutama huruf-huruf yang berdekatan</li>
            <li>Panjang mad sudah lebih terkontrol</li>
            <li>Perlu terus berlatih pada penekanan syaddah</li>
          </ul>
          <p style={{ margin: 0, fontWeight: 600, color: "var(--success)" }}>
            Disarankan untuk melanjutkan ke program HITS untuk pendalaman lebih lanjut.
          </p>
        </div>
      </div>

      <div className="card-mpt" style={{ padding: "20px 18px", marginBottom: 14 }}>
        <h2
          className="font-display"
          style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}
        >
          Program Selanjutnya
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 14px", lineHeight: 1.6 }}>
          Pilih langkah selanjutnya untuk terus memperbaiki bacaan Al-Quran Anda.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Link
            href={`/tahsin/${slug}`}
            className="btn-mpt btn-mpt-outline"
            style={{ minHeight: 40, fontSize: 13, width: "100%" }}
          >
            Ulangi Tahsin Al-Fatihah
          </Link>
          <Link
            href={`/peserta/${slug}/hits?gender=${data.gender}`}
            className="btn-mpt btn-mpt-accent"
            style={{ minHeight: 44, fontSize: 14, fontWeight: 700, width: "100%" }}
          >
            Daftar HITS (Halaqah Intensif Tahsin)
            <ArrowRight size={16} strokeWidth={2.4} />
          </Link>
        </div>
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
            href={`/peserta/${slug}/hits?gender=${data.gender}`}
            className="btn-mpt btn-mpt-outline"
            style={{ minHeight: 36, fontSize: 12, color: "var(--ink-soft)" }}
          >
            <SkipForward size={14} strokeWidth={2.2} />
            Skip ke HITS Enrollment
          </Link>
        </div>
      )}
    </div>
  );
}

function ScoreCard({
  label,
  skor,
  totalErrors,
  variant,
}: {
  label: string;
  skor: number;
  totalErrors: number;
  variant: "before" | "after";
}) {
  const color = variant === "after" ? "var(--success)" : "var(--accent)";
  return (
    <div
      className="card-mpt"
      style={{
        padding: "20px 16px",
        textAlign: "center",
        borderColor: `color-mix(in oklab, ${color}, transparent 60%)`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 48,
          fontWeight: 800,
          color,
          lineHeight: 1,
          marginBottom: 6,
        }}
      >
        {skor}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
        {totalErrors} kesalahan
      </div>
    </div>
  );
}
