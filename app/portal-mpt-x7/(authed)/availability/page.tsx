import { getCurrentTeacher } from "@/lib/auth/teacher";
import { supabaseService } from "@/lib/supabase";
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
  const sb = supabaseService();
  try {
    const { data } = await sb
      .from("teacher_availability")
      .select("id, day_of_week, start_time, end_time, kind, is_active")
      .eq("teacher_id", teacherId)
      .eq("is_active", true)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    return (data ?? []) as Window[];
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
