import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { sql } from "@/lib/db";
import { fetchEvaluationByKode } from "@/lib/mpt-assessment";
import { sendWhatsApp, tplPesertaRapotReady } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  assignment_id: z.string().uuid(),
  kode_unik: z.string().min(1).max(64),
});

/**
 * Tautkan penilaian pengajar ke submission, simpan nilainya, lalu kirim rapot
 * ke peserta.
 *
 * Nilainya DISALIN, bukan sekadar dirujuk: AI kita menilai rekaman yang sama
 * di belakang layar, dan perbandingan Agustus–Desember cuma mungkin kalau
 * kedua nilai tersimpan bersebelahan di sisi kita.
 */
export async function POST(req: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", message: "Kode unik tidak valid." },
      { status: 400 },
    );
  }

  const rows = await sql<
    {
      submission_id: string;
      teacher_id: string | null;
      nama: string;
      nomor_wa: string;
      rapot_slug: string | null;
    }[]
  >`
    SELECT a.submission_id, a.teacher_id, s.nama, s.nomor_wa, s.rapot_slug
    FROM assignments a
    JOIN submissions s ON s.id = a.submission_id
    WHERE a.id = ${parsed.data.assignment_id}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Tanpa RLS, kepemilikan penugasan harus dicek di sini.
  if (row.teacher_id && row.teacher_id !== teacher.teacherId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const evaluation = await fetchEvaluationByKode(parsed.data.kode_unik);
  if (!evaluation) {
    return NextResponse.json(
      {
        error: "kode_not_found",
        message:
          "Kode unik tidak ditemukan di sistem penilaian. Periksa kembali kodenya.",
      },
      { status: 404 },
    );
  }

  try {
    await sql`
      INSERT INTO teacher_evaluations (
        submission_id, kode_unik, external_uuid, external_created_at,
        kegiatan, pemeriksa, asal_halaqah, nama_lengkap,
        score_harakat, label_harakat,
        score_panjang_pendek, label_panjang_pendek,
        score_tasydid, label_tasydid,
        score_hukum_tajwid, label_hukum_tajwid,
        score_ketepatan_huruf, label_ketepatan_huruf,
        score_min, label_min, raw
      ) VALUES (
        ${row.submission_id}, ${parsed.data.kode_unik}, ${evaluation.uuid},
        ${evaluation.createdAt ? new Date(evaluation.createdAt) : null},
        ${evaluation.kegiatan}, ${evaluation.pemeriksa}, ${evaluation.asalHalaqah},
        ${evaluation.namaLengkap},
        ${evaluation.harakat?.score ?? null}, ${evaluation.harakat?.label ?? null},
        ${evaluation.panjangPendek?.score ?? null}, ${evaluation.panjangPendek?.label ?? null},
        ${evaluation.tasydid?.score ?? null}, ${evaluation.tasydid?.label ?? null},
        ${evaluation.hukumTajwid?.score ?? null}, ${evaluation.hukumTajwid?.label ?? null},
        ${evaluation.ketepatanHuruf?.score ?? null}, ${evaluation.ketepatanHuruf?.label ?? null},
        ${evaluation.minScore?.score ?? null}, ${evaluation.minScore?.label ?? null},
        ${sql.json(evaluation as unknown as Parameters<typeof sql.json>[0])}
      )
      ON CONFLICT (submission_id) DO UPDATE SET
        kode_unik = EXCLUDED.kode_unik,
        score_min = EXCLUDED.score_min,
        label_min = EXCLUDED.label_min,
        raw = EXCLUDED.raw,
        fetched_at = now()
    `;
  } catch (err) {
    const msg = (err as Error).message;
    return NextResponse.json(
      {
        error: "db_error",
        message: msg.includes("teacher_evaluations_kode_unik_key")
          ? "Kode unik ini sudah dipakai untuk peserta lain."
          : "Gagal menyimpan hasil penilaian.",
      },
      { status: 500 },
    );
  }

  await sql`
    UPDATE assignments
    SET status = ${"completed"}, completed_at = ${new Date()}
    WHERE id = ${parsed.data.assignment_id}
  `;
  await sql`
    UPDATE submissions
    SET status = ${"completed"}, processed_at = ${new Date()}
    WHERE id = ${row.submission_id}
  `;

  // Kirim rapot ke peserta. Gagal kirim tidak membatalkan penyimpanan nilai —
  // nilainya sudah aman, dan WA bisa diulang dari portal admin.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const send = await sendWhatsApp(
    row.nomor_wa,
    tplPesertaRapotReady({
      pesertaNama: row.nama,
      rapotUrl: `${base}/rapot/${row.rapot_slug}`,
    }),
  );

  return NextResponse.json({
    ok: true,
    score: evaluation.minScore?.score ?? null,
    wa_sent: send.ok,
  });
}
