import { getCurrentTeacher } from "@/lib/auth/teacher";
import { supabaseService } from "@/lib/supabase";
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
  const sb = supabaseService();
  const horizonPast = new Date();
  horizonPast.setDate(horizonPast.getDate() - 30);

  try {
    const { data } = await sb
      .from("bookings")
      .select(
        `id,
         slots:slot_id!inner(teacher_id, scheduled_at, duration_min, kind),
         submissions:submission_id(nama, nomor_wa),
         attendance(attended, source, need_review)`,
      )
      .eq("slots.teacher_id", teacherId)
      .lte("slots.scheduled_at", new Date().toISOString())
      .gte("slots.scheduled_at", horizonPast.toISOString())
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(80);

    const rows = (data ?? []) as unknown as {
      id: string;
      slots: {
        scheduled_at: string;
        duration_min: number;
        kind: string;
      } | null;
      submissions: { nama: string; nomor_wa: string } | null;
      attendance:
        | { attended: boolean | null; source: string | null; need_review: boolean }[]
        | null;
    }[];

    return rows
      .filter((r) => r.slots && r.submissions)
      .map((r) => {
        const att = r.attendance?.[0] ?? null;
        return {
          booking_id: r.id,
          participant_nama: r.submissions!.nama,
          participant_wa: r.submissions!.nomor_wa,
          scheduled_at: r.slots!.scheduled_at,
          duration_min: r.slots!.duration_min,
          kind: r.slots!.kind,
          attended: att?.attended ?? null,
          source: att?.source ?? null,
          need_review: att?.need_review ?? false,
        };
      })
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
          adalah kasus di mana Zoom webhook tidak yakin (nama tidak match).
          Tandai hadir / tidak hadir untuk override manual.
        </p>
      </header>

      <AttendanceManager initial={rows} />
    </div>
  );
}
