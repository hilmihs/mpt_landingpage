import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { sql } from "@/lib/db";
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
    "Booking sesi pendampingan 60 menit dengan pengajar MPT, gender-matched, via Google Meet.",
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
  let data: {
    id: string;
    scheduled_at: Date;
    duration_min: number;
    capacity: number;
    reserved_count: number;
    available_capacity: number;
    teacher_nama: string;
  }[];

  try {
    data = await sql`
      SELECT id, scheduled_at, duration_min, capacity, reserved_count,
             available_capacity, teacher_nama, kind, gender_target, status
      FROM v_slots_availability
      WHERE kind = ${"assessment"}
        AND gender_target = ${gender}
        AND scheduled_at > ${new Date()}
      ORDER BY scheduled_at ASC
      LIMIT 60
    `;
  } catch (err) {
    const message = (err as Error).message;
    const isMissing =
      message.toLowerCase().includes("does not exist") ||
      message.toLowerCase().includes("relation");
    return { slots: [], systemReady: !isMissing };
  }

  return {
    slots: data
      .filter((s) => s.available_capacity > 0)
      .map((s) => ({
        id: s.id,
        scheduled_at: s.scheduled_at.toISOString(),
        duration_min: s.duration_min,
        capacity: s.capacity,
        reserved_count: s.reserved_count,
        available_capacity: s.available_capacity,
        teacher_nama: s.teacher_nama,
      })),
    systemReady: true,
  };
}

export default async function BookingAssessmentPage({ params }: Props) {
  const { slug } = await params;

  const rapotRows = await sql<
    {
      slug: string;
      skor: number;
      status_label: string;
      nama: string | null;
      jenis_kelamin: "ikhwan" | "akhwat" | null;
    }[]
  >`
    SELECT r.slug, r.skor, r.status_label, s.nama, s.jenis_kelamin
    FROM rapot r
    LEFT JOIN submissions s ON s.id = r.submission_id
    WHERE r.slug = ${slug}
    LIMIT 1
  `;

  const rapot = rapotRows[0] ?? null;

  if (!rapot) notFound();

  const submission =
    rapot.nama !== null && rapot.jenis_kelamin !== null
      ? { nama: rapot.nama, jenis_kelamin: rapot.jenis_kelamin }
      : null;
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
          via Google Meet, maksimal 12 peserta per slot, bersama pengajar{" "}
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
