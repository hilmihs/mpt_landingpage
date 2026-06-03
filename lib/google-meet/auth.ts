import { JWT } from "google-auth-library";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/meetings.space.readonly",
];

let cachedKey: Record<string, unknown> | null = null;

function getServiceAccountKey(): Record<string, unknown> {
  if (cachedKey) return cachedKey;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");
  cachedKey = JSON.parse(raw) as Record<string, unknown>;
  return cachedKey;
}

export function isMeetConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
}

export function getAuthClient(impersonateEmail: string): JWT {
  const key = getServiceAccountKey();
  return new JWT({
    email: key.client_email as string,
    key: key.private_key as string,
    scopes: SCOPES,
    subject: impersonateEmail,
  });
}
