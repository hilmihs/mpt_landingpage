"use client";

import { Printer } from "lucide-react";

interface Props {
  /** Teks tombol. Default cukup untuk rapot peserta. */
  label?: string;
}

/**
 * Tombol simpan rapot sebagai PDF.
 *
 * Sengaja memakai dialog cetak bawaan browser, bukan generator PDF di sisi
 * klien: pustaka semacam @react-pdf/renderer menambah ~2MB bundle dan menuntut
 * tata letak kedua yang gampang menyimpang dari tampilan layar. Dengan
 * window.print() sumber kebenarannya tetap satu — markup rapot itu sendiri,
 * ditambah aturan @media print di app/globals.css.
 */
export function PrintButton({ label = "Simpan PDF" }: Props) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-mpt btn-mpt-outline no-print"
      style={{ minHeight: 44, fontSize: 14, padding: "10px 16px" }}
      aria-label="Cetak atau simpan rapot sebagai PDF"
    >
      <Printer className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
