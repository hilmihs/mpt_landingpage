import { getCurrentTeacher } from "@/lib/auth/teacher";
import { sql } from "@/lib/db";
import { AvailabilityManager } from "@/components/portal/AvailabilityManager";

export const dynamic = "force-dynamic";

interface Window {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  kind: "assessment" | "tahsin";
  is_active: boolean;
}

async function fetchWindows(teacherId: string): Promise<Window[]> {
  try {
    const rows = await sql<Window[]>`
      SELECT id, day_of_week, start_time, end_time, kind, is_active
        FROM teacher_availability
       WHERE teacher_id = ${teacherId}
         AND is_active = true
       ORDER BY day_of_week ASC, start_time ASC`;
    return rows;
  } catch {
    return [];
  }
}

export default async function AvailabilityPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) return null;

  const windows = await fetchWindows(teacher.teacherId);

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
          Pengaturan
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
          Ketersediaan Mengajar
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "6px 0 0", maxWidth: 560 }}>
          Atur kapan Anda tersedia untuk mengajar. Sistem akan otomatis membuka
          slot booking konkret setiap minggu berdasarkan window ini.
        </p>
      </header>

      <AvailabilityManager initialWindows={windows} />
    </div>
  );
}
