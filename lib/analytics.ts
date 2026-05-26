import { supabaseService } from "@/lib/supabase";
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
  TAHSIN_INVITED: "tahsin_invited",
  TAHSIN_ENROLLED: "tahsin_enrolled",
  TAHSIN_COMPLETED: "tahsin_completed",
  HITS_CTA_CLICKED: "hits_cta_clicked",
} as const;

export async function trackEvent(payload: AnalyticsEventPayload): Promise<void> {
  try {
    const sb = supabaseService();
    await sb.from("analytics_events").insert({
      event_name: payload.event_name,
      submission_id: payload.submission_id ?? null,
      session_id: payload.session_id ?? null,
      metadata: payload.metadata ?? {},
    });
  } catch (err) {
    // Analytics must never break the user flow.
    console.error("[analytics] track failed:", (err as Error).message);
  }
}
