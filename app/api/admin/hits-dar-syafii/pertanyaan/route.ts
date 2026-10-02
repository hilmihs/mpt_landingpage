import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { clientIp, jsonError } from "@/lib/admin/assign";
import { siteUrl } from "@/lib/site-url";
import { sendWhatsApp, tplHitsPertanyaanDijawab } from "@/lib/whatsapp";
import { DAR_SYAFII, jawabSchema, tanyaPath } from "@/lib/hits-dar-syafii";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  jawabSchema.extend({ action: z.literal("jawab") }),
  z.object({ action: z.literal("kirim_wa"), id: z.uuid() }),
]);

interface PertanyaanRow {
  id: string;
  slug: string;
  nama: string;
  nomor_wa: string;
  jawaban: string | null;
  tampil_faq: boolean;
  wa_sent_at: Date | null;
}

/**
 * Admin menjawab pertanyaan calon peserta HITS Darsyafii.
 *
 *  - `jawab`    simpan/ubah jawaban dan tanda FAQ. WhatsApp dikirim hanya
 *               kalau penanya belum pernah dikabari — memperbaiki jawaban
 *               tidak mengirim pesan kedua, karena tautannya sama.
 *  - `kirim_wa` kirim ulang kabar WhatsApp (mis. setelah kirimi.id gagal).
 */
export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError("unauthorized", 401);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("invalid_json", 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("validation_failed", 400, {
      message: parsed.error.issues[0]?.message ?? "Isian belum benar.",
    });
  }
  const input = parsed.data;

  let row: PertanyaanRow | null;
  let kirimWa: boolean;

  if (input.action === "jawab") {
    try {
      const hasil = await sql.begin(async (tx) => {
        const before = await tx<PertanyaanRow[]>`
          SELECT id, slug, nama, nomor_wa, jawaban, tampil_faq, wa_sent_at
            FROM hits_pertanyaan
           WHERE id = ${input.id} AND program = ${DAR_SYAFII.program}
           FOR UPDATE
        `;
        const lama = before[0];
        if (!lama) return null;

        const after = await tx<PertanyaanRow[]>`
          UPDATE hits_pertanyaan
             SET jawaban = ${input.jawaban},
                 tampil_faq = ${input.tampil_faq},
                 -- Waktu jawaban pertama; perbaikan tidak menggesernya.
                 dijawab_at = COALESCE(dijawab_at, now()),
                 dijawab_oleh = ${admin.nama}
           WHERE id = ${input.id}
          RETURNING id, slug, nama, nomor_wa, jawaban, tampil_faq, wa_sent_at
        `;

        await tx`
          INSERT INTO audit_logs
            (actor_user_id, actor_role, action, entity_type, entity_id,
             before_state, after_state, ip_address, user_agent)
          VALUES (
            ${admin.authUserId}, ${"admin"}, ${"hits_pertanyaan.jawab"},
            ${"hits_pertanyaan"}, ${input.id},
            ${tx.json({ jawaban: lama.jawaban, tampil_faq: lama.tampil_faq })},
            ${tx.json({ jawaban: input.jawaban, tampil_faq: input.tampil_faq })},
            ${clientIp(req)},
            ${req.headers.get("user-agent")}
          )
        `;
        return after[0]!;
      });
      row = hasil;
    } catch (err) {
      console.error("[admin.hits-pertanyaan] gagal:", (err as Error).message);
      return jsonError("db_error", 500, { message: "Jawaban gagal disimpan. Coba lagi." });
    }
    if (!row) return jsonError("not_found", 404, { message: "Pertanyaan tidak ditemukan." });
    kirimWa = row.wa_sent_at === null;
  } else {
    const rows = await sql<PertanyaanRow[]>`
      SELECT id, slug, nama, nomor_wa, jawaban, tampil_faq, wa_sent_at
        FROM hits_pertanyaan
       WHERE id = ${input.id} AND program = ${DAR_SYAFII.program}
    `;
    row = rows[0] ?? null;
    if (!row) return jsonError("not_found", 404, { message: "Pertanyaan tidak ditemukan." });
    if (row.jawaban === null) {
      return jsonError("belum_dijawab", 409, { message: "Jawab dulu sebelum mengirim kabar WhatsApp." });
    }
    kirimWa = true;
  }

  // Di luar transaksi: kirimi.id bisa sampai 20 detik. Gagal kirim tidak
  // membatalkan jawaban — jawabannya sudah bisa dibaca di tautan.
  let waSent = row.wa_sent_at !== null;
  let waError: string | null = null;
  if (kirimWa) {
    const send = await sendWhatsApp(
      row.nomor_wa,
      tplHitsPertanyaanDijawab({
        penanyaNama: row.nama,
        programNama: DAR_SYAFII.nama,
        jawabanUrl: `${siteUrl()}${tanyaPath(row.slug)}`,
      }),
    );
    if (send.ok) {
      waSent = true;
      await sql`UPDATE hits_pertanyaan SET wa_sent_at = now(), wa_error = NULL WHERE id = ${row.id}`;
    } else {
      waError = send.error ?? "gagal";
      await sql`UPDATE hits_pertanyaan SET wa_error = ${waError} WHERE id = ${row.id}`;
    }
  }

  return NextResponse.json({ ok: true, wa_sent: waSent, wa_error: waError });
}
