import { sql } from "@/lib/db";
import { JadwalView } from "@/components/admin/JadwalView";

export const dynamic = "force-dynamic";

interface Slot {
  id: string;
  teacher_id: string;
  teacher_nama: string;
  kind: string;
  scheduled_at: string;
  duration_min: number;
  capacity: number;
  reserved_count: number;
  gender_target: string;
  status: string;
  meet_join_url: string | null;
}

async function fetchSlots(): Promise<Slot[]> {
  const now = new Date();
  // Window: 1 day in the past (to include sessions ending today) through 28 days ahead.
  const earliest = new Date(now);
  earliest.setDate(earliest.getDate() - 1);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 28);

  try {
    const rows = await sql<
      (Omit<Slot, "scheduled_at" | "teacher_nama"> & {
        scheduled_at: Date;
        teacher_nama: string | null;
      })[]
    >`
      SELECT s.id, s.teacher_id, s.kind, s.scheduled_at, s.duration_min,
             s.capacity, s.reserved_count, s.gender_target, s.status,
             s.meet_join_url,
             t.nama AS teacher_nama
      FROM slots s
      LEFT JOIN teachers t ON t.id = s.teacher_id
      WHERE s.scheduled_at >= ${earliest}
        AND s.scheduled_at <= ${horizon}
      ORDER BY s.scheduled_at ASC
      LIMIT 500
    `;

    return rows.map((r) => ({
      id: r.id,
      teacher_id: r.teacher_id,
      teacher_nama: r.teacher_nama ?? "—",
      kind: r.kind,
      scheduled_at: r.scheduled_at.toISOString(),
      duration_min: r.duration_min,
      capacity: r.capacity,
      reserved_count: r.reserved_count,
      gender_target: r.gender_target,
      status: r.status,
      meet_join_url: r.meet_join_url,
    }));
  } catch {
    return [];
  }
}

export default async function JadwalPage() {
  const slots = await fetchSlots();

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
          Manajemen Jadwal
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
          Semua Slot
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            margin: "6px 0 0",
            maxWidth: 600,
          }}
        >
          Slot konkret 4 minggu ke depan. Untuk men-generate slot dari window
          ketersediaan pengajar, gunakan tombol di kanan atas.
        </p>
      </header>

      <JadwalView initialSlots={slots} />
    </div>
  );
}
