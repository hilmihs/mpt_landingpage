import { NextResponse } from "next/server";
import { supabaseService, STORAGE_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RETENTION_DAYS = 7;
const BATCH_SIZE = 100;

function authorized(req: Request): boolean {
  const secret = process.env.CLEANUP_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const x = req.headers.get("x-cleanup-secret");
  if (x === secret) return true;
  return false;
}

async function handleRun(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const sb = supabaseService();

  // Find submissions older than cutoff with non-empty audio_path
  const { data: rows, error } = await sb
    .from("submissions")
    .select("id, audio_path")
    .lt("created_at", cutoff)
    .not("audio_path", "is", null)
    .neq("audio_path", "")
    .limit(BATCH_SIZE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ deleted: 0, message: "Nothing to clean" });
  }

  const paths = rows.map((r) => r.audio_path).filter((p): p is string => !!p);
  const { error: rmErr } = await sb.storage.from(STORAGE_BUCKET).remove(paths);
  if (rmErr) {
    return NextResponse.json({ error: rmErr.message }, { status: 500 });
  }

  // Mark audio_path empty so we don't re-attempt (keep rapot rows intact)
  await sb
    .from("submissions")
    .update({ audio_path: "" })
    .in(
      "id",
      rows.map((r) => r.id),
    );

  return NextResponse.json({ deleted: paths.length, paths });
}

export async function GET(req: Request) {
  return handleRun(req);
}

export async function POST(req: Request) {
  return handleRun(req);
}
