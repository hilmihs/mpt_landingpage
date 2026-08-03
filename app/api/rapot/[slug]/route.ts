import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let data: Record<string, unknown> | null;
  try {
    // Kolom numeric di-cast ke float8 supaya driver mengembalikan number,
    // bukan string — bentuk JSON-nya harus sama seperti sebelumnya.
    const rows = await sql`
      SELECT
        slug, submission_id, created_at, skor, status_label,
        errors_harakat, errors_huruf, errors_panjang_pendek, errors_syaddah,
        total_errors_major, total_errors_minor,
        weighted_score::float8 AS weighted_score,
        ml_model_version,
        ml_confidence::float8 AS ml_confidence,
        ml_raw_output, ai_narrative, ai_narrative_model
      FROM rapot
      WHERE slug = ${slug}
      LIMIT 1
    `;
    data = rows[0] ?? null;
  } catch {
    return NextResponse.json({ error: "db_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
