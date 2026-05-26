import { supabaseService } from "@/lib/supabase";
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
  zoom_join_url: string | null;
}

async function fetchSlots(): Promise<Slot[]> {
  const sb = supabaseService();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 28);

  try {
    const { data } = await sb
      .from("slots")
      .select(
        `id, teacher_id, kind, scheduled_at, duration_min, capacity, reserved_count, gender_target, status, zoom_join_url,
         teachers:teacher_id(nama)`,
      )
      .lte("scheduled_at", horizon.toISOString())
      .order("scheduled_at", { ascending: true });

    const rows = (data ?? []) as unknown as {
      id: string;
      teacher_id: string;
      kind: string;
      scheduled_at: string;
      duration_min: number;
      capacity: number;
      reserved_count: number;
      gender_target: string;
      status: string;
      zoom_join_url: string | null;
      teachers: { nama: string } | null;
    }[];

    return rows.map((r) => ({
      id: r.id,
      teacher_id: r.teacher_id,
      teacher_nama: r.teachers?.nama ?? "—",
      kind: r.kind,
      scheduled_at: r.scheduled_at,
      duration_min: r.duration_min,
      capacity: r.capacity,
      reserved_count: r.reserved_count,
      gender_target: r.gender_target,
      status: r.status,
      zoom_join_url: r.zoom_join_url,
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
