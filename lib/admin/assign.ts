import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { fallbackTarget, pickTeacher, type DispatchTarget } from "@/lib/dispatch";

/**
 * Bagian bersama antara penugasan manual dan pemindahan pengajar.
 *
 * Dua route dipisah supaya niatnya eksplisit — satu endpoint yang "menebak
 * sendiri" akan membuat halaman yang sudah basi diam-diam menggusur pengajar
 * yang sedang aktif, alih-alih menolak dan memberi tahu admin bahwa
 * pandangannya sudah ketinggalan.
 */

export const assignSchema = z.object({
  submission_id: z.string().uuid(),
  mode: z.enum(["teacher", "fallback", "auto"]).default("teacher"),
  teacher_id: z.string().uuid().nullable().optional(),
  alasan: z.string().max(300).optional(),
});

export type AssignInput = z.infer<typeof assignSchema>;

export interface SubmissionInfo {
  id: string;
  nama: string;
  nomor_wa: string;
  jenis_kelamin: "ikhwan" | "akhwat";
  durasi: number | null;
}

export function jsonError(
  error: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function fetchSubmission(id: string): Promise<SubmissionInfo | null> {
  const rows = await sql<SubmissionInfo[]>`
    SELECT id, nama, nomor_wa, jenis_kelamin,
           audio_duration_sec::float8 AS durasi
    FROM submissions
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Ubah pilihan admin jadi target penugasan yang sah.
 *
 * Gender ditegakkan KETAT tanpa jalan pintas. Aturan rapat 3 Agustus 2026 tidak
 * punya pengecualian, jadi tidak ada bendera override — kalau admin merasa
 * perlu menyeberang, yang salah adalah daftar pengajarnya, bukan aturannya.
 *
 * pickTeacher dipakai lagi untuk mode "auto", tapi UJI_COBA di lib/dispatch.ts
 * tidak ikut: pengalihan nomor uji hanya berlaku di jalur otomatis saat peserta
 * mengirim rekaman. Pilihan yang diketik admin tidak boleh dibelokkan diam-diam.
 */
export async function resolveTarget(
  input: AssignInput,
  sub: SubmissionInfo,
): Promise<{ target: DispatchTarget } | { error: NextResponse }> {
  if (input.mode === "fallback") {
    const t = fallbackTarget();
    if (!t) {
      return {
        error: jsonError("no_fallback", 409, {
          message: "SUPERADMIN_WA belum diisi, jadi tidak ada penampung terakhir.",
        }),
      };
    }
    return { target: t };
  }

  if (input.mode === "auto") {
    const t = (await pickTeacher(sub.jenis_kelamin)) ?? fallbackTarget();
    if (!t) {
      return {
        error: jsonError("no_target", 409, {
          message: `Tidak ada pengajar ${sub.jenis_kelamin} yang aktif dan SUPERADMIN_WA kosong.`,
        }),
      };
    }
    return { target: t };
  }

  if (!input.teacher_id) {
    return {
      error: jsonError("validation_failed", 400, {
        message: "teacher_id wajib diisi saat mode = teacher.",
      }),
    };
  }

  const rows = await sql<
    { id: string; nama: string; nomor_wa: string; jenis_kelamin: string; status: string }[]
  >`
    SELECT id, nama, nomor_wa, jenis_kelamin, status
    FROM teachers
    WHERE id = ${input.teacher_id}
    LIMIT 1
  `;
  const t = rows[0];
  if (!t) return { error: jsonError("teacher_not_found", 404) };

  if (t.jenis_kelamin !== sub.jenis_kelamin) {
    return {
      error: jsonError("gender_mismatch", 422, {
        message: `Peserta ${sub.jenis_kelamin} hanya boleh dinilai pengajar ${sub.jenis_kelamin}.`,
      }),
    };
  }
  if (t.status !== "active") {
    return {
      error: jsonError("teacher_inactive", 422, {
        message: `Pengajar ini berstatus ${t.status}, bukan active.`,
      }),
    };
  }

  return {
    target: {
      teacherId: t.id,
      nama: t.nama,
      nomorWa: t.nomor_wa,
      isFallback: false,
    },
  };
}

/**
 * Alamat IP untuk audit_logs.
 *
 * Kolomnya bertipe INET dan Postgres menolak nilai yang tidak berbentuk alamat.
 * x-forwarded-for bisa berisi daftar berkoma, nomor port, atau kata "unknown" —
 * kalau salah satunya lolos, INSERT audit gagal dan menggagalkan seluruh
 * transaksi pemindahan. Lebih baik kehilangan alamat daripada kehilangan
 * pemindahannya.
 */
export function clientIp(req: Request): string | null {
  const raw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!raw) return null;
  return /^[0-9a-fA-F:.]+$/.test(raw) ? raw : null;
}

/** Benar kalau galat Postgres ini adalah pelanggaran unique constraint. */
export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "23505";
}

export async function sudahDinilai(submissionId: string): Promise<boolean> {
  const rows = await sql<{ ada: number }[]>`
    SELECT 1 AS ada FROM teacher_evaluations
    WHERE submission_id = ${submissionId}
    LIMIT 1
  `;
  return rows.length > 0;
}
