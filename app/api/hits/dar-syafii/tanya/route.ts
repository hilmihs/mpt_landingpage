import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { sql } from "@/lib/db";
import { getClientIp, hitsTanyaRatelimit } from "@/lib/redis";
import { normalizeWaNumber } from "@/lib/whatsapp";
import { DAR_SYAFII, tanyaPath, tanyaSchema } from "@/lib/hits-dar-syafii";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pertanyaan calon peserta HITS Darsyafii — pengganti "tanya lewat WA admin".
 *
 * Penanya langsung mendapat tautan jawabannya. WhatsApp baru dikirim saat
 * admin menjawab (app/api/admin/hits-dar-syafii/pertanyaan), bukan di sini:
 * formulir publik yang langsung mengirim WA ke nomor apa pun yang diketik
 * bisa dipakai orang untuk mengirim pesan atas nama kita.
 */
export async function POST(req: NextRequest) {
  try {
    const rl = await hitsTanyaRatelimit().limit(getClientIp(req));
    if (!rl.success) {
      return NextResponse.json(
        { error: "rate_limited", message: "Terlalu banyak pertanyaan terkirim. Coba lagi beberapa menit lagi." },
        { status: 429 },
      );
    }
  } catch (err) {
    // fail-open, sama dengan pendaftaran: Redis mati jangan menutup formulir.
    console.error("[hits-tanya] ratelimit error", err);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "validation_failed", message: "Data tidak terbaca." }, { status: 400 });
  }

  const parsed = tanyaSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    return NextResponse.json(
      { error: "validation_failed", message: "Ada isian yang perlu diperbaiki.", fields },
      { status: 400 },
    );
  }

  const nomorWa = normalizeWaNumber(parsed.data.nomor_wa);
  if (!nomorWa) {
    return NextResponse.json(
      {
        error: "validation_failed",
        message: "Nomor WhatsApp tidak dikenali.",
        fields: { nomor_wa: "Nomor WA belum benar, cth. 081234567890" },
      },
      { status: 400 },
    );
  }

  const slug = nanoid(12);
  try {
    await sql`
      INSERT INTO hits_pertanyaan (slug, program, angkatan, nama, nomor_wa, pertanyaan)
      VALUES (${slug}, ${DAR_SYAFII.program}, ${DAR_SYAFII.angkatan},
              ${parsed.data.nama}, ${nomorWa}, ${parsed.data.pertanyaan})
    `;
  } catch (err) {
    console.error("[hits-tanya] insert error", err);
    return NextResponse.json(
      { error: "db_failed", message: "Pertanyaan gagal disimpan. Coba kirim lagi." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, slug, path: tanyaPath(slug) });
}
