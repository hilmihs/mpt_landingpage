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
} from "@/lib/admin/assign";

/**
 * Pindahkan rekaman yang macet ke pengajar lain.
 *
 * Penugasan lama dipensiunkan jadi status 'failed' — itulah yang membebaskan
 * indeks unik parsial idx_assignments_one_active sehingga baris baru boleh
 * masuk. Nilai 'failed' sudah ada di CHECK sejak migrasi 0008 tapi belum pernah
 * ditulis kode mana pun; route ini penulis pertamanya.
 *
 * Prasyarat yang harus sudah terpasang: jalur penilaian pengajar menolak
 * penugasan berstatus 'failed' (app/api/portal/evaluation/route.ts dan
 * app/portal-mpt-x7/(authed)/nilai/[id]/page.tsx). Tanpa itu, tautan WhatsApp
 * pengajar lama masih bisa dipakai dan kirimannya akan menimpa nilai pengajar
 * baru tanpa jejak.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RetiredRow {
  id: string;
  teacher_id: string | null;
  teacher_nama: string | null;
  teacher_wa: string | null;
  status: string;
}

type Outcome =
  | { kind: "not_found" }
  | { kind: "already_evaluated" }
  | { kind: "no_active" }
  | { kind: "ok"; retired: RetiredRow; assignmentId: string };

export async function POST(req: Request) {
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

  // Target diselesaikan SEBELUM transaksi: validasi gender dan status pengajar
  // hanya membaca, dan menahan kunci baris selama pemeriksaan itu tidak ada
  // gunanya.
  const sub = await fetchSubmission(input.submission_id);
  if (!sub) return jsonError("submission_not_found", 404);

  const resolved = await resolveTarget(input, sub);
  if ("error" in resolved) return resolved.error;
  const { target } = resolved;

  const ip = clientIp(req);
  const ua = req.headers.get("user-agent");

  let outcome: Outcome;
  try {
    outcome = await sql.begin(async (tx): Promise<Outcome> => {
      // Titik serialisasi. Dua admin yang menekan tombol bersamaan mengantre di
      // sini, jadi yang kedua melihat baris aktif sudah dipensiunkan dan
      // mendapat 409 — bukan dua penugasan aktif untuk satu rekaman.
      const subRows = await tx<{ id: string }[]>`
        SELECT id FROM submissions WHERE id = ${sub.id} FOR UPDATE
      `;
      if (!subRows[0]) return { kind: "not_found" };

      // Dicek di dalam kunci: teacher_evaluations unik per submission dan
      // ditulis dengan upsert, jadi penilai kedua akan MENIMPA yang pertama.
      const ev = await tx<{ ada: number }[]>`
        SELECT 1 AS ada FROM teacher_evaluations
        WHERE submission_id = ${sub.id} LIMIT 1
      `;
      if (ev.length > 0) return { kind: "already_evaluated" };

      // 1. Pensiunkan yang aktif. wa_error TIDAK disentuh: kolom itu jejak
      //    kegagalan kirim, bukan tempat menulis alasan admin. Alasannya masuk
      //    ke audit_logs.
      const retired = await tx<RetiredRow[]>`
        UPDATE assignments SET status = ${"failed"}
        WHERE submission_id = ${sub.id}
          AND status NOT IN ('completed','failed')
        RETURNING id, teacher_id, teacher_nama, teacher_wa, status
      `;
      const lama = retired[0];
      if (!lama) return { kind: "no_active" };

      // 2. Baris baru. Aman dalam transaksi yang sama: UPDATE di atas sudah
      //    terlihat oleh snapshot transaksi ini, jadi predikat indeks parsial
      //    tidak lagi mencakup baris lama saat INSERT diperiksa. Urutannya
      //    tidak boleh dibalik — menyisipkan duluan menaruh dua baris di dalam
      //    predikat sekaligus dan langsung memicu 23505.
      const created = await tx<{ id: string }[]>`
        INSERT INTO assignments (submission_id, teacher_id, teacher_nama, teacher_wa)
        VALUES (${sub.id}, ${target.teacherId}, ${target.nama}, ${target.nomorWa})
        RETURNING id
      `;
      const baru = created[0];
      if (!baru) throw new Error("insert assignment tidak mengembalikan baris");

      // Audit ikut di dalam transaksi, disengaja: tulisan admin yang tidak
      // tercatat tidak boleh sampai commit.
      await tx`
        INSERT INTO audit_logs
          (actor_user_id, actor_role, action, entity_type, entity_id,
           before_state, after_state, ip_address, user_agent)
        VALUES (
          ${admin.authUserId}, ${"admin"}, ${"assignment.reassign"},
          ${"submission"}, ${sub.id},
          ${tx.json({
            assignment_id: lama.id,
            teacher_id: lama.teacher_id,
            teacher_nama: lama.teacher_nama,
            status_sebelum: lama.status,
          })},
          ${tx.json({
            assignment_id: baru.id,
            teacher_id: target.teacherId,
            teacher_nama: target.nama,
            mode: input.mode,
            alasan: input.alasan ?? null,
          })},
          ${ip},
          ${ua}
        )
      `;

      return { kind: "ok", retired: lama, assignmentId: baru.id };
    });
  } catch (err) {
    // Seandainya kunci FOR UPDATE dilepas pun, indeks parsial tetap membuat
    // penugasan ganda mustahil — INSERT yang kalah memicu 23505. Itu keadaan
    // yang wajar dalam perlombaan, bukan kerusakan server.
    if (isUniqueViolation(err)) {
      return jsonError("already_assigned", 409, {
        message: "Rekaman ini baru saja dipindahkan admin lain. Muat ulang halamannya.",
      });
    }
    const message = (err as Error).message;
    console.error("[admin.reassign] gagal:", message);
    return jsonError("db_error", 500, { message });
  }

  if (outcome.kind === "not_found") return jsonError("submission_not_found", 404);
  if (outcome.kind === "already_evaluated") {
    return jsonError("already_evaluated", 409, {
      message: "Rekaman ini sudah dinilai; memindahkannya akan menimpa nilai yang ada.",
    });
  }
  if (outcome.kind === "no_active") {
    return jsonError("no_active_assignment", 409, {
      message: "Tidak ada penugasan aktif untuk dipindahkan. Pakai Tugaskan, bukan Alihkan.",
    });
  }

  // Kirim WA DI LUAR transaksi. Panggilan kirimi.id bisa 20 detik; melakukannya
  // di dalam sql.begin menahan koneksi pool (max 5) dan kunci baris selama itu,
  // dan beberapa pemindahan bersamaan akan menghabiskan pool.
  const notify = await notifyAssignment({
    assignmentId: outcome.assignmentId,
    target,
    pesertaNama: sub.nama,
    jenisKelamin: sub.jenis_kelamin,
    durasiDetik: sub.durasi,
  });

  // Kegagalan WA TIDAK membatalkan pemindahan. Barisnya tinggal di status
  // 'assigned' dengan wa_error terisi, daftar menampilkannya sebagai wa_gagal,
  // dan admin bisa memindahkannya lagi. Rollback justru meninggalkan rekaman
  // tanpa pengajar sama sekali — lebih buruk daripada punya pengajar yang
  // belum dikabari.
  return NextResponse.json({
    ok: true,
    action: "reassigned",
    assignment_id: outcome.assignmentId,
    previous_assignment_id: outcome.retired.id,
    previous_teacher_nama: outcome.retired.teacher_nama,
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
