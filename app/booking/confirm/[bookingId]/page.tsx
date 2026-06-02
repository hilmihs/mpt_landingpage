import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  Calendar,
  Clock,
  Video,
  MessageCircle,
  ChevronLeft,
} from "lucide-react";
import { supabaseService } from "@/lib/supabase";
import { ZoomNameReminder } from "@/components/booking/ZoomNameReminder";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ bookingId: string }>;
}

export const metadata: Metadata = {
  title: "Booking Dikonfirmasi — Muhajir Project Tilawah",
  description: "Detail jadwal pendampingan Anda + link Zoom.",
  robots: { index: false, follow: false },
};

interface BookingDetail {
  id: string;
  status: string;
  notes_from_user: string | null;
  slot: {
    scheduled_at: string;
    duration_min: number;
    zoom_join_url: string | null;
    teacher_nama: string;
    gender_target: string;
  };
  submission: {
    nama: string;
    jenis_kelamin: string;
    nomor_wa: string;
    rapot_slug: string | null;
  };
}

async function fetchBooking(id: string): Promise<BookingDetail | null> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("bookings")
    .select(
      `id, status, notes_from_user,
       slots:slot_id(scheduled_at, duration_min, zoom_join_url, gender_target, teachers:teacher_id(nama)),
       submissions:submission_id(nama, jenis_kelamin, nomor_wa, rapot_slug)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as {
    id: string;
    status: string;
    notes_from_user: string | null;
    slots: {
      scheduled_at: string;
      duration_min: number;
      zoom_join_url: string | null;
      gender_target: string;
      teachers: { nama: string } | null;
    } | null;
    submissions: {
      nama: string;
      jenis_kelamin: string;
      nomor_wa: string;
      rapot_slug: string | null;
    } | null;
  };

  if (!row.slots || !row.submissions) return null;

  return {
    id: row.id,
    status: row.status,
    notes_from_user: row.notes_from_user,
    slot: {
      scheduled_at: row.slots.scheduled_at,
      duration_min: row.slots.duration_min,
      zoom_join_url: row.slots.zoom_join_url,
      gender_target: row.slots.gender_target,
      teacher_nama: row.slots.teachers?.nama ?? "Pengajar MPT",
    },
    submission: row.submissions,
  };
}

function fmtDateTime(iso: string, durationMin: number): string {
  const d = new Date(iso);
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const date = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  const start = `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  const end = new Date(d.getTime() + durationMin * 60_000);
  const endStr = `${String(end.getHours()).padStart(2, "0")}.${String(end.getMinutes()).padStart(2, "0")}`;
  return `${date}, ${start} – ${endStr} WIB`;
}

