import { supabaseService } from "@/lib/supabase";
import { createMeeting, deleteMeeting, isZoomConfigured } from "@/lib/zoom/client";

/**
 * Slot duration is locked by business rule (see ARCHITECTURE_V2.md §3):
 * - assessment: 60 minutes (1-on-many with up to 12 peserta)
 * - tahsin: 90 minutes (4-session cohort)
 */
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
  email_zoom: string | null;
}

export interface SlotGenerationResult {
  teacher_id: string;
  windows_processed: number;
  slots_created: number;
  slots_skipped: number;
  zoom_meetings_created: number;
  zoom_errors: number;
  errors: string[];
}

/**
 * Generate concrete slot rows from a teacher's active availability windows
 * for the upcoming `weeksAhead` weeks. Idempotent — slots that already exist
 * at the same teacher+scheduled_at are skipped.
 */
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
    zoom_meetings_created: 0,
    zoom_errors: 0,
    errors: [],
  };

  const { data: teacherData, error: teacherErr } = await sb
    .from("teachers")
    .select("id, nama, jenis_kelamin, status, email_zoom")
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

    // Walk day-by-day inside horizon, picking matching day_of_week
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

      // Skip slots in the past or starting in less than 24 hours
      if (scheduledAt.getTime() < Date.now() + 24 * 60 * 60_000) continue;

      const durationMin = DURATION_BY_KIND[w.kind];
      const scheduledAtISO = scheduledAt.toISOString();

      // Idempotency check: same teacher + same exact scheduled_at.
      // We need slot_id + zoom_meeting_id so we can retry Zoom for a slot
      // that was inserted previously but never got a Zoom meeting attached.
      const { data: existing } = await sb
        .from("slots")
        .select("id, zoom_meeting_id")
        .eq("teacher_id", teacherId)
        .eq("scheduled_at", scheduledAtISO)
        .maybeSingle();

      let slotId: string;
      if (existing) {
        const existingRow = existing as {
          id: string;
          zoom_meeting_id: string | null;
        };
        if (existingRow.zoom_meeting_id) {
          // Fully provisioned (slot + Zoom) — skip entirely.
          result.slots_skipped++;
          continue;
        }
        // Slot exists but Zoom missing → fall through to Zoom retry below.
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

      if (isZoomConfigured()) {
        if (!teacher.email_zoom) {
          // Pengajar can't host without their Zoom email registered as
          // alternative_host. Skip Zoom creation; admin can attach later
          // after updating teacher profile.
          result.zoom_errors++;
          result.errors.push(
            `Zoom (${scheduledAtISO}): teacher.email_zoom kosong, skip Zoom create`,
          );
          continue;
        }

        let createdMeetingId: string | null = null;
        try {
          const meeting = await createMeeting({
            topic: `${w.kind === "assessment" ? "Assessment" : "Tahsin"} Al-Fatihah — ${teacher.nama}`,
            start_time: scheduledAtISO,
            duration_min: durationMin,
            alternative_hosts: [teacher.email_zoom],
            agenda:
              w.kind === "assessment"
                ? "Sesi assessment bacaan Al-Fatihah dengan pengajar Muhajir Project Tilawah."
                : "Sesi Tahsin Al-Fatihah — perbaikan bacaan.",
          });
          createdMeetingId = meeting.meeting_id;

          const { error: updateErr } = await sb
            .from("slots")
            .update({
              zoom_meeting_id: meeting.meeting_id,
              zoom_join_url: meeting.join_url,
              zoom_password: meeting.password,
              zoom_host_email: meeting.host_email,
            })
            .eq("id", slotId);

          if (updateErr) {
            // The slot UPDATE failed AFTER the Zoom meeting was created —
            // we have an orphan paid meeting. Delete it to prevent
            // duplicate billing and to keep state consistent.
            await deleteMeeting(meeting.meeting_id).catch(() => {});
            result.zoom_errors++;
            result.errors.push(
              `Zoom (${scheduledAtISO}): slot update failed (${updateErr.message.slice(0, 80)}), Zoom meeting deleted`,
            );
            continue;
          }

          result.zoom_meetings_created++;
        } catch (zoomErr) {
          // Defensive: if we got a meeting ID before throwing (unlikely
          // path, but possible if update threw rather than the create),
          // clean it up.
          if (createdMeetingId) {
            await deleteMeeting(createdMeetingId).catch(() => {});
          }
          result.zoom_errors++;
          result.errors.push(
            `Zoom (${scheduledAtISO}): ${zoomErr instanceof Error ? zoomErr.message.slice(0, 120) : "failed"}`,
          );
        }
      }
    }
  }

  return result;
}

/**
 * Generate slots for every active teacher. Useful as a cron job.
 */
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
