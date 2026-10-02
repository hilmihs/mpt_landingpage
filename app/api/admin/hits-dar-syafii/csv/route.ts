import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import {
  BATAS_JALIY_BUTA_HURUF,
  DAR_SYAFII,
  LABEL_BUTA_HURUF,
  LEVELS,
  formulaButaHuruf,
} from "@/lib/hits-dar-syafii";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ekspor pendaftar HITS Darsyafii — pengganti spreadsheet respons Google
 * Form yang biasa dipakai admin untuk membagi kelas. Tautan rekaman tidak
 * ikut: URL bertanda tangan kedaluwarsa, dengarkan dari halaman admin.
 */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await sql<
    {
      created_at: Date;
      email: string;
      nama: string;
      nama_anak: string | null;
      kelas_anak: string | null;
      jenis_kelamin: string;
      nomor_wa: string;
      usia: number;
      kota: string;
      jadwal: string;
      level: string;
      audio_duration_sec: string | null;
      audio_sumber: string | null;
      level_penempatan: string;
      lahn_jaliy: number | null;
      lahn_khofi: number | null;
      buta_huruf: boolean | null;
      penilaian_keterangan: string | null;
      dinilai_at: Date | null;
      dinilai_oleh: string | null;
    }[]
  >`
    SELECT created_at, email, nama, nama_anak, kelas_anak, jenis_kelamin, nomor_wa, usia, kota, jadwal,
           level, audio_duration_sec, audio_sumber, level_penempatan, lahn_jaliy, lahn_khofi,
           buta_huruf, penilaian_keterangan, dinilai_at, dinilai_oleh
      FROM hits_pendaftaran
     WHERE program = ${DAR_SYAFII.program}
       AND angkatan = ${DAR_SYAFII.angkatan}
     ORDER BY created_at
  `;

  const levelNama = new Map<string, string>(LEVELS.map((l) => [l.id, l.nama]));
  // Awali sel yang dimulai =, +, -, @ dengan kutip tunggal supaya Excel/Sheets
  // tidak mengeksekusinya sebagai formula (CSV injection). Nomor WA "62…"
  // aman, tapi nama dan email diisi publik.
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };

  const header = [
    "Waktu (WIB)",
    "Email",
    "Nama",
    "Nama anak",
    "Kelas anak",
    "Jenis kelamin",
    "WhatsApp",
    "Usia",
    "Kota domisili",
    "Jam belajar",
    "Level",
    "Durasi rekaman (detik)",
    "Sumber rekaman",
    "Jumlah Lahn Jaliy",
    "Jumlah Lahn Khofi",
    "Penilaian lajnah",
    `Hasil formula (jaliy > ${BATAS_JALIY_BUTA_HURUF})`,
    "Keterangan",
    "Kelas penempatan",
    "Dinilai oleh",
    "Dinilai pada (WIB)",
  ];
  const bh = (v: boolean | null) =>
    v === null ? "" : v ? LABEL_BUTA_HURUF.ya : LABEL_BUTA_HURUF.tidak;
  const lines = rows.map((r) =>
    [
      r.created_at.toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" }),
      r.email,
      r.nama,
      r.nama_anak,
      r.kelas_anak,
      r.jenis_kelamin === "ikhwan" ? "Laki-laki" : "Perempuan",
      r.nomor_wa,
      r.usia,
      r.kota,
      r.jadwal,
      levelNama.get(r.level) ?? r.level,
      r.audio_duration_sec ?? "",
      r.audio_sumber ?? "tanpa rekaman",
      r.lahn_jaliy ?? "",
      r.lahn_khofi ?? "",
      bh(r.buta_huruf),
      bh(formulaButaHuruf(r.lahn_jaliy)),
      r.penilaian_keterangan ?? "",
      levelNama.get(r.level_penempatan) ?? r.level_penempatan,
      r.dinilai_oleh ?? "",
      r.dinilai_at ? r.dinilai_at.toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" }) : "",
    ]
      .map(cell)
      .join(","),
  );

  // BOM supaya Excel membaca UTF-8 dengan benar (nama berhuruf non-ASCII).
  const body = "﻿" + [header.map(cell).join(","), ...lines].join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hits-${DAR_SYAFII.program}-${DAR_SYAFII.angkatan}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
