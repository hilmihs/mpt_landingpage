import { Users, Calendar, Clock } from "lucide-react";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

interface BookingItem {
  id: string;
  status: string;
  scheduled_at: string;
  duration_min: number;
  participant_nama: string;
  participant_wa: string;
  kind: string;
}

async function fetchBookings(teacherId: string): Promise<BookingItem[]> {
  try {
    const rows = await sql<
      {
        id: string;
        status: string;
        scheduled_at: Date;
        duration_min: number;
        kind: string;
        nama: string;
        nomor_wa: string;
      }[]
    >`
      SELECT b.id,
             b.status,
             s.scheduled_at,
             s.duration_min,
             s.kind,
             sub.nama,
             sub.nomor_wa
        FROM bookings b
        JOIN slots s ON s.id = b.slot_id
        JOIN submissions sub ON sub.id = b.submission_id
       WHERE s.teacher_id = ${teacherId}
         AND b.status <> 'cancelled'
       ORDER BY b.created_at DESC
       LIMIT 60`;

    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      scheduled_at: r.scheduled_at.toISOString(),
      duration_min: r.duration_min,
      participant_nama: r.nama,
      participant_wa: r.nomor_wa,
      kind: r.kind,
    }));
  } catch {
    return [];
  }
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  reserved: { label: "Reserved", color: "var(--warning)" },
  confirmed: { label: "Confirmed", color: "var(--accent)" },
  attended: { label: "Hadir", color: "var(--success)" },
  no_show: { label: "Tidak Hadir", color: "var(--danger)" },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function fmtTime(iso: string, durationMin: number): string {
  const d = new Date(iso);
  const start = `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  const end = new Date(d.getTime() + durationMin * 60_000);
  const endStr = `${String(end.getHours()).padStart(2, "0")}.${String(end.getMinutes()).padStart(2, "0")}`;
  return `${start} – ${endStr}`;
}

export default async function BookingsPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) return null;

  const bookings = await fetchBookings(teacher.teacherId);

  return (
    <div style={{ maxWidth: 1080 }}>
      <header style={{ marginBottom: 24 }}>
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
          Daftar Booking
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(24px, 3.5vw, 32px)",
            fontWeight: 800,
            margin: 0,
            letterSpacing: "-0.025em",
          }}
        >
          Booking Masuk
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "6px 0 0", maxWidth: 560 }}>
          Peserta yang mendaftar ke slot Anda — diurutkan dari yang terbaru.
        </p>
      </header>

      {bookings.length === 0 ? (
        <div
          className="card-mpt"
          style={{
            padding: "40px 24px",
            textAlign: "center",
            color: "var(--ink-soft)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              margin: "0 auto 12px",
              borderRadius: 12,
              background: "color-mix(in oklab, var(--accent), transparent 88%)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Users size={20} strokeWidth={2.2} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            Belum ada booking
          </div>
          <div style={{ fontSize: 12 }}>
            Pastikan ketersediaan Anda sudah diatur, lalu sistem akan membuka slot otomatis.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bookings.map((b) => {
            const status = STATUS_LABEL[b.status] ?? {
              label: b.status,
              color: "var(--ink-mute)",
            };
            return (
              <div
                key={b.id}
                className="card-mpt"
                style={{
                  padding: "14px 18px",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                    {b.participant_nama}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      fontSize: 12,
                      color: "var(--ink-soft)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Calendar size={12} strokeWidth={2.2} /> {fmtDate(b.scheduled_at)}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Clock size={12} strokeWidth={2.2} /> {fmtTime(b.scheduled_at, b.duration_min)}
                    </span>
                    <span>{b.participant_wa}</span>
                  </div>
                </div>
                <span
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    borderRadius: 6,
                    background: `color-mix(in oklab, ${status.color}, transparent 85%)`,
                    color: status.color,
                  }}
                >
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
