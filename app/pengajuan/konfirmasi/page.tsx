"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ArrowLeft, MessageCircle } from "lucide-react";

export default function KonfirmasiPengajuanPage() {
  const sp = useSearchParams();
  const org = sp.get("org") ?? "Organisasi Anda";
  const pic = sp.get("pic") ?? "";
  const wa = sp.get("wa") ?? "";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background:
          "radial-gradient(circle at top, color-mix(in oklab, var(--success), transparent 90%), var(--bg) 50%)",
        padding: "40px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div
          className="card-mpt screen-enter"
          style={{
            padding: "36px 28px",
            textAlign: "center",
            background: "color-mix(in oklab, var(--success), var(--paper) 92%)",
            borderColor: "color-mix(in oklab, var(--success), transparent 60%)",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              margin: "0 auto 20px",
              borderRadius: 20,
              background: "var(--success)",
              color: "white",
              display: "grid",
              placeItems: "center",
            }}
          >
            <CheckCircle2 size={36} strokeWidth={2.2} />
          </div>

          <h1
            className="font-display"
            style={{ fontSize: 26, margin: "0 0 8px", fontWeight: 800 }}
          >
            Pengajuan Terkirim!
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--ink-soft)",
              margin: "0 0 28px",
              lineHeight: 1.6,
              maxWidth: 420,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Terima kasih, pengajuan halaqah dari <strong>{org}</strong> telah
            kami terima. Tim kami akan menghubungi Anda melalui WhatsApp
            {wa ? ` di ${wa}` : ""} dalam 1×24 jam kerja.
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxWidth: 300,
              margin: "0 auto",
            }}
          >
            <a
              href={`https://wa.me/6285157517798?text=${encodeURIComponent(
                `Assalamu'alaikum, saya ${pic || "PIC"} dari ${org}. Kami baru saja mengirim pengajuan halaqah melalui website.`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-mpt btn-mpt-accent"
              style={{ width: "100%", justifyContent: "center" }}
            >
              <MessageCircle size={16} />
              Hubungi via WhatsApp
            </a>

            <Link
              href="/"
              className="btn-mpt btn-mpt-outline"
              style={{ width: "100%", justifyContent: "center" }}
            >
              <ArrowLeft size={14} strokeWidth={2.4} />
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
