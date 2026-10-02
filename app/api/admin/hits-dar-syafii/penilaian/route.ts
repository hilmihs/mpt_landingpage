import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { clientIp, jsonError } from "@/lib/admin/assign";
import { DAR_SYAFII, penilaianSchema } from "@/lib/hits-dar-syafii";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NilaiRow {
  lahn_jaliy: number | null;
  lahn_khofi: number | null;
  buta_huruf: boolean | null;
  penilaian_keterangan: string | null;
  level: string;
  level_penempatan: string;
}

/**
 * Simpan penilaian rekaman ujian masuk oleh lajnah — pengganti kolom
 * "Penilaian oleh Lajnah" di spreadsheet. Boleh ditimpa (penilai
 * memperbaiki salah ketik); tiap perubahan tercatat di audit_logs.
 *
 * Pendaftar Lanjutan yang dinilai buta huruf otomatis masuk HITS Dasar lewat
 * kolom generated `level_penempatan`, bukan lewat kode ini.
 */
export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError("unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const parsed = penilaianSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("validation_failed", 400, {
      message: parsed.error.issues[0]?.message ?? "Isian penilaian belum benar.",
    });
  }
  const input = parsed.data;

  type Outcome = { kind: "not_found" } | { kind: "no_audio" } | { kind: "ok"; row: NilaiRow };

  let outcome: Outcome;
  try {
    outcome = await sql.begin(async (tx): Promise<Outcome> => {
      const before = await tx<(NilaiRow & { audio_path: string | null })[]>`
        SELECT lahn_jaliy, lahn_khofi, buta_huruf, penilaian_keterangan, level, level_penempatan, audio_path
          FROM hits_pendaftaran
         WHERE id = ${input.id}
           AND program = ${DAR_SYAFII.program}
         FOR UPDATE
      `;
      const lama = before[0];
      if (!lama) return { kind: "not_found" };
      // Yang dinilai adalah rekaman. Pendaftar tanpa rekaman (Dasar/Alumni)
      // tidak punya bahan untuk dinilai.
      if (!lama.audio_path) return { kind: "no_audio" };

      const after = await tx<NilaiRow[]>`
        UPDATE hits_pendaftaran
           SET lahn_jaliy = ${input.lahn_jaliy},
               lahn_khofi = ${input.lahn_khofi},
               buta_huruf = ${input.buta_huruf},
               penilaian_keterangan = ${input.keterangan},
               dinilai_at = now(),
               dinilai_oleh = ${admin.nama}
         WHERE id = ${input.id}
        RETURNING lahn_jaliy, lahn_khofi, buta_huruf, penilaian_keterangan, level, level_penempatan
      `;
      const baru = after[0]!;

      await tx`
        INSERT INTO audit_logs
          (actor_user_id, actor_role, action, entity_type, entity_id,
           before_state, after_state, ip_address, user_agent)
        VALUES (
          ${admin.authUserId}, ${"admin"}, ${"hits_pendaftaran.penilaian"},
          ${"hits_pendaftaran"}, ${input.id},
          ${tx.json({
            lahn_jaliy: lama.lahn_jaliy,
            lahn_khofi: lama.lahn_khofi,
            buta_huruf: lama.buta_huruf,
            keterangan: lama.penilaian_keterangan,
            level_penempatan: lama.level_penempatan,
          })},
          ${tx.json({
            lahn_jaliy: baru.lahn_jaliy,
            lahn_khofi: baru.lahn_khofi,
            buta_huruf: baru.buta_huruf,
            keterangan: baru.penilaian_keterangan,
            level_penempatan: baru.level_penempatan,
          })},
          ${clientIp(req)},
          ${req.headers.get("user-agent")}
        )
      `;

      return { kind: "ok", row: baru };
    });
  } catch (err) {
    console.error("[admin.hits-penilaian] gagal:", (err as Error).message);
    return jsonError("db_error", 500, { message: "Penilaian gagal disimpan. Coba lagi." });
  }

  if (outcome.kind === "not_found") return jsonError("not_found", 404, { message: "Pendaftar tidak ditemukan." });
  if (outcome.kind === "no_audio") {
    return jsonError("no_audio", 409, { message: "Pendaftar ini tidak menyetor rekaman." });
  }

  return NextResponse.json({ ok: true, ...outcome.row, dinilai_oleh: admin.nama });
}
