import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabase";
import { ScoreCircle } from "@/components/assessment/ScoreCircle";
import { AyatCard } from "@/components/rapot/AyatCard";
import { IndikatorCard } from "@/components/rapot/IndikatorCard";
import { InterestGate } from "@/components/rapot/InterestGate";
import { AINarrative } from "@/components/rapot/AINarrative";
import { ShareButtons } from "@/components/rapot/ShareButtons";
import { MountainGlyph } from "@/components/shared/MPTLogo";
import { INDIKATOR_META } from "@/lib/scoring";
import { AL_FATIHAH } from "@/lib/arabic";
import type { RapotRow, IndikatorKey, ErrorItem } from "@/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

interface RapotWithSubmission extends RapotRow {
  submissions: {
    id: string;
    nama: string;
    jenis_kelamin: "ikhwan" | "akhwat";
    audio_duration_sec: number | null;
  } | null;
}

async function getRapot(slug: string): Promise<RapotWithSubmission | null> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("rapot")
    .select("*, submissions(id, nama, jenis_kelamin, audio_duration_sec)")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as RapotWithSubmission;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const rapot = await getRapot(slug);
  if (!rapot)
    return { title: "Rapot tidak ditemukan — Muhajir Project Tilawah" };
  return {
    title: `Rapot Bacaan: Skor ${rapot.skor}/5 — Muhajir Project Tilawah`,
    description: rapot.status_label,
    openGraph: {
      title: `Skor ${rapot.skor}/5 — ${rapot.status_label}`,
      description: "Rapot Assessment Al-Fatihah dari Muhajir Project Tilawah",
    },
  };
}

