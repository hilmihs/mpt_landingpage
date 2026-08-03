"use client";

import { Copy, MessageCircle, Check } from "lucide-react";
import { useState } from "react";

interface Props {
  slug: string;
  /**
   * Skor pengajar, skala 1-10. Boleh null kalau belum dinilai.
   *
   * Sengaja BUKAN skor AI: pesan ini dibagikan ke grup WhatsApp, sedangkan
   * skor AI adalah bahan pembanding internal sampai Januari.
   */
  skor: number | null;
}

export function ShareButtons({ slug, skor }: Props) {
  const [copied, setCopied] = useState(false);

  // Resolve the absolute URL lazily at click time so server and client render
  // identically (no hydration mismatch) and we never touch window during render.
  const resolveUrl = () =>
    typeof window !== "undefined"
      ? `${window.location.origin}/rapot/${slug}`
      : `/rapot/${slug}`;

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      skor != null
        ? `Alhamdulillah, saya baru saja menyelesaikan Assessment Al-Fatihah di Muhajir Project Tilawah dan mendapat skor ${skor}/10. Cek rapot saya: ${resolveUrl()}`
        : `Alhamdulillah, saya baru saja mengikuti Assessment Al-Fatihah di Muhajir Project Tilawah. Cek rapot saya: ${resolveUrl()}`,
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
