import { Calendar, Users, ClipboardCheck, CalendarClock } from "lucide-react";
import Link from "next/link";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { supabaseService } from "@/lib/supabase";
import { startOfJakartaDay, endOfJakartaDay } from "@/lib/time";

export const dynamic = "force-dynamic";

interface Stats {
  upcomingSlots: number;
  pendingAttendance: number;
  activeAvailabilityWindows: number;
}

async function fetchStats(teacherId: string): Promise<Stats> {
  const sb = supabaseService();

  try {
    const [slots, pendingAttendance, availability] = await Promise.all([
      sb
        .from("slots")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", teacherId)
        .gt("scheduled_at", new Date().toISOString())
        .eq("status", "scheduled"),
      sb
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("need_review", true),
      sb
        .from("teacher_availability")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", teacherId)
        .eq("is_active", true),
    ]);

    return {
      upcomingSlots: slots.count ?? 0,
      pendingAttendance: pendingAttendance.count ?? 0,
      activeAvailabilityWindows: availability.count ?? 0,
    };
  } catch {
    return {
      upcomingSlots: 0,
      pendingAttendance: 0,
      activeAvailabilityWindows: 0,
    };
  }
}

interface TodaySlot {
  id: string;
  scheduled_at: string;
  duration_min: number;
  reserved_count: number;
  capacity: number;
  zoom_join_url: string | null;
}

async function fetchTodaySlots(teacherId: string): Promise<TodaySlot[]> {
  const sb = supabaseService();
  const startWIB = startOfJakartaDay();
  const endWIB = endOfJakartaDay();

  try {
    const { data } = await sb
      .from("slots")
      .select("id, scheduled_at, duration_min, reserved_count, capacity, zoom_join_url")
      .eq("teacher_id", teacherId)
      .gte("scheduled_at", startWIB.toISOString())
      .lte("scheduled_at", endWIB.toISOString())
      .order("scheduled_at", { ascending: true });
    return (data ?? []) as TodaySlot[];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) return null;

  const [stats, todaySlots] = await Promise.all([
    fetchStats(teacher.teacherId),
    fetchTodaySlots(teacher.teacherId),
  ]);

  return (
    <div style={{ maxWidth: 1080 }}>
      <header style={{ marginBottom: 28 }}>
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
          Dashboard
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
          Assalamu&apos;alaikum, {teacher.nama.split(" ")[0]}
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "6px 0 0" }}>
          Ringkasan aktivitas mengajar Anda hari ini.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 32,
        }}
      >
        <StatCard
          icon={<Calendar size={18} strokeWidth={2.2} />}
          label="Slot Mendatang"
          value={stats.upcomingSlots}
          sub="terjadwal"
        />
        <StatCard
          icon={<Users size={18} strokeWidth={2.2} />}
          label="Sesi Hari Ini"
          value={todaySlots.length}
          sub="dijadwalkan"
        />
        <StatCard
          icon={<ClipboardCheck size={18} strokeWidth={2.2} />}
          label="Perlu Direview"
          value={stats.pendingAttendance}
          sub="kehadiran ambigu"
          accent={stats.pendingAttendance > 0}
        />
        <StatCard
          icon={<CalendarClock size={18} strokeWidth={2.2} />}
          label="Ketersediaan Aktif"
          value={stats.activeAvailabilityWindows}
          sub="window per minggu"
        />
      </div>

      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <h2
            className="font-display"
            style={{
              fontSize: 20,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Jadwal Hari Ini
          </h2>
          <Link
            href="/portal-mpt-x7/availability"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--accent)",
              textDecoration: "none",
            }}
          >
            Atur Ketersediaan →
          </Link>
        </div>

        {todaySlots.length === 0 ? (
          <div
            className="card-mpt"
            style={{
              padding: "32px 22px",
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
                background:
                  "color-mix(in oklab, var(--accent), transparent 88%)",
                color: "var(--accent)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Calendar size={20} strokeWidth={2.2} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              Tidak ada sesi terjadwal hari ini
            </div>
            <div style={{ fontSize: 12 }}>
              Atur ketersediaan supaya peserta bisa booking slot Anda.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {todaySlots.map((slot) => (
              <SlotRow key={slot.id} slot={slot} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className="card-mpt"
      style={{
        padding: "18px 18px",
        position: "relative",
        borderColor: accent
          ? "color-mix(in oklab, var(--warning), transparent 60%)"
          : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: accent
              ? "color-mix(in oklab, var(--warning), transparent 85%)"
              : "color-mix(in oklab, var(--accent), transparent 88%)",
            color: accent ? "var(--warning)" : "var(--accent)",
            display: "grid",
            placeItems: "center",
          }}
        >
          {icon}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
          }}
        >
          {label}
        </div>
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: "var(--ink)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>
        {sub}
      </div>
    </div>
  );
}

function SlotRow({ slot }: { slot: TodaySlot }) {
  const d = new Date(slot.scheduled_at);
  const start = `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  const end = new Date(d.getTime() + slot.duration_min * 60_000);
  const endStr = `${String(end.getHours()).padStart(2, "0")}.${String(end.getMinutes()).padStart(2, "0")}`;

  return (
    <div
      className="card-mpt"
      style={{
        padding: "14px 18px",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 14,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: "color-mix(in oklab, var(--accent), transparent 88%)",
          color: "var(--accent)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Calendar size={18} strokeWidth={2.2} />
      </div>
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--ink)",
            marginBottom: 2,
          }}
        >
          {start} – {endStr}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
          {slot.reserved_count} dari {slot.capacity} peserta
        </div>
      </div>
      {slot.zoom_join_url && (
        <a
          href={slot.zoom_join_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-mpt btn-mpt-accent"
          style={{ minHeight: 36, fontSize: 12, padding: "6px 12px" }}
        >
          Buka Zoom
        </a>
      )}
    </div>
  );
}
