"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, MessageCircle, UserPlus } from "lucide-react";
import { DAR_SYAFII } from "@/lib/hits-dar-syafii";
import s from "./dar-syafii.module.css";
import { Star8 } from "./Ornaments";
import { Sheet } from "./StepDataDiri";

/** Titik-titik bintang segi-8 untuk lencana — sama dengan Star8, skala 100. */
const BADGE_STAR = Array.from({ length: 16 }, (_, i) => {
  const r = i % 2 === 0 ? 72 : 54;
  const a = ((-90 + i * 22.5) * Math.PI) / 180;
  return `${(75 + r * Math.cos(a)).toFixed(2)},${(75 + r * Math.sin(a)).toFixed(2)}`;
}).join(" ");

const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const d = 90 + (i % 3) * 22;
  return { dx: Math.round(Math.cos(a) * d), dy: Math.round(Math.sin(a) * d), delay: 0.45 + (i % 4) * 0.06 };
});

const VCARD = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:Admin Muhajir Project Tilawah",
  `TEL;TYPE=CELL:+${DAR_SYAFII.adminWa}`,
  "END:VCARD",
].join("\n");

export function Selesai({ nama, waTerkirim }: { nama: string; waTerkirim: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(DAR_SYAFII.adminWaLabel.replace(/\s/g, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard diblokir — nomornya tetap terlihat untuk disalin manual.
    }
  }

  return (
    <Sheet>
      <div className={s.done}>
        <div className={s.doneBadge} aria-hidden="true">
          {SPARKS.map((sp, i) => (
            <span
              key={i}
              className={s.spark}
              style={
                {
                  "--dx": `${sp.dx}px`,
                  "--dy": `${sp.dy}px`,
                  animationDelay: `${sp.delay}s`,
                } as React.CSSProperties
              }
            >
              <Star8 size={10} />
            </span>
          ))}
          <svg viewBox="0 0 150 150">
            <polygon points={BADGE_STAR} className={s.doneStar} />
            <path d="M48 77 L67 95 L103 57" className={s.doneCheck} pathLength={1} />
          </svg>
        </div>

        <h2 className={s.doneTitle}>
          Alhamdulillah, <em>terkirim</em>
        </h2>
        <p className={s.doneLead}>
          Barakallahu fiikum, {nama}. Pendaftaran {DAR_SYAFII.nama} dan rekaman
          ujian masuk Anda sudah kami terima.
        </p>

        {waTerkirim ? (
          <div className={s.waBadge}>
            <Check size={16} strokeWidth={3} />
            Petunjuk di bawah juga sudah dikirim ke WhatsApp Anda
          </div>
        ) : (
          <p className={s.hint} style={{ marginTop: -10, marginBottom: 18 }}>
            Mohon screenshot dan simpan petunjuk di bawah ini.
          </p>
        )}

        <div className={s.tips}>
          <div className={s.tip}>
            <Star8 size={30} className={s.scriptNum}>1</Star8>
            <div>
              <h3>Izinkan admin memasukkan Anda ke grup</h3>
              <p>Supaya undangan grup kelas tidak tertolak oleh WhatsApp Anda:</p>
              <div className={s.crumbs}>
                {["⋮", "Setelan", "Privasi", "Grup", "Semua Orang"].map((c, i, arr) => (
                  <span key={c} style={{ display: "contents" }}>
                    <span className={s.crumb}>{c}</span>
                    {i < arr.length - 1 && <span className={s.crumbSep}>›</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className={s.tip}>
            <Star8 size={30} className={s.scriptNum}>2</Star8>
            <div>
              <h3>Simpan nomor admin</h3>
              <p>Pesan dari nomor yang tidak tersimpan sering masuk arsip atau tertolak.</p>
              <div className={s.adminNum}>
                <code>{DAR_SYAFII.adminWaLabel}</code>
              </div>
              <div className={s.adminNum}>
                <button type="button" className={s.smallBtn} onClick={copy}>
                  {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} strokeWidth={2.4} />}
                  {copied ? "Tersalin" : "Salin"}
                </button>
                <a
                  className={s.smallBtn}
                  href={`data:text/vcard;charset=utf-8,${encodeURIComponent(VCARD)}`}
                  download="Admin Muhajir Project Tilawah.vcf"
                >
                  <UserPlus size={14} strokeWidth={2.4} />
                  Simpan kontak
                </a>
                <a
                  className={s.smallBtn}
                  href={`https://wa.me/${DAR_SYAFII.adminWa}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={14} strokeWidth={2.4} />
                  Buka chat
                </a>
              </div>
            </div>
          </div>

          <div className={s.tip}>
            <Star8 size={30} className={s.scriptNum}>3</Star8>
            <div>
              <h3>Tunggu kabar sebelum hari pertama</h3>
              <p>
                Peserta yang terpilih maupun yang tidak, insya Allah dikabari admin
                sebelum hari pertama kegiatan belajar. Peserta terpilih akan
                menerima tautan grup WhatsApp kelas.
              </p>
            </div>
          </div>
        </div>

        <Link href="/" className={`${s.btnGhost} ${s.btnBlock}`} style={{ textDecoration: "none" }}>
          Kembali ke beranda
        </Link>
      </div>
    </Sheet>
  );
}
