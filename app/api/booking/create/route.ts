import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase";
import { trackEvent, FUNNEL_EVENTS } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  rapot_slug: z.string().min(6).max(64),
  slot_id: z.string().uuid(),
  notes_from_user: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { rapot_slug, slot_id, notes_from_user } = parsed.data;
  const sb = supabaseService();

  // Look up submission via rapot slug
  const { data: rapotRaw } = await sb
    .from("rapot")
    .select("submission_id, submissions(jenis_kelamin)")
    .eq("slug", rapot_slug)
    .maybeSingle();

  const rapot = rapotRaw as
    | { submission_id: string; submissions: { jenis_kelamin: string } | null }
    | null;

  if (!rapot) {
    return NextResponse.json({ error: "rapot_not_found" }, { status: 404 });
  }

  const submission_id = rapot.submission_id;
  const userGender = rapot.submissions?.jenis_kelamin;

  // Validate slot exists, has capacity, and matches gender
  const { data: slot, error: slotErr } = await sb
    .from("slots")
    .select("id, kind, scheduled_at, gender_target, capacity, reserved_count, status")
    .eq("id", slot_id)
    .maybeSingle();

  if (slotErr || !slot) {
    return NextResponse.json({ error: "slot_not_found" }, { status: 404 });
  }
  if (slot.status !== "scheduled") {
    return NextResponse.json(
      { error: "slot_unavailable", message: "Slot tidak tersedia" },
      { status: 409 },
    );
  }
  if (slot.gender_target !== userGender) {
    return NextResponse.json(
      { error: "gender_mismatch", message: "Slot tidak cocok dengan gender peserta" },
      { status: 409 },
    );
  }
  if (slot.reserved_count >= slot.capacity) {
    return NextResponse.json(
      { error: "slot_full", message: "Slot sudah penuh, silakan pilih waktu lain" },
      { status: 409 },
    );
  }

  // Check existing booking (idempotent for same submission + slot)
  const { data: existing } = await sb
    .from("bookings")
    .select("id, status")
    .eq("submission_id", submission_id)
    .eq("slot_id", slot_id)
    .maybeSingle();

  if (existing && existing.status !== "cancelled") {
    return NextResponse.json({ booking_id: existing.id, reused: true });
  }

  const { data: booking, error: insertErr } = await sb
    .from("bookings")
    .insert({
      slot_id,
      submission_id,
      status: "reserved",
      notes_from_user: notes_from_user ?? null,
    })
    .select("id")
    .single();

  if (insertErr || !booking) {
    return NextResponse.json(
      { error: "db_error", message: insertErr?.message ?? "insert failed" },
      { status: 500 },
    );
  }

  await trackEvent({
    event_name: FUNNEL_EVENTS.BOOKING_CREATED,
    submission_id,
    metadata: { slot_id, kind: slot.kind, rapot_slug },
  });

  return NextResponse.json({ booking_id: booking.id, reused: false });
}
