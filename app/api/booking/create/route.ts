import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
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

  // Look up submission via rapot slug
  const rapotRows = await sql<
    { submission_id: string; jenis_kelamin: string | null }[]
  >`
    SELECT r.submission_id, s.jenis_kelamin
    FROM rapot r
    LEFT JOIN submissions s ON s.id = r.submission_id
    WHERE r.slug = ${rapot_slug}
    LIMIT 1
  `;

  const rapot = rapotRows[0] ?? null;

  if (!rapot) {
    return NextResponse.json({ error: "rapot_not_found" }, { status: 404 });
  }

  const submission_id = rapot.submission_id;
  const userGender = rapot.jenis_kelamin;
  if (!userGender) {
    return NextResponse.json({ error: "missing_gender" }, { status: 400 });
  }

  // Atomic booking via RPC — holds row lock on slot, checks capacity,
  // enforces one active booking per submission per slot kind.
  let rpcResult: {
    ok: boolean;
    reason?: string;
    booking_id?: string;
    reused?: boolean;
    existing_booking_id?: string;
  };

  try {
    const [row] = await sql<{ result: typeof rpcResult }[]>`
      SELECT create_booking(
        ${slot_id},
        ${submission_id},
        ${userGender},
        ${notes_from_user ?? null}
      ) AS result
    `;
    rpcResult = row!.result;
  } catch (err) {
    return NextResponse.json(
      { error: "db_error", message: (err as Error).message },
      { status: 500 },
    );
  }

  if (!rpcResult.ok) {
    const statusMap: Record<string, { status: number; message: string }> = {
      slot_not_found: { status: 404, message: "Slot tidak ditemukan" },
      slot_unavailable: { status: 409, message: "Slot tidak tersedia" },
      gender_mismatch: { status: 409, message: "Slot tidak cocok dengan gender peserta" },
      slot_full: { status: 409, message: "Slot sudah penuh, silakan pilih waktu lain" },
      already_has_booking: { status: 409, message: "Anda sudah memiliki booking aktif di slot lain" },
    };
    const mapped = statusMap[rpcResult.reason ?? ""] ?? { status: 400, message: rpcResult.reason };
    return NextResponse.json(
      { error: rpcResult.reason, message: mapped.message },
      { status: mapped.status },
    );
  }

  await trackEvent({
    event_name: FUNNEL_EVENTS.BOOKING_CREATED,
    submission_id,
    metadata: { slot_id, rapot_slug },
  });

  return NextResponse.json({
    booking_id: rpcResult.booking_id,
    reused: rpcResult.reused ?? false,
  });
}
