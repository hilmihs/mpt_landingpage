import { sql } from "@/lib/db";
import type { AnalyticsEventPayload } from "@/types";

export const FUNNEL_EVENTS = {
  LANDING_VIEW: "landing_view",
  CONSENT_ACCEPTED: "consent_accepted",
  RECORDING_STARTED: "recording_started",
  SUBMISSION_CREATED: "submission_created",
  RAPOT_VIEWED: "rapot_viewed",
  GATE1_SHOWN: "gate1_shown",
  GATE1_YES: "gate1_yes",
  GATE1_NO: "gate1_no",
  BOOKING_CALENDAR_VIEWED: "booking_calendar_viewed",
  BOOKING_CREATED: "booking_created",
  BOOKING_CANCELLED: "booking_cancelled",
  ATTENDED_ASSESSMENT: "attended_assessment",
  GATE2_SHOWN: "gate2_shown",
  GATE2_YES: "gate2_yes",
  GATE2_NO: "gate2_no",
  TAHSIN_INVITED: "tahsin_invited",
  TAHSIN_ENROLLED: "tahsin_enrolled",
  TAHSIN_COMPLETED: "tahsin_completed",
  GATE3_SHOWN: "gate3_shown",
  GATE3_YES: "gate3_yes",
  GATE3_NO: "gate3_no",
  HITS_CTA_CLICKED: "hits_cta_clicked",
} as const;

export async function trackEvent(payload: AnalyticsEventPayload): Promise<void> {
  try {
    await sql`
      INSERT INTO analytics_events (event_name, submission_id, session_id, metadata)
      VALUES (
        ${payload.event_name},
        ${payload.submission_id ?? null},
        ${payload.session_id ?? null},
        ${sql.json((payload.metadata ?? {}) as Parameters<typeof sql.json>[0])}
      )
    `;
  } catch (err) {
    // Analytics must never break the user flow.
    console.error("[analytics] track failed:", (err as Error).message);
  }
}
