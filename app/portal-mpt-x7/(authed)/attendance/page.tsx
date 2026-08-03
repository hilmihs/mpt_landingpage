import { getCurrentTeacher } from "@/lib/auth/teacher";
import { sql } from "@/lib/db";
import { AttendanceManager } from "@/components/portal/AttendanceManager";

export const dynamic = "force-dynamic";

interface AttendanceRow {
  booking_id: string;
  participant_nama: string;
  participant_wa: string;
  scheduled_at: string;
  duration_min: number;
  kind: string;
  attended: boolean | null;
  source: string | null;
  need_review: boolean;
}

async function fetchPastBookings(teacherId: string): Promise<AttendanceRow[]> {
  const horizonPast = new Date();
  horizonPast.setDate(horizonPast.getDate() - 30);

  try {
    const rows = await sql<
      {
        id: string;
        scheduled_at: Date;
        duration_min: number;
        kind: string;
        nama: string;
        nomor_wa: string;
        attended: boolean | null;
        source: string | null;
        need_review: boolean | null;
      }[]
    >`
      SELECT b.id,
             s.scheduled_at,
             s.duration_min,
             s.kind,
             sub.nama,
             sub.nomor_wa,
             a.attended,
             a.source,
             a.need_review
        FROM bookings b
        JOIN slots s ON s.id = b.slot_id
        JOIN submissions sub ON sub.id = b.submission_id
        LEFT JOIN LATERAL (
          SELECT attended, source, need_review
            FROM attendance
           WHERE booking_id = b.id
           LIMIT 1
        ) a ON true
       WHERE s.teacher_id = ${teacherId}
         AND s.scheduled_at <= ${new Date()}
         AND s.scheduled_at >= ${horizonPast}
         AND b.status <> 'cancelled'
       ORDER BY b.created_at DESC
       LIMIT 80`;

    return rows
      .map((r) => ({
        booking_id: r.id,
        participant_nama: r.nama,
        participant_wa: r.nomor_wa,
        scheduled_at: r.scheduled_at.toISOString(),
        duration_min: r.duration_min,
        kind: r.kind,
        attended: r.attended ?? null,
        source: r.source ?? null,
        need_review: r.need_review ?? false,
      }))
      .sort((a, b) => {
        // Need review first, then by date desc
        if (a.need_review && !b.need_review) return -1;
        if (!a.need_review && b.need_review) return 1;
        return b.scheduled_at.localeCompare(a.scheduled_at);
      });
  } catch {
    return [];
  }
}

export default async function AttendancePage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) return null;

  const rows = await fetchPastBookings(teacher.teacherId);

  return (
    <div style={{ maxWidth: 880 }}>
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
          Kehadiran
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
          Review Kehadiran
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            margin: "6px 0 0",
            maxWidth: 560,
          }}
        >
          Booking dari sesi 30 hari terakhir. Yang ditandai &quot;Perlu Review&quot;
          adalah kasus di mana Google Meet tidak yakin (nama tidak match).
          Tandai hadir / tidak hadir untuk override manual.
        </p>
      </header>

      <AttendanceManager initial={rows} />
    </div>
  );
}
