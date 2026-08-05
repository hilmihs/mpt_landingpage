import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { notifyAssignment } from "@/lib/dispatch";
import {
  assignSchema,
  clientIp,
  fetchSubmission,
  isUniqueViolation,
  jsonError,
  resolveTarget,
  sudahDinilai,
} from "@/lib/admin/assign";

/**
 * Tugaskan rekaman yang belum punya pengajar sama sekali.
 *
 * Rekaman seperti ini lahir saat dispatchSubmission gagal total — tidak ada
 * pengajar segender yang aktif DAN SUPERADMIN_WA kosong. Sebelum route ini ada,
 * rekaman itu tidak punya baris assignments dan hilang tanpa jejak dari semua
 * permukaan; satu-satunya cara memulihkannya adalah lewat SQL manual.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Baris pertama, tidak bisa ditawar: RLS sudah dibuang, jadi tidak ada jaring
  // pengaman lain di bawah ini (lib/db.ts:9-12).
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError("unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("validation_failed", 400, { details: parsed.error.issues });
  }
  const input = parsed.data;

  const sub = await fetchSubmission(input.submission_id);
  if (!sub) return jsonError("submission_not_found", 404);

  if (await sudahDinilai(sub.id)) {
    return jsonError("already_evaluated", 409, {
      message: "Rekaman ini sudah dinilai; menugaskan ulang akan menimpa nilainya.",
    });
  }

  const resolved = await resolveTarget(input, sub);
  if ("error" in resolved) return resolved.error;
  const { target } = resolved;

  // INSERT bersyarat dalam satu pernyataan: dua admin yang menekan bersamaan
  // tidak bisa menghasilkan dua penugasan aktif, tanpa perlu transaksi.
  let assignmentId: string;
  try {
    const rows = await sql<{ id: string }[]>`
      INSERT INTO assignments (submission_id, teacher_id, teacher_nama, teacher_wa)
      SELECT ${sub.id}, ${target.teacherId}, ${target.nama}, ${target.nomorWa}
      WHERE NOT EXISTS (
        SELECT 1 FROM assignments
        WHERE submission_id = ${sub.id} AND status NOT IN ('completed','failed')
      )
      RETURNING id
    `;
    const row = rows[0];
    if (!row) {
      return jsonError("already_assigned", 409, {
        message: "Rekaman ini sudah punya penugasan aktif. Pakai Alihkan, bukan Tugaskan.",
      });
    }
    assignmentId = row.id;
  } catch (err) {
    // Indeks unik parsial adalah invarian sesungguhnya; kalau ia yang menolak,
    // artinya sama dengan cabang di atas — bukan kesalahan server.
    if (isUniqueViolation(err)) {
      return jsonError("already_assigned", 409);
    }
    const message = (err as Error).message;
    console.error("[admin.assign] gagal:", message);
    return jsonError("db_error", 500, { message });
  }

  try {
    await sql`
      INSERT INTO audit_logs
        (actor_user_id, actor_role, action, entity_type, entity_id,
         before_state, after_state, ip_address, user_agent)
      VALUES (
        ${admin.authUserId}, ${"admin"}, ${"assignment.assign"},
        ${"submission"}, ${sub.id},
        ${null},
        ${sql.json({
          assignment_id: assignmentId,
          teacher_id: target.teacherId,
          teacher_nama: target.nama,
          mode: input.mode,
          alasan: input.alasan ?? null,
        })},
        ${clientIp(req)},
        ${req.headers.get("user-agent")}
      )
    `;
  } catch (err) {
    // Beda dengan reassign: di sini penugasannya sudah terlanjur dibuat di luar
    // transaksi, jadi menggagalkan respons hanya membuat admin menekan tombol
    // lagi dan menabrak already_assigned. Cukup dicatat.
    console.error("[admin.assign] audit gagal:", (err as Error).message);
  }

  const notify = await notifyAssignment({
    assignmentId,
    target,
    pesertaNama: sub.nama,
    jenisKelamin: sub.jenis_kelamin,
    durasiDetik: sub.durasi,
  });

  return NextResponse.json({
    ok: true,
    action: "assigned",
    assignment_id: assignmentId,
    teacher: {
      id: target.teacherId,
      nama: target.nama,
      nomor_wa: target.nomorWa,
      is_fallback: target.isFallback,
    },
    wa_sent: notify.waSent,
    wa_error: notify.error ?? null,
  });
}
