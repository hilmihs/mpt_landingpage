"use client";

import Link from "next/link";
import { useState } from "react";
import { Camera, Check } from "lucide-react";
import { DAR_SYAFII } from "@/lib/hits-dar-syafii";
import s from "./dar-syafii.module.css";
import x from "./selesai.module.css";

/** Bintang 16 titik untuk lencana, viewBox 40×40. */
const BADGE_STAR = Array.from({ length: 16 }, (_, i) => {
  const r = i % 2 === 0 ? 19 : 14;
  const a = ((-90 + i * 22.5) * Math.PI) / 180;
  return `${(20 + r * Math.cos(a)).toFixed(2)},${(20 + r * Math.sin(a)).toFixed(2)}`;
}).join(" ");

const CRUMBS = ["⋮", "Setelan", "Privasi", "Grup", "Semua Orang"];

const VCARD = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:Admin Muhajir Project Tilawah",
  `TEL;TYPE=CELL:+${DAR_SYAFII.adminWa}`,
  "END:VCARD",
].join("\n");

export function Selesai({
  nama,
  waTerkirim,
  denganRekaman,
}: {
  nama: string;
  waTerkirim: boolean;
  denganRekaman: boolean;
}) {
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
    <>
      <div className={x.hero}>
        <div className={x.glow} aria-hidden="true" />
        <div className={`${x.heroInner} ${s.col}`}>
          <svg viewBox="0 0 40 40" className={x.badge} aria-hidden="true">
            <polygon points={BADGE_STAR} className={x.star} />
            <path d="M13 20.5 L18 25.5 L27.5 15" className={x.check} pathLength={1} />
          </svg>

          <h2 className={x.title}>
            Alhamdulillah, <em>terkirim</em>
          </h2>
          <p className={x.lead}>
            Barakallahu fiikum, {nama}. Pendaftaran {DAR_SYAFII.nama}
            {denganRekaman ? " dan rekaman ujian masuk" : ""} Anda sudah kami terima.
          </p>

          {waTerkirim ? (
            <div className={x.pill}>
              <Check size={14} strokeWidth={3} aria-hidden="true" />
              Petunjuk juga dikirim ke WhatsApp
            </div>
          ) : (
            <div className={`${x.pill} ${x.pillWarn}`}>
              <Camera size={14} strokeWidth={2.4} aria-hidden="true" />
              Mohon screenshot dan simpan petunjuk di bawah ini.
            </div>
          )}
        </div>
      </div>

      {/* Bukan <Sheet>: di layar lebar lembar ini melebar untuk tiga kartu berjajar. */}
      <div className={`${s.sheet} ${x.sheet}`}>
        <div className={x.stack}>
          <div className={s.eyebrow}>Sebelum hari pertama</div>

          <ol className={x.steps}>
            <li className={x.card}>
              <div className={x.cardHead}>
                <span className={x.num} aria-hidden="true">1</span>
                <h3 className={x.cardTitle}>Izinkan admin memasukkan Anda ke grup</h3>
              </div>
              <p className={x.cardText}>
                Supaya undangan grup kelas tidak tertolak oleh WhatsApp Anda:
              </p>
              <div className={x.crumbs}>
                {CRUMBS.map((c, i) => (
                  <span key={c} style={{ display: "contents" }}>
                    {c === "⋮" ? (
                      <span className={x.crumb}>
                        <span aria-hidden="true">⋮</span>
                        <span className={s.srOnly}>Menu titik tiga</span>
                      </span>
                    ) : (
                      <span className={x.crumb}>{c}</span>
                    )}
                    {i < CRUMBS.length - 1 && (
                      <span className={x.crumbSep} aria-hidden="true">›</span>
                    )}
                  </span>
                ))}
              </div>
            </li>

            <li className={x.card}>
              <div className={x.cardHead}>
                <span className={x.num} aria-hidden="true">2</span>
                <h3 className={x.cardTitle}>Simpan nomor admin</h3>
              </div>
              <p className={x.cardText}>
                Pesan dari nomor yang tidak tersimpan sering masuk arsip atau tertolak.
              </p>
              <div className={x.adminNum}>{DAR_SYAFII.adminWaLabel}</div>
              <div className={x.actions}>
                <button
                  type="button"
                  className={x.chip}
                  data-copied={copied}
                  onClick={copy}
                >
                  {copied ? "Tersalin" : "Salin"}
                </button>
                <a
                  className={x.chip}
                  href={`data:text/vcard;charset=utf-8,${encodeURIComponent(VCARD)}`}
                  download="Admin Muhajir Project Tilawah.vcf"
                >
                  Simpan kontak
                </a>
                <a
                  className={`${x.chip} ${x.chipDark}`}
                  href={`https://wa.me/${DAR_SYAFII.adminWa}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buka chat
                </a>
              </div>
              {/* Umpan balik salin untuk pembaca layar; tombolnya sendiri sudah berganti label. */}
              <span className={s.srOnly} role="status">
                {copied ? "Nomor admin tersalin" : ""}
              </span>
            </li>

            <li className={x.card}>
              <div className={x.cardHead}>
                <span className={x.num} aria-hidden="true">3</span>
                <h3 className={x.cardTitle}>Tunggu kabar dari admin</h3>
              </div>
              <p className={x.cardText}>
                Terpilih maupun tidak, insya Allah dikabari admin sebelum hari
                pertama kegiatan belajar. Peserta terpilih menerima tautan grup
                WhatsApp kelas.
              </p>
            </li>
          </ol>

          <Link href="/" className={`${s.btnGhost} ${s.btnBlock} ${x.home}`}>
            Kembali ke beranda
          </Link>
        </div>
      </div>
    </>
  );
}
