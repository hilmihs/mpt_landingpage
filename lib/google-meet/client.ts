import { google, type calendar_v3 } from "googleapis";
import { getAuthClient, isMeetConfigured } from "./auth";

export { isMeetConfigured };

export interface CreateMeetingInput {
  teacher_email: string;
  topic: string;
  start_time: string; // ISO 8601
  duration_min: number;
  description?: string;
}

export interface CreateMeetingResult {
  calendar_event_id: string;
  join_url: string;
  conference_id: string;
  host_email: string;
}

export async function createMeeting(
  input: CreateMeetingInput,
): Promise<CreateMeetingResult> {
  const auth = getAuthClient(input.teacher_email);
  const cal = google.calendar({ version: "v3", auth });

  const startDate = new Date(input.start_time);
  const endDate = new Date(startDate.getTime() + input.duration_min * 60_000);

  const event: calendar_v3.Schema$Event = {
    summary: input.topic,
    description: input.description ?? "",
    start: { dateTime: startDate.toISOString(), timeZone: "Asia/Jakarta" },
    end: { dateTime: endDate.toISOString(), timeZone: "Asia/Jakarta" },
    conferenceData: {
      createRequest: {
        requestId: `mpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    guestsCanModify: false,
    guestsCanInviteOthers: false,
  };

  const res = await cal.events.insert({
    calendarId: "primary",
    requestBody: event,
    conferenceDataVersion: 1,
  });

  let meetLink = res.data.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === "video",
  )?.uri;
  let conferenceId = res.data.conferenceData?.conferenceId;

  // conferenceData can be async — poll until populated (up to 10s)
  if (!meetLink || !conferenceId) {
    const eventId = res.data.id!;
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const refetch = await cal.events.get({
        calendarId: "primary",
        eventId,
        fields: "conferenceData",
      });
      meetLink = refetch.data.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === "video",
      )?.uri;
      conferenceId = refetch.data.conferenceData?.conferenceId;
      if (meetLink && conferenceId) break;
    }
  }

  if (!meetLink || !conferenceId) {
    throw new Error(
      `Google Meet link not populated after retries for event ${res.data.id}`,
    );
  }

  return {
    calendar_event_id: res.data.id!,
    join_url: meetLink,
    conference_id: conferenceId,
    host_email: input.teacher_email,
  };
}

export async function deleteMeeting(
  teacherEmail: string,
  calendarEventId: string,
): Promise<void> {
  const auth = getAuthClient(teacherEmail);
  const cal = google.calendar({ version: "v3", auth });
  try {
    await cal.events.delete({
      calendarId: "primary",
      eventId: calendarEventId,
    });
  } catch (err: unknown) {
    const status = (err as { code?: number }).code;
    if (status === 404 || status === 410) return;
    throw err;
  }
}

export interface MeetParticipant {
  display_name: string;
  email: string | null;
  join_time: string | null;
  leave_time: string | null;
  duration_seconds: number | null;
}

/**
 * Fetch participants from a Google Meet conference record.
 *
 * Note: external peserta (not in the org's Workspace) will NOT have emails,
 * only display names. Attendance matching falls back to name-only Jaccard.
 */
export async function listMeetingParticipants(
  conferenceId: string,
  teacherEmail: string,
): Promise<MeetParticipant[]> {
  const auth = getAuthClient(teacherEmail);
  const meet = google.meet({ version: "v2", auth });

  // Find conference records for this conference ID.
  // A single space can have multiple records (if the meeting was restarted).
  const { data: records } = await meet.conferenceRecords.list({
    filter: `space.meeting_code="${conferenceId}"`,
  });

  if (!records.conferenceRecords?.length) return [];

  const participants: MeetParticipant[] = [];

  for (const record of records.conferenceRecords) {
    const recordName = record.name;
    if (!recordName) continue;

    let pageToken: string | undefined;
    do {
      const { data } = await meet.conferenceRecords.participants.list({
        parent: recordName,
        pageSize: 100,
        pageToken,
      });

      for (const p of data.participants ?? []) {
        const signedin = p.signedinUser;
        const anon = p.anonymousUser;
        const displayName =
          signedin?.displayName ?? anon?.displayName ?? "Unknown";

        // Collect session data for join/leave times
        let earliestJoin: string | null = null;
        let latestLeave: string | null = null;
        let totalDuration = 0;

        if (p.name) {
          try {
            const { data: sessions } =
              await meet.conferenceRecords.participants.participantSessions.list(
                { parent: p.name, pageSize: 100 },
              );
            for (const s of sessions.participantSessions ?? []) {
              if (s.startTime) {
                if (!earliestJoin || s.startTime < earliestJoin)
                  earliestJoin = s.startTime;
              }
              if (s.endTime) {
                if (!latestLeave || s.endTime > latestLeave)
                  latestLeave = s.endTime;
              }
              if (s.startTime && s.endTime) {
                totalDuration +=
                  (new Date(s.endTime).getTime() -
                    new Date(s.startTime).getTime()) /
                  1000;
              }
            }
          } catch {
            // Session data not available — continue with what we have
          }
        }

        participants.push({
          display_name: displayName,
          email: null, // External peserta don't expose emails
          join_time: earliestJoin,
          leave_time: latestLeave,
          duration_seconds: totalDuration > 0 ? Math.round(totalDuration) : null,
        });
      }

      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);
  }

  return participants;
}
