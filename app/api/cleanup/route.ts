import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { removeAudio } from "@/lib/storage";

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

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Find submissions older than cutoff with non-empty audio_path
  let rows: { id: string; audio_path: string | null }[];
  try {
    rows = await sql`
      SELECT id, audio_path
      FROM submissions
      WHERE created_at < ${cutoff}
        AND audio_path IS NOT NULL
        AND audio_path <> ${""}
      LIMIT ${BATCH_SIZE}
    `;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ deleted: 0, message: "Nothing to clean" });
  }

  const paths = rows.map((r) => r.audio_path).filter((p): p is string => !!p);
  try {
    await removeAudio(paths);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  // Mark audio_path empty so we don't re-attempt (keep rapot rows intact)
  await sql`
    UPDATE submissions
    SET audio_path = ${""}
    WHERE id = ANY(${rows.map((r) => r.id)}::uuid[])
  `;

  return NextResponse.json({ deleted: paths.length, paths });
}

export async function GET(req: Request) {
  return handleRun(req);
}

export async function POST(req: Request) {
  return handleRun(req);
}