export default async function BookingConfirmPage({ params }: Props) {
  const { bookingId } = await params;
  const booking = await fetchBooking(bookingId);
  if (!booking) notFound();

  const { slot, submission } = booking;
  const dateText = fmtDateTime(slot.scheduled_at, slot.duration_min);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
      {submission.rapot_slug && (
        <Link
          href={`/rapot/${submission.rapot_slug}`}
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
      )}

      <div
        className="card-mpt"
        style={{
          padding: "32px 26px",
          marginBottom: 22,
          textAlign: "center",
          background:
            "color-mix(in oklab, var(--success), var(--surface) 92%)",
          borderColor: "color-mix(in oklab, var(--success), transparent 60%)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 16px",
            borderRadius: 16,
            background: "var(--success)",
            color: "white",
            display: "grid",
            placeItems: "center",
          }}
        >
          <CheckCircle2 size={32} strokeWidth={2.4} />
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--success)",
            marginBottom: 8,
          }}
        >
          Booking Terkonfirmasi
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(24px, 3.5vw, 32px)",
            margin: "0 0 10px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          Alhamdulillah, slot Anda sudah dipesan
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Detail jadwal + link Zoom kami kirimkan juga ke nomor WhatsApp{" "}
          <strong>{submission.nomor_wa}</strong>.
        </p>
      </div>

      <div
        className="card-mpt"
        style={{ padding: "24px 22px", marginBottom: 18 }}
      >
        <h2
          className="font-display"
          style={{
            fontSize: 19,
            fontWeight: 700,
            margin: "0 0 18px",
            letterSpacing: "-0.02em",
          }}
        >
          Detail Sesi
        </h2>

        <DetailRow
          icon={<Calendar size={18} strokeWidth={2.2} />}
          label="Jadwal"
          value={dateText}
        />
        <DetailRow
          icon={<Clock size={18} strokeWidth={2.2} />}
          label="Durasi"
          value={`${slot.duration_min} menit`}
        />
        <DetailRow
          icon={<MessageCircle size={18} strokeWidth={2.2} />}
          label="Pengajar"
          value={`${slot.teacher_nama} (${slot.gender_target})`}
        />

        {slot.zoom_join_url ? (
          <div style={{ marginTop: 18 }}>
            <a
              href={slot.zoom_join_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-mpt btn-mpt-accent"
              style={{
                minHeight: 52,
                fontSize: 15,
                fontWeight: 700,
                width: "100%",
              }}
            >
              <Video size={18} strokeWidth={2.4} />
              Buka Link Zoom
            </a>
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "var(--ink-mute)",
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              Link aktif 10 menit sebelum sesi dimulai
            </div>
          </div>
        ) : (
          <div
            style={{
              marginTop: 18,
              padding: "14px 16px",
              borderRadius: 10,
              background: "color-mix(in oklab, var(--warning), transparent 90%)",
              color: "var(--ink-soft)",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            Link Zoom akan dikirimkan H-1 lewat WhatsApp. Pastikan nomor{" "}
            <strong>{submission.nomor_wa}</strong> aktif.
          </div>
        )}
      </div>

      <div style={{ marginBottom: 22 }}>
        <ZoomNameReminder nama={submission.nama} variant="warning" />
      </div>

      <div
        className="card-mpt"
        style={{
          padding: "22px 22px",
          marginBottom: 22,
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--ink)",
            margin: "0 0 12px",
            letterSpacing: "-0.01em",
          }}
        >
          Persiapan Sebelum Sesi
        </h3>
        <ol
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: 13,
            color: "var(--ink-soft)",
            lineHeight: 1.7,
          }}
        >
          <li>Buka rapot Anda sebagai bahan diskusi dengan pengajar.</li>
          <li>Siapkan Mushaf atau aplikasi Quran di HP/laptop.</li>
          <li>Pakai earphone/headset supaya audio jelas dua arah.</li>
          <li>Cari tempat tenang, masuk Zoom 5 menit lebih awal.</li>
          <li>
            <strong>Pastikan nama Anda di Zoom = nama saat daftar</strong>{" "}
            (lihat catatan di atas).
          </li>
        </ol>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          justifyContent: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <a
          href={`https://wa.me/?text=${encodeURIComponent(
            `Booking pendampingan MPT saya:\n📅 ${dateText}\n👤 ${slot.teacher_nama}\n${slot.zoom_join_url ?? ""}`,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-mpt btn-mpt-outline"
          style={{ minHeight: 42, fontSize: 13 }}
        >
          <MessageCircle size={14} strokeWidth={2.2} />
          Bagikan via WhatsApp
        </a>
        {submission.rapot_slug && (
          <Link
            href={`/rapot/${submission.rapot_slug}`}
            className="btn-mpt btn-mpt-outline"
            style={{ minHeight: 42, fontSize: 13 }}
          >
            Lihat Rapot
          </Link>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 14,
        alignItems: "flex-start",
        padding: "10px 0",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: "color-mix(in oklab, var(--accent), transparent 88%)",
          color: "var(--accent)",
          display: "grid",
          placeItems: "center",
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
            marginBottom: 3,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 14,
            color: "var(--ink)",
            fontWeight: 600,
            lineHeight: 1.45,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
