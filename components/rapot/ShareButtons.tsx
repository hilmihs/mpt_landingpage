"use client";

import { Copy, MessageCircle, Check } from "lucide-react";
import { useState } from "react";

interface Props {
  slug: string;
}

export function ShareButtons({ slug }: Props) {
  const [copied, setCopied] = useState(false);

  // Resolve the absolute URL lazily at click time so server and client render
  // identically (no hydration mismatch) and we never touch window during render.
  const resolveUrl = () =>
    typeof window !== "undefined"
      ? `${window.location.origin}/rapot/${slug}`
      : `/rapot/${slug}`;

  /**
   * Pesan bagikan TIDAK memuat angka skor.
   *
   * Skor kepala diambil dari bagian terlemah, jadi satu kesalahan tasydid dan
   * dua puluh kesalahan sama-sama menghasilkan 4/10 — diukur pada 762 rekaman,
   * 90% peserta mendarat di angka itu. Angka telanjang tanpa konteks, dikirim
   * ke grup keluarga, terbaca seperti nilai ujian yang nyaris gagal. Peserta
   * yang bacaannya hampir bersih justru paling dirugikan.
   *
   * Rapotnya sendiri sudah menjelaskan angka itu dengan benar — jumlah bagian
   * yang sudah baik, jumlah catatan, dan bagian mana yang perlu dibenahi. Jadi
   * biarkan tautannya yang bicara, bukan potongan angkanya.
   */
  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `Alhamdulillah, saya baru saja menyelesaikan Assessment Al-Fatihah di Muhajir Project Tilawah dan sudah menerima rapot bacaan dari pengajar. Cek rapot saya: ${resolveUrl()}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(resolveUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 10,
      }}
    >
      <button
        type="button"
        onClick={shareWhatsApp}
        className="btn-mpt btn-mpt-outline"
        style={{ minHeight: 48, fontSize: 14 }}
      >
        <MessageCircle className="size-4" />
        Bagikan via WhatsApp
      </button>
      <button
        type="button"
        onClick={copy}
        className="btn-mpt btn-mpt-outline"
        style={{ minHeight: 48, fontSize: 14 }}
      >
        {copied ? (
          <>
            <Check className="size-4" />
            Tersalin
          </>
        ) : (
          <>
            <Copy className="size-4" />
            Salin Tautan
          </>
        )}
      </button>
    </div>
  );
}
