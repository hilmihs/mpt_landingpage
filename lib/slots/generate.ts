import { sql } from "@/lib/db";
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
  const result: SlotGenerationResult = {
    teacher_id: teacherId,
    windows_processed: 0,
    slots_created: 0,
    slots_skipped: 0,
    meet_meetings_created: 0,
    meet_errors: 0,
    errors: [],
  };

  let teacherData: Teacher | null = null;
  try {
    const rows = await sql<Teacher[]>`
      SELECT id, nama, jenis_kelamin, status, email_meet
      FROM teachers
      WHERE id = ${teacherId}
      LIMIT 1
    `;
    teacherData = rows[0] ?? null;
  } catch {
    teacherData = null;
  }

  if (!teacherData) {
    result.errors.push("Pengajar tidak ditemukan.");
    return result;
  }
  const teacher = teacherData;
  if (teacher.status !== "active") {
    result.errors.push(`Status pengajar bukan active (${teacher.status}).`);
    return result;
  }

  // effective_from/until di-cast ke text supaya tetap 'YYYY-MM-DD' seperti
  // sebelumnya (dipakai lewat new Date(...) di bawah).
  const windows = await sql<AvailabilityWindow[]>`
    SELECT id, teacher_id, day_of_week, start_time, end_time, kind,
           effective_from::text AS effective_from,
           effective_until::text AS effective_until
    FROM teacher_availability
    WHERE teacher_id = ${teacherId}
      AND is_active = ${true}
  `;

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

      const existingRows = await sql<
        { id: string; meet_calendar_event_id: string | null }[]
      >`
        SELECT id, meet_calendar_event_id
        FROM slots
        WHERE teacher_id = ${teacherId}
          AND scheduled_at = ${scheduledAt}
        LIMIT 1
      `;
      const existing = existingRows[0] ?? null;

      let slotId: string;
      if (existing) {
        if (existing.meet_calendar_event_id) {
          result.slots_skipped++;
          continue;
        }
        slotId = existing.id;
      } else {
        let insertedSlot: { id: string } | null = null;
        try {
          const inserted = await sql<{ id: string }[]>`
            INSERT INTO slots
              (teacher_id, kind, scheduled_at, duration_min, capacity, gender_target, status)
            VALUES (
              ${teacherId},
              ${w.kind},
              ${scheduledAt},
              ${durationMin},
              ${DEFAULT_CAPACITY},
              ${teacher.jenis_kelamin},
              ${"scheduled"}
            )
            RETURNING id
          `;
          insertedSlot = inserted[0] ?? null;
        } catch (insertErr) {
          result.errors.push(
            `${scheduledAtISO}: ${(insertErr as Error).message.slice(0, 100)}`,
          );
          continue;
        }

        if (!insertedSlot) {
          result.errors.push(`${scheduledAtISO}: insert failed`);
          continue;
        }
        slotId = insertedSlot.id;
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

          try {
            await sql`
              UPDATE slots
              SET meet_calendar_event_id = ${meeting.calendar_event_id},
                  meet_join_url = ${meeting.join_url},
                  meet_conference_id = ${meeting.conference_id},
                  meet_host_email = ${meeting.host_email}
              WHERE id = ${slotId}
            `;
          } catch (updateErr) {
            await deleteMeeting(teacher.email_meet, meeting.calendar_event_id).catch(() => {});
            result.meet_errors++;
            result.errors.push(
              `Meet (${scheduledAtISO}): slot update failed (${(updateErr as Error).message.slice(0, 80)}), calendar event deleted`,
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
  const data = await sql<{ id: string }[]>`
    SELECT id FROM teachers WHERE status = ${"active"}
  `;

  const results: SlotGenerationResult[] = [];
  for (const t of data) {
    results.push(await generateSlotsForTeacher(t.id, weeksAhead));
  }
  return results;
}
