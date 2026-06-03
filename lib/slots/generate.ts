import { supabaseService } from "@/lib/supabase";
import { createMeeting, deleteMeeting, isMeetConfigured } from "@/lib/google-meet/client";

const DURATION_BY_KIND: Record<"assessment" | "tahsin", number> = {
  assessment: 60,
  tahsin: 90,
};

const DEFAULT_CAPACITY = 12;

interface AvailabilityWindow {
  id: string;
  teacher_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  kind: "assessment" | "tahsin";
  effective_from: string | null;
  effective_until: string | null;
}

interface Teacher {
  id: string;
  nama: string;
  jenis_kelamin: "ikhwan" | "akhwat";
  status: string;
  email_meet: string | null;
}

export interface SlotGenerationResult {
  teacher_id: string;
  windows_processed: number;
  slots_created: number;
  slots_skipped: number;
  meet_meetings_created: number;
  meet_errors: number;
  errors: string[];
}

export async function generateSlotsForTeacher(
  teacherId: string,
  weeksAhead = 4,
): Promise<SlotGenerationResult> {
  const sb = supabaseService();
  const result: SlotGenerationResult = {
    teacher_id: teacherId,
    windows_processed: 0,
    slots_created: 0,
    slots_skipped: 0,
    meet_meetings_created: 0,
    meet_errors: 0,
    errors: [],
  };

  const { data: teacherData, error: teacherErr } = await sb
    .from("teachers")
    .select("id, nama, jenis_kelamin, status, email_meet")
    .eq("id", teacherId)
    .maybeSingle();

  if (teacherErr || !teacherData) {
    result.errors.push("Pengajar tidak ditemukan.");
    return result;
  }
  const teacher = teacherData as Teacher;
  if (teacher.status !== "active") {
    result.errors.push(`Status pengajar bukan active (${teacher.status}).`);
    return result;
  }

  const { data: windowsData } = await sb
    .from("teacher_availability")
    .select(
      "id, teacher_id, day_of_week, start_time, end_time, kind, effective_from, effective_until",
    )
    .eq("teacher_id", teacherId)
    .eq("is_active", true);

  const windows = (windowsData ?? []) as AvailabilityWindow[];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + weeksAhead * 7);

  for (const w of windows) {
    result.windows_processed++;

    const effectiveFrom = w.effective_from ? new Date(w.effective_from) : today;
    const effectiveUntil = w.effective_until
      ? new Date(w.effective_until)
      : null;

    for (
      let cursor = new Date(Math.max(today.getTime(), effectiveFrom.getTime()));
      cursor < horizon;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      if (cursor.getDay() !== w.day_of_week) continue;
      if (effectiveUntil && cursor > effectiveUntil) break;

      const [hh, mm] = w.start_time.split(":").map(Number);
      const scheduledAt = new Date(cursor);
      scheduledAt.setHours(hh!, mm!, 0, 0);

      if (scheduledAt.getTime() < Date.now() + 24 * 60 * 60_000) continue;

      const durationMin = DURATION_BY_KIND[w.kind];
      const scheduledAtISO = scheduledAt.toISOString();

      const { data: existing } = await sb
        .from("slots")
        .select("id, meet_calendar_event_id")
        .eq("teacher_id", teacherId)
        .eq("scheduled_at", scheduledAtISO)
        .maybeSingle();

      let slotId: string;
      if (existing) {
        const existingRow = existing as {
          id: string;
          meet_calendar_event_id: string | null;
        };
        if (existingRow.meet_calendar_event_id) {
          result.slots_skipped++;
          continue;
        }
        slotId = existingRow.id;
      } else {
        const { data: insertedSlot, error: insertErr } = await sb
          .from("slots")
          .insert({
            teacher_id: teacherId,
            kind: w.kind,
            scheduled_at: scheduledAtISO,
            duration_min: durationMin,
            capacity: DEFAULT_CAPACITY,
            gender_target: teacher.jenis_kelamin,
            status: "scheduled",
          })
          .select("id")
          .single();

        if (insertErr || !insertedSlot) {
          result.errors.push(
            `${scheduledAtISO}: ${insertErr?.message.slice(0, 100) ?? "insert failed"}`,
          );
          continue;
        }
        slotId = (insertedSlot as { id: string }).id;
        result.slots_created++;
      }

      if (isMeetConfigured()) {
        if (!teacher.email_meet) {
          result.meet_errors++;
          result.errors.push(
            `Meet (${scheduledAtISO}): teacher.email_meet kosong, skip Meet create`,
          );
          continue;
        }

        let createdEventId: string | null = null;
        try {
          const meeting = await createMeeting({
            teacher_email: teacher.email_meet,
            topic: `${w.kind === "assessment" ? "Assessment" : "Tahsin"} Al-Fatihah — ${teacher.nama}`,
            start_time: scheduledAtISO,
            duration_min: durationMin,
            description:
              w.kind === "assessment"
                ? "Sesi assessment bacaan Al-Fatihah dengan pengajar Muhajir Project Tilawah."
                : "Sesi Tahsin Al-Fatihah — perbaikan bacaan.",
          });
          createdEventId = meeting.calendar_event_id;

          const { error: updateErr } = await sb
            .from("slots")
            .update({
              meet_calendar_event_id: meeting.calendar_event_id,
              meet_join_url: meeting.join_url,
              meet_conference_id: meeting.conference_id,
              meet_host_email: meeting.host_email,
            })
            .eq("id", slotId);

          if (updateErr) {
            await deleteMeeting(teacher.email_meet, meeting.calendar_event_id).catch(() => {});
            result.meet_errors++;
            result.errors.push(
              `Meet (${scheduledAtISO}): slot update failed (${updateErr.message.slice(0, 80)}), calendar event deleted`,
            );
            continue;
          }

          result.meet_meetings_created++;
        } catch (meetErr) {
          if (createdEventId && teacher.email_meet) {
            await deleteMeeting(teacher.email_meet, createdEventId).catch(() => {});
          }
          result.meet_errors++;
          result.errors.push(
            `Meet (${scheduledAtISO}): ${meetErr instanceof Error ? meetErr.message.slice(0, 120) : "failed"}`,
          );
        }
      }
    }
  }

  return result;
}

export async function generateSlotsForAllTeachers(
  weeksAhead = 4,
): Promise<SlotGenerationResult[]> {
  const sb = supabaseService();
  const { data } = await sb
    .from("teachers")
    .select("id")
    .eq("status", "active");

  const results: SlotGenerationResult[] = [];
  for (const t of (data ?? []) as { id: string }[]) {
    results.push(await generateSlotsForTeacher(t.id, weeksAhead));
  }
  return results;
}
