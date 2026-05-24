import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabase";
import { SkorBadge } from "@/components/rapot/SkorBadge";
import { IndikatorSection } from "@/components/rapot/IndikatorSection";
import { ArabicHighlight } from "@/components/rapot/ArabicHighlight";
import { CTATahsin } from "@/components/rapot/CTATahsin";
import { ShareButtons } from "@/components/rapot/ShareButtons";
import type { RapotRow, IndikatorKey, ErrorItem } from "@/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getRapot(slug: string): Promise<RapotRow | null> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("rapot")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as RapotRow;
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <header className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Assessment Al-Fatihah · Rapot
        </p>
        <SkorBadge skor={rapot.skor} label={rapot.status_label} />
        <p className="text-xs text-muted-foreground">
          Major: {rapot.total_errors_major} · Minor: {rapot.total_errors_minor}
        </p>
      </header>

      <ShareButtons slug={slug} skor={rapot.skor} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tinjauan per Ayat</h2>
        <ArabicHighlight errorsByCategory={errorsByCategory} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Detail per Indikator</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <IndikatorSection
            kategori="harakat"
            errors={rapot.errors_harakat}
          />
          <IndikatorSection kategori="huruf" errors={rapot.errors_huruf} />
          <IndikatorSection
            kategori="panjang_pendek"
            errors={rapot.errors_panjang_pendek}
          />
          <IndikatorSection
            kategori="syaddah"
            errors={rapot.errors_syaddah}
          />
        </div>
      </section>

      <CTATahsin />

      <p className="text-xs text-muted-foreground text-center pt-4">
        Model: {rapot.ml_model_version ?? "—"} · Confidence:{" "}
        {rapot.ml_confidence ? `${(rapot.ml_confidence * 100).toFixed(0)}%` : "—"}
      </p>
    </div>
  );
}
