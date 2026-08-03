import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let data: {
    status: string;
    error_message: string | null;
    rapot_slug: string | null;
  } | null;
  try {
    const rows = await sql`
      SELECT status, error_message, rapot_slug
      FROM submissions
      WHERE rapot_slug = ${slug}
      LIMIT 1
    `;
    data = (rows[0] as typeof data) ?? null;
  } catch {
    return NextResponse.json({ error: "db_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const headers = { "Cache-Control": "no-store" };

  if (data.status === "completed") {
    return NextResponse.json(
      { status: "completed", rapot_url: `/rapot/${slug}` },
      { headers },
    );
  }
  if (data.status === "failed") {
    return NextResponse.json(
      { status: "failed", error_message: data.error_message ?? "Unknown error" },
      { headers },
    );
  }
  return NextResponse.json(
    { status: data.status, progress: data.status === "processing" ? 60 : 20 },
    { headers },
  );
}
