"use client";

import { Copy, MessageCircle, Check } from "lucide-react";
import { useState } from "react";

interface Props {
  slug: string;
  skor: number;
}

export function ShareButtons({ slug, skor }: Props) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/rapot/${slug}`
      : `/rapot/${slug}`;

  const waText = encodeURIComponent(
    `Alhamdulillah, saya baru saja menyelesaikan Assessment Al-Fatihah di Muhajir Project Tilawah dan mendapat skor ${skor}/5. Cek rapot saya: ${url}`,
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
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
      <a
        href={`https://wa.me/?text=${waText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-mpt btn-mpt-outline"
        style={{ minHeight: 48, fontSize: 14 }}
      >
        <MessageCircle className="size-4" />
        Bagikan via WhatsApp
      </a>
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
