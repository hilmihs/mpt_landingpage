import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import { mockMLPredict } from "@/lib/mock-ml";
import { computeScore } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bypassAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_BYPASS === "1"
  );
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!bypassAllowed()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { slug } = await ctx.params;
  const sb = supabaseService();

  const { data: sub, error: subErr } = await sb
    .from("submissions")
    .select("id, rapot_slug, status")
    .eq("rapot_slug", slug)
    .single();

  if (subErr || !sub) {
    return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
  }

  if (sub.status === "completed") {
    const { data: existing } = await sb
      .from("rapot")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: true, already: true });
    }
  }

  const result = mockMLPredict(
    { submission_id: sub.id, audio_url: "" },
    { seed: `${Date.now()}-${Math.random()}` },
  );
  const score = computeScore(result);

  const { error: rapotErr } = await sb.from("rapot").upsert(
    {
      slug,
      submission_id: sub.id,
      skor: score.skor,
      status_label: score.status_label,
      errors_harakat: result.errors_harakat,
      errors_huruf: result.errors_huruf,
      errors_panjang_pendek: result.errors_panjang_pendek,
      errors_syaddah: result.errors_syaddah,
      total_errors_major: score.total_errors_major,
      total_errors_minor: score.total_errors_minor,
      weighted_score: score.weighted_score,
      ml_model_version: result.ml_model_version,
      ml_confidence: result.ml_confidence,
      ml_raw_output: result.ml_raw_output ?? null,
    },
    { onConflict: "slug" },
  );
  if (rapotErr) {
    return NextResponse.json(
      { error: `rapot_upsert_failed: ${rapotErr.message}` },
      { status: 500 },
    );
  }

  const { error: updErr } = await sb
    .from("submissions")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", sub.id);
  if (updErr) {
    return NextResponse.json(
      { error: `submission_update_failed: ${updErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
