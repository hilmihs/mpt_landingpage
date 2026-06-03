/**
 * Fuzzy match Google Meet participants to peserta bookings.
 *
 * Strategy (in priority order):
 *   1. Exact email match (highest confidence: 1.0) — only works for org users
 *   2. Normalized name token overlap (Jaccard) — primary for external peserta
 *
 * Indonesian names often have honorifics ("Ust.", "Bapak", "Ibu"), and Meet
 * users sometimes append affiliation ("Ahmad — Jakarta"). We strip those.
 *
 * NOTE: external peserta (not in the org's Workspace) will NOT have emails
 * from the Meet API, so almost all matches rely on name Jaccard.
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
    .replace(/[—–\-—|].+$/, "")
    .replace(/\([^)]*\)/g, "")
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
  key: string;
  submission_id: string;
  nama: string;
}

export interface MeetParticipantInput {
  display_name: string;
  email: string | null;
  join_time: string | null;
  leave_time: string | null;
  duration_seconds: number | null;
}

export interface MatchResult {
  key: string;
  submission_id: string;
  confidence: number;
  reasoning: string;
  participant: MeetParticipantInput;
}

export function matchParticipants(
  participants: MeetParticipantInput[],
  candidates: Candidate[],
  peserta_emails: Map<string, string> = new Map(),
): { matched: MatchResult[]; unmatched: Candidate[] } {
  const matched: MatchResult[] = [];
  const claimedKeys = new Set<string>();

  type Pair = {
    p: MeetParticipantInput;
    c: Candidate;
    confidence: number;
    reasoning: string;
  };

  const pairs: Pair[] = [];

  for (const p of participants) {
    const pTokens = new Set(normalizeName(p.display_name));

    for (const c of candidates) {
      const candidateEmail = peserta_emails.get(c.key)?.toLowerCase();
      if (
        candidateEmail &&
        p.email &&
        p.email.toLowerCase() === candidateEmail
      ) {
        pairs.push({
          p,
          c,
          confidence: 1.0,
          reasoning: `email match: ${p.email}`,
        });
        continue;
      }

      const cTokens = new Set(normalizeName(c.nama));
      const conf = jaccard(pTokens, cTokens);
      if (conf > 0) {
        pairs.push({
          p,
          c,
          confidence: conf,
          reasoning: `name jaccard ${conf.toFixed(2)} ("${p.display_name}" ↔ "${c.nama}")`,
        });
      }
    }
  }

  pairs.sort((a, b) => b.confidence - a.confidence);

  const claimedParticipants = new Set<string>();
  const fallbackIndex = new Map<MeetParticipantInput, number>();
  let seenIdx = 0;

  for (const pair of pairs) {
    const pKey =
      pair.p.email ??
      (() => {
        let idx = fallbackIndex.get(pair.p);
        if (idx === undefined) {
          idx = seenIdx++;
          fallbackIndex.set(pair.p, idx);
        }
        return `${pair.p.display_name}|${pair.p.join_time ?? ""}|${idx}`;
      })();

    if (claimedKeys.has(pair.c.key)) continue;
    if (claimedParticipants.has(pKey)) continue;
    claimedKeys.add(pair.c.key);
    claimedParticipants.add(pKey);
    matched.push({
      key: pair.c.key,
      submission_id: pair.c.submission_id,
      confidence: pair.confidence,
      reasoning: pair.reasoning,
      participant: pair.p,
    });
  }

  const unmatched = candidates.filter((c) => !claimedKeys.has(c.key));
  return { matched, unmatched };
}

export const CONFIDENCE_THRESHOLD = 0.8;
