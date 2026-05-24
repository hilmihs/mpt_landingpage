"use client";

import { Button } from "@/components/ui/button";
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
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" className="min-h-11">
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle className="size-4 mr-2" />
          Bagikan via WA
        </a>
      </Button>
      <Button onClick={copy} variant="outline" className="min-h-11">
        {copied ? (
          <>
            <Check className="size-4 mr-2" />
            Tersalin
          </>
        ) : (
          <>
            <Copy className="size-4 mr-2" />
            Salin Link
          </>
        )}
      </Button>
    </div>
  );
}
