import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { mockMLPredict } from "@/lib/mock-ml";
import { computeScore } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bungkus nilai untuk kolom jsonb. Tipe JSONValue milik postgres.js menolak
 * interface dengan properti opsional (mis. ErrorItem.note), padahal di runtime
 * nilainya JSON valid — jadi cast-nya dipusatkan di sini.
 */
function jsonb(value: unknown) {
  return sql.json(value as Parameters<typeof sql.json>[0]);
}

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

  let sub: { id: string; rapot_slug: string | null; status: string } | null;
  try {
    const rows = await sql`
      SELECT id, rapot_slug, status
      FROM submissions
      WHERE rapot_slug = ${slug}
      LIMIT 1
    `;
    sub = (rows[0] as typeof sub) ?? null;
  } catch {
    sub = null;
  }

  if (!sub) {
    return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
  }

  if (sub.status === "completed") {
    const existing = await sql`
      SELECT slug FROM rapot WHERE slug = ${slug} LIMIT 1
    `;
    if (existing[0]) {
      return NextResponse.json({ ok: true, already: true });
    }
  }

  const result = mockMLPredict(
    { submission_id: sub.id, audio_url: "" },
    { seed: `${Date.now()}-${Math.random()}` },
  );
  // Pintasan demo ini masih menargetkan tabel `rapot` dengan instrumen lama
  // (empat indikator, skala 1-5). Penilaian mesin yang sebenarnya sudah pindah
  // ke `ai_evaluations` lewat /api/worker — lihat 0010_ai_evaluation.sql.
  // Pemetaan nama di bawah eksplisit supaya jelas mana yang lama, mana baru.
  const score = computeScore({
    errors_harakat: result.errors_harakat,
    errors_huruf: result.errors_ketepatan_huruf,
    errors_panjang_pendek: result.errors_panjang_pendek,
    errors_syaddah: result.errors_tasydid,
  });

  try {
    await sql`
      INSERT INTO rapot (
        slug, submission_id, skor, status_label,
        errors_harakat, errors_huruf, errors_panjang_pendek, errors_syaddah,
        total_errors_major, total_errors_minor, weighted_score,
        ml_model_version, ml_confidence, ml_raw_output
      ) VALUES (
        ${slug},
        ${sub.id},
        ${score.skor},
        ${score.status_label},
        ${jsonb(result.errors_harakat)},
        ${jsonb(result.errors_ketepatan_huruf)},
        ${jsonb(result.errors_panjang_pendek)},
        ${jsonb(result.errors_tasydid)},
        ${score.total_errors_major},
        ${score.total_errors_minor},
        ${score.weighted_score},
        ${result.ml_model_version},
        ${result.ml_confidence},
        ${result.ml_raw_output == null ? null : jsonb(result.ml_raw_output)}
      )
      ON CONFLICT (slug) DO UPDATE SET
        submission_id = EXCLUDED.submission_id,
        skor = EXCLUDED.skor,
        status_label = EXCLUDED.status_label,
        errors_harakat = EXCLUDED.errors_harakat,
        errors_huruf = EXCLUDED.errors_huruf,
        errors_panjang_pendek = EXCLUDED.errors_panjang_pendek,
        errors_syaddah = EXCLUDED.errors_syaddah,
        total_errors_major = EXCLUDED.total_errors_major,
        total_errors_minor = EXCLUDED.total_errors_minor,
        weighted_score = EXCLUDED.weighted_score,
        ml_model_version = EXCLUDED.ml_model_version,
        ml_confidence = EXCLUDED.ml_confidence,
        ml_raw_output = EXCLUDED.ml_raw_output
    `;
  } catch (err) {
    return NextResponse.json(
      { error: `rapot_upsert_failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  try {
    await sql`
      UPDATE submissions SET
        status = ${"completed"},
        processed_at = ${new Date()},
        error_message = ${null}
      WHERE id = ${sub.id}
    `;
  } catch (err) {
    return NextResponse.json(
      { error: `submission_update_failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
