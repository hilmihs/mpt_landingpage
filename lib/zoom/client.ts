/**
 * Zoom Server-to-Server OAuth client.
 *
 * Requires a Server-to-Server OAuth app in Zoom Marketplace with these scopes:
 *   - meeting:write:meeting:admin
 *   - meeting:delete:meeting:admin
 *   - user:read:user:admin
 *
 * Env vars (set in Vercel/host):
 *   ZOOM_ACCOUNT_ID
 *   ZOOM_CLIENT_ID
 *   ZOOM_CLIENT_SECRET
 *   ZOOM_HOST_EMAIL  (email of the Zoom user that owns generated meetings)
 */

const ZOOM_OAUTH_URL = "https://zoom.us/oauth/token";
const ZOOM_API_BASE = "https://api.zoom.us/v2";

interface TokenCache {
  token: string;
  expires_at: number;
}

// In-memory cache. Per Lambda invocation in dev; per Vercel function instance
// in prod. Acceptable since tokens are valid for 1h.
let cached: TokenCache | null = null;

export function isZoomConfigured(): boolean {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID &&
      process.env.ZOOM_CLIENT_ID &&
      process.env.ZOOM_CLIENT_SECRET &&
      process.env.ZOOM_HOST_EMAIL,
  );
}

async function getAccessToken(): Promise<string> {
  if (cached && cached.expires_at > Date.now() + 60_000) {
    return cached.token;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("ZOOM_* env vars not configured");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(
    `${ZOOM_OAUTH_URL}?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom OAuth failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  cached = {
    token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

export interface CreateMeetingInput {
  topic: string;
  start_time: string; // ISO 8601, with timezone
  duration_min: number;
  agenda?: string;
  alternative_hosts?: string[]; // emails — teacher's email_zoom
}

export interface CreateMeetingResult {
  meeting_id: string;
  join_url: string;
  password: string;
  host_email: string;
}

export async function createMeeting(
  input: CreateMeetingInput,
): Promise<CreateMeetingResult> {
  const token = await getAccessToken();
  const hostEmail = process.env.ZOOM_HOST_EMAIL!;

  const altHosts = (input.alternative_hosts ?? [])
    .filter((e) => e && e !== hostEmail)
    .join(",");

  const body = {
    topic: input.topic,
    type: 2, // scheduled meeting
    start_time: input.start_time,
    duration: input.duration_min,
    timezone: "Asia/Jakarta",
    agenda: input.agenda?.slice(0, 2000) ?? "",
    settings: {
      host_video: true,
      participant_video: false,
      join_before_host: false,
      mute_upon_entry: true,
      waiting_room: false,
      auto_recording: "none",
      approval_type: 2, // no registration
      alternative_hosts: altHosts,
      registrants_email_notification: false,
    },
  };

  const res = await fetch(
    `${ZOOM_API_BASE}/users/${encodeURIComponent(hostEmail)}/meetings`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(
      `Zoom createMeeting failed (${res.status}): ${errBody.slice(0, 300)}`,
    );
  }

  const m = (await res.json()) as {
    id: number;
    join_url: string;
    password: string;
    host_email: string;
  };

  return {
    meeting_id: String(m.id),
    join_url: m.join_url,
    password: m.password,
    host_email: m.host_email,
  };
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(
    `${ZOOM_API_BASE}/meetings/${encodeURIComponent(meetingId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  // 404 = already gone, that's fine. 200/204 = success.
  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(
      `Zoom deleteMeeting failed (${res.status}): ${body.slice(0, 200)}`,
    );
  }
}

export interface ZoomParticipant {
  id: string;
  user_id?: string;
  name: string;
  user_email?: string;
  join_time: string;
  leave_time?: string;
  duration?: number;
}

export async function listMeetingParticipants(
  meetingId: string,
): Promise<ZoomParticipant[]> {
  const token = await getAccessToken();
  const participants: ZoomParticipant[] = [];
  let nextPageToken: string | undefined;

  do {
    const url = new URL(
      `${ZOOM_API_BASE}/past_meetings/${encodeURIComponent(meetingId)}/participants`,
    );
    url.searchParams.set("page_size", "300");
    if (nextPageToken) url.searchParams.set("next_page_token", nextPageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 404) return participants; // meeting hasn't ended yet
      const body = await res.text();
      throw new Error(
        `Zoom participants failed (${res.status}): ${body.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as {
      participants: ZoomParticipant[];
      next_page_token?: string;
    };
    participants.push(...(data.participants ?? []));
    nextPageToken = data.next_page_token || undefined;
  } while (nextPageToken);

  return participants;
}
