import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { DAR_SYAFII, LEVELS } from "@/lib/hits-dar-syafii";

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
      jenis_kelamin: string;
      nomor_wa: string;
      usia: number;
      kota: string;
      jadwal: string;
      level: string;
      audio_duration_sec: string | null;
      audio_sumber: string;
    }[]
  >`
    SELECT created_at, email, nama, jenis_kelamin, nomor_wa, usia, kota, jadwal,
           level, audio_duration_sec, audio_sumber
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
    "Jenis kelamin",
    "WhatsApp",
    "Usia",
    "Kota domisili",
    "Jam belajar",
    "Level",
    "Durasi rekaman (detik)",
    "Sumber rekaman",
  ];
  const lines = rows.map((r) =>
    [
      r.created_at.toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" }),
      r.email,
      r.nama,
      r.jenis_kelamin === "ikhwan" ? "Laki-laki" : "Perempuan",
      r.nomor_wa,
      r.usia,
      r.kota,
      r.jadwal,
      levelNama.get(r.level) ?? r.level,
      r.audio_duration_sec ?? "",
      r.audio_sumber,
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
