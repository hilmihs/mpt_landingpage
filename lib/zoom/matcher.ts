/**
 * Fuzzy match Zoom participants to peserta bookings.
 *
 * Strategy (in priority order):
 *   1. Exact email match (highest confidence: 1.0)
 *   2. Normalized name token overlap (Jaccard) — confidence 0.0-1.0
 *
 * Indonesian names often have honorifics ("Ust.", "Bapak", "Ibu"), and Zoom
 * users sometimes append affiliation ("Ahmad — Jakarta"). We strip those.
 */

const HONORIFICS = new Set([
  "ust",
  "ustadz",
  "ustadzah",
  "ustaz",
  "ustazah",
  "bapak",
  "pak",
  "ibu",
  "bu",
  "mas",
  "mbak",
  "kak",
  "sdr",
  "sdri",
  "saudara",
  "saudari",
  "muhammad",
  "muh",
  "m",
  "muhammadi",
  "h",
  "hj",
  "haji",
  "hajjah",
]);

export function normalizeName(raw: string): string[] {
  return raw
    .toLowerCase()
    // strip parenthetical and dash-separated suffixes
    .replace(/[—–\-—|].+$/, "")
    .replace(/\([^)]*\)/g, "")
    // strip non-letter
    .replace(/[^a-z\s']/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !HONORIFICS.has(t));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

export interface Candidate {
  booking_id: string;
  submission_id: string;
  nama: string;
}

export interface ZoomParticipantInput {
  zoom_participant_id?: string;
  name: string;
  user_email?: string;
  join_time?: string;
  leave_time?: string;
  duration?: number;
}

export interface MatchResult {
  booking_id: string;
  submission_id: string;
  confidence: number;
  reasoning: string;
  zoom_participant: ZoomParticipantInput;
}

/**
 * Greedy 1-to-1 matching. Each booking gets at most one Zoom participant
 * (the highest-confidence one).
 */
export function matchParticipants(
  participants: ZoomParticipantInput[],
  candidates: Candidate[],
  peserta_emails: Map<string, string> = new Map(), // booking_id -> email (if known)
): { matched: MatchResult[]; unmatched_bookings: Candidate[] } {
  const matched: MatchResult[] = [];
  const claimedBookings = new Set<string>();

  type Pair = {
    p: ZoomParticipantInput;
    c: Candidate;
    confidence: number;
    reasoning: string;
  };

  const pairs: Pair[] = [];

  for (const p of participants) {
    // Exclude the host (no email usually, or matches ZOOM_HOST_EMAIL)
    if (
      p.user_email &&
      process.env.ZOOM_HOST_EMAIL &&
      p.user_email.toLowerCase() === process.env.ZOOM_HOST_EMAIL.toLowerCase()
    ) {
      continue;
    }

    const pTokens = new Set(normalizeName(p.name));

    for (const c of candidates) {
      // Email match wins
      const candidateEmail = peserta_emails.get(c.booking_id)?.toLowerCase();
      if (
        candidateEmail &&
        p.user_email &&
        p.user_email.toLowerCase() === candidateEmail
      ) {
        pairs.push({
          p,
          c,
          confidence: 1.0,
          reasoning: `email match: ${p.user_email}`,
        });
        continue;
      }

      // Otherwise, name jaccard
      const cTokens = new Set(normalizeName(c.nama));
      const conf = jaccard(pTokens, cTokens);
      if (conf > 0) {
        pairs.push({
          p,
          c,
          confidence: conf,
          reasoning: `name jaccard ${conf.toFixed(2)} ("${p.name}" ↔ "${c.nama}")`,
        });
      }
    }
  }

  // Sort by confidence desc, greedy assign
  pairs.sort((a, b) => b.confidence - a.confidence);

  const claimedParticipants = new Set<string>();
  for (const pair of pairs) {
    const pKey = pair.p.zoom_participant_id ?? pair.p.name + (pair.p.join_time ?? "");
    if (claimedBookings.has(pair.c.booking_id)) continue;
    if (claimedParticipants.has(pKey)) continue;
    claimedBookings.add(pair.c.booking_id);
    claimedParticipants.add(pKey);
    matched.push({
      booking_id: pair.c.booking_id,
      submission_id: pair.c.submission_id,
      confidence: pair.confidence,
      reasoning: pair.reasoning,
      zoom_participant: pair.p,
    });
  }

  const unmatched_bookings = candidates.filter(
    (c) => !claimedBookings.has(c.booking_id),
  );

  return { matched, unmatched_bookings };
}

/**
 * Confidence threshold for auto-acceptance.
 * Below this, attendance is created with need_review=true and source='ai_match'.
 * At or above, source='zoom_webhook'.
 */
export const CONFIDENCE_THRESHOLD = 0.8;
