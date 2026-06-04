import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  FileText,
  ArrowRight,
  SkipForward,
} from "lucide-react";
import { supabaseService } from "@/lib/supabase";
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

const DEMO_RAPOT_URL =
  "https://assessment-alfatihah-user.netlify.app/results/019e631d-7102-7105-8878-539a41083b8a";

async function fetchPeserta(slug: string) {
  const sb = supabaseService();
  const { data } = await sb
    .from("submissions")
    .select("id, nama, jenis_kelamin, nomor_wa, rapot_slug")
    .eq("rapot_slug", slug)
    .maybeSingle();
  return data;
}

export default async function AssessmentResultPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const devMode = sp.dev === "1";
  const peserta = await fetchPeserta(slug);
  if (!peserta) notFound();

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
      <Link
        href={`/rapot/${slug}`}
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
        Kembali ke Rapot AI
      </Link>

      <div
        className="card-mpt"
        style={{ padding: "28px 22px", marginBottom: 22, textAlign: "center" }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 14px",
            borderRadius: 14,
            background: "var(--accent)",
            color: "white",
            display: "grid",
            placeItems: "center",
          }}
        >
          <FileText size={28} strokeWidth={2} />
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(22px, 3.5vw, 28px)",
            margin: "0 0 8px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          Hasil Assessment dengan Pengajar
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Berikut rapot dari sesi assessment Anda bersama pengajar MPT.
          Rapot ini berisi evaluasi detail bacaan Al-Fatihah Anda.
        </p>
      </div>

      <div
        className="card-mpt"
        style={{
          padding: 0,
          marginBottom: 22,
          overflow: "hidden",
          borderRadius: 16,
        }}
      >
        <iframe
          src={DEMO_RAPOT_URL}
          title="Rapot Assessment Pengajar"
          style={{
            width: "100%",
            height: 700,
            border: "none",
            display: "block",
          }}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      <div
        style={{
          fontSize: 12,
          color: "var(--ink-mute)",
          textAlign: "center",
          marginBottom: 28,
          lineHeight: 1.5,
        }}
      >
        Rapot di atas disediakan oleh sistem Assessment Al-Fatihah MPT.
      </div>

      <div className="card-mpt" style={{ padding: "24px 22px", marginBottom: 22 }}>
        <h2
          className="font-display"
          style={{
            fontSize: 19,
            fontWeight: 700,
            margin: "0 0 10px",
            letterSpacing: "-0.02em",
          }}
        >
          Langkah Selanjutnya
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            margin: "0 0 18px",
            lineHeight: 1.6,
          }}
        >
          Berdasarkan hasil assessment, kami menyarankan Anda mengikuti{" "}
          <strong>Tahsin Al-Fatihah</strong> — program pendampingan 4 pertemuan
          (2x seminggu) bersama pengajar berpengalaman untuk memperbaiki bacaan
          Anda.
        </p>
        <Link
          href={`/tahsin/${slug}`}
          className="btn-mpt btn-mpt-accent"
          style={{
            minHeight: 48,
            fontSize: 15,
            fontWeight: 700,
            width: "100%",
          }}
        >
          Daftar Tahsin Al-Fatihah
          <ArrowRight size={16} strokeWidth={2.4} />
        </Link>
      </div>

      {devMode && (
        <div
          style={{
            marginTop: 20,
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link
              href={`/peserta/${slug}/tahsin?dev=1`}
              className="btn-mpt btn-mpt-outline"
              style={{ minHeight: 36, fontSize: 12, color: "var(--ink-soft)" }}
            >
              <SkipForward size={14} strokeWidth={2.2} />
              Skip ke Tahsin Progress (sudah terdaftar)
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
