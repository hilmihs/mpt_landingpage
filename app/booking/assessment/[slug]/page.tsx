import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { supabaseService } from "@/lib/supabase";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { MountainGlyph } from "@/components/shared/MPTLogo";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Pilih Jadwal Pendampingan — Muhajir Project Tilawah",
  description:
    "Booking sesi pendampingan 60 menit dengan pengajar MPT, gender-matched, via Zoom.",
  robots: { index: false, follow: false },
};

interface Slot {
  id: string;
  scheduled_at: string;
  duration_min: number;
  capacity: number;
  reserved_count: number;
  available_capacity: number;
  teacher_nama: string;
}

async function fetchSlots(
  gender: "ikhwan" | "akhwat",
): Promise<{ slots: Slot[]; systemReady: boolean }> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("v_slots_availability")
    .select(
      "id, scheduled_at, duration_min, capacity, reserved_count, available_capacity, teacher_nama, kind, gender_target, status",
    )
    .eq("kind", "assessment")
    .eq("gender_target", gender)
    .gt("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(60);

  if (error) {
    const isMissing =
      error.message.toLowerCase().includes("does not exist") ||
      error.message.toLowerCase().includes("relation");
    return { slots: [], systemReady: !isMissing };
  }

  return {
    slots: (data ?? [])
      .filter((s) => s.available_capacity > 0)
      .map((s) => ({
        id: s.id as string,
        scheduled_at: s.scheduled_at as string,
        duration_min: s.duration_min as number,
        capacity: s.capacity as number,
        reserved_count: s.reserved_count as number,
        available_capacity: s.available_capacity as number,
        teacher_nama: s.teacher_nama as string,
      })),
    systemReady: true,
  };
}

export default async function BookingAssessmentPage({ params }: Props) {
  const { slug } = await params;
  const sb = supabaseService();

  const { data: rapotRaw } = await sb
    .from("rapot")
    .select("slug, skor, status_label, submissions(nama, jenis_kelamin)")
    .eq("slug", slug)
    .maybeSingle();

  const rapot = rapotRaw as
    | {
        slug: string;
        skor: number;
        status_label: string;
        submissions: { nama: string; jenis_kelamin: "ikhwan" | "akhwat" } | null;
      }
    | null;

  if (!rapot) notFound();

  const submission = rapot.submissions;
  if (!submission) notFound();

  const { slots, systemReady } = await fetchSlots(submission.jenis_kelamin);

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 20px 80px" }}>
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
        Kembali ke Rapot
      </Link>

      <div style={{ marginBottom: 28 }}>
        <div
          className="pill"
          style={{
            background: "color-mix(in oklab, var(--accent), transparent 80%)",
            color: "var(--accent)",
            marginBottom: 14,
          }}
        >
          Langkah 1 dari 2 · Pilih Waktu
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(28px, 4.5vw, 40px)",
            margin: "0 0 12px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
          }}
        >
          Pilih jadwal pendampingan
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "var(--ink-soft)",
            lineHeight: 1.65,
            maxWidth: 620,
            margin: 0,
          }}
        >
          Halo <strong>{submission.nama}</strong>, sesi pendampingan 60 menit
          via Zoom, maksimal 12 peserta per slot, bersama pengajar{" "}
          {submission.jenis_kelamin === "ikhwan" ? "ikhwan" : "akhwat"}.
          Pengajar akan menjelaskan rapot Anda lebih dalam dan langsung praktek
          perbaikan.
        </p>
      </div>

      <SlotPicker
        rapotSlug={slug}
        gender={submission.jenis_kelamin}
        initialSlots={slots}
        systemReady={systemReady}
      />

      <div
        style={{
          marginTop: 48,
          display: "flex",
          justifyContent: "center",
        }}
        aria-hidden
      >
        <MountainGlyph size={22} color="var(--accent)" />
      </div>
    </div>
  );
}