function fmt(sec: number | null | undefined): string {
  if (sec == null) return "—";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default async function RapotPage({ params }: Props) {
  const { slug } = await params;
  const rapot = await getRapot(slug);
  if (!rapot) notFound();

  const errorsByCategory: Record<IndikatorKey, ErrorItem[]> = {
    harakat: rapot.errors_harakat,
    huruf: rapot.errors_huruf,
    panjang_pendek: rapot.errors_panjang_pendek,
    syaddah: rapot.errors_syaddah,
  };

  const submission = rapot.submissions;
  const nama = submission?.nama ?? "Peserta";
  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const indikatorEntries: { kategori: IndikatorKey; errors: ErrorItem[] }[] = [
    { kategori: "harakat", errors: rapot.errors_harakat },
    { kategori: "huruf", errors: rapot.errors_huruf },
    { kategori: "panjang_pendek", errors: rapot.errors_panjang_pendek },
    { kategori: "syaddah", errors: rapot.errors_syaddah },
  ];

  return (
    <div
      className="screen-enter"
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: "32px 20px 80px",
      }}
    >
      {/* Hero card */}
      <div
        className="card-mpt"
        style={{
          padding: "32px 24px",
          marginBottom: 22,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 240,
            height: 240,
            background: "var(--accent)",
            opacity: 0.14,
            borderRadius: "50%",
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
          aria-hidden
        />

        <div
          className="pill"
          style={{
            background:
              "color-mix(in oklab, var(--primary), transparent 90%)",
            color: "var(--primary)",
            marginBottom: 18,
            position: "relative",
          }}
        >
          Rapot · {nama} · {today}
        </div>

        <div
          className="rapot-hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: 28,
            alignItems: "center",
            position: "relative",
          }}
        >
          <ScoreCircle score={rapot.skor} max={5} size={180} />
          <div>
            <h1
              className="font-display"
              style={{
                fontSize: "clamp(26px, 4vw, 40px)",
                margin: "0 0 10px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
              }}
            >
              {rapot.status_label}
            </h1>
            <p
              style={{
                fontSize: 15,
                color: "var(--ink-soft)",
                margin: 0,
                lineHeight: 1.6,
                maxWidth: 480,
              }}
            >
              {rapot.total_errors_major + rapot.total_errors_minor === 0
                ? "Masya Allah, bacaan Anda sangat baik. Tidak ada catatan khusus dari sistem."
                : `Ada ${
                    rapot.total_errors_major + rapot.total_errors_minor
                  } catatan kecil. Pelajari rinciannya di bawah untuk perbaikan berikutnya.`}
            </p>
          </div>
        </div>

        <div
          className="rapot-stats-row"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            marginTop: 28,
            paddingTop: 24,
            borderTop: "1px solid var(--line)",
            position: "relative",
          }}
        >
          {[
            {
              label: "Major",
              val: String(rapot.total_errors_major),
              color: "var(--danger)",
            },
            {
              label: "Minor",
              val: String(rapot.total_errors_minor),
              color: "var(--warning)",
            },
            {
              label: "Durasi",
              val: fmt(submission?.audio_duration_sec),
              color: "var(--success)",
            },
          ].map((s) => (
            <div key={s.label}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                  marginBottom: 6,
                }}
              >
                {s.label}
              </div>
              <div
                className="font-display stat-val"
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: s.color,
                  letterSpacing: "-0.03em",
                }}
              >
                {s.val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Share row */}
      <div style={{ marginBottom: 26 }}>
        <ShareButtons slug={slug} skor={rapot.skor} />
      </div>

      {/* AI Narrative — optional, only if generated */}
      {rapot.ai_narrative && <AINarrative narrative={rapot.ai_narrative} />}

      {/* Tinjauan per Ayat */}
      <section style={{ marginBottom: 36 }}>
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(22px, 3vw, 28px)",
            margin: "0 0 6px",
            fontWeight: 800,
            letterSpacing: "-0.025em",
          }}
        >
          Tinjauan per Ayat
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            margin: "0 0 18px",
          }}
        >
          Kata-kata yang perlu diperhatikan ditandai dengan warna sesuai
          kategori.
        </p>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          {(Object.entries(INDIKATOR_META) as [IndikatorKey, (typeof INDIKATOR_META)[IndikatorKey]][]).map(
            ([k, m]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--ink-soft)",
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    background: `color-mix(in oklab, ${m.color}, transparent 70%)`,
                    borderBottom: `2px solid ${m.color}`,
                  }}
                />
                {m.label}
              </div>
            ),
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 12,
          }}
        >
          {AL_FATIHAH.map((a) => (
            <AyatCard
              key={a.number}
              ayatNumber={a.number}
              errorsByCategory={errorsByCategory}
            />
          ))}
        </div>
      </section>

      {/* Detail per Indikator */}
      <section style={{ marginBottom: 36 }}>
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(22px, 3vw, 28px)",
            margin: "0 0 6px",
            fontWeight: 800,
            letterSpacing: "-0.025em",
          }}
        >
          Detail per Indikator
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            margin: "0 0 18px",
          }}
        >
          Catatan lengkap untuk setiap kategori — klik untuk lihat rincian.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {indikatorEntries.map((it) => (
            <IndikatorCard
              key={it.kategori}
              kategori={it.kategori}
              errors={it.errors}
            />
          ))}
        </div>
      </section>

      {/* Brand mark divider */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 18,
        }}
        aria-hidden
      >
        <MountainGlyph size={28} color="var(--accent)" />
      </div>

      {submission && (
        <InterestGate
          rapotSlug={slug}
          submissionId={submission.id}
          jenisKelamin={submission.jenis_kelamin}
        />
      )}

      <div
        style={{
          marginTop: 28,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Link
          href="/assessment/consent"
          className="btn-mpt btn-mpt-outline"
          style={{ minHeight: 44, padding: "10px 20px", fontSize: 13 }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Ulangi Assessment
        </Link>
        <p
          style={{
            fontSize: 11,
            color: "var(--ink-mute)",
            textAlign: "center",
            margin: "8px 0 0",
            lineHeight: 1.5,
          }}
        >
          Model: {rapot.ml_model_version ?? "—"} · Confidence{" "}
          {rapot.ml_confidence
            ? `${(rapot.ml_confidence * 100).toFixed(0)}%`
            : "—"}{" "}
          · Hasil bersifat referensi, bukan pengganti penilaian langsung
        </p>
      </div>
    </div>
  );
}
