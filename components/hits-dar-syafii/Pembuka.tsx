"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, MapPin, MessageCircle, Users } from "lucide-react";
import { DAR_SYAFII, JADWAL, type Gender } from "@/lib/hits-dar-syafii";
import s from "./dar-syafii.module.css";
import p from "./pembuka.module.css";

const FACTS = [
  { big: "Gratis", small: "tanpa biaya apa pun" },
  { big: "Offline", small: "di sekolah" },
  { big: "45 mnt", small: "tiap pertemuan" },
  { big: "Terpisah", small: "ikhwan & akhwat" },
];

const LANGKAH = [
  {
    title: "Isi data diri",
    body: "Nama, WhatsApp, data anak, usia, dan kota. Sekitar satu menit.",
  },
  {
    title: "Pilih jadwal & level",
    body: "Hanya jadwal sesuai jenis kelamin Anda yang tampil.",
  },
  {
    title: "Rekam ujian masuk",
    body: "Baca Asy-Syura ayat 1–6 langsung di halaman ini.",
  },
];

const GRUP: { gender: Gender; label: string }[] = [
  { gender: "ikhwan", label: "Ikhwan · ayah / wali" },
  { gender: "akhwat", label: "Akhwat · ibu / wali" },
];

/** Label waktu dari jam mulai ("14.15 – 15.00" → Siang), supaya ikut berubah kalau JADWAL diubah. */
function waktuLabel(jam: string): string {
  const mulai = Number.parseInt(jam, 10);
  if (mulai < 11) return "Pagi";
  if (mulai < 15) return "Siang";
  if (mulai < 18) return "Sore";
  return "Malam";
}

/** Jeda animasi masuk bertahap. */
const d = (i: number) => ({ animationDelay: `${i * 70}ms` });

export function Pembuka({ onStart }: { onStart: () => void }) {
  const grup = GRUP.filter((g) => DAR_SYAFII.genderDibuka.includes(g.gender))
    .map((g) => ({ ...g, jadwal: JADWAL.filter((j) => j.gender === g.gender) }))
    .filter((g) => g.jadwal.length > 0);

  return (
    <>
      <section className={p.hero} aria-labelledby="ds-pembuka-title">
        <div className={`${s.col} ${p.heroInner}`}>
          <div className={`${p.topBar} ${p.rise}`} style={d(0)}>
            <Link href="/" className={p.brand} aria-label="Muhajir Project Tilawah — beranda">
              <Image
                src="/logo-mpt.png"
                alt=""
                width={38}
                height={38}
                className={p.brandLogo}
                priority
              />
              <span className={p.brandName} aria-hidden="true">
                Muhajir Project
                <br />
                Tilawah
              </span>
            </Link>
            <span className={p.partner}>× Darsyafii</span>
          </div>

          <p className={`${p.pill} ${p.rise}`} style={d(1)}>
            <span className={p.pillDot} aria-hidden="true" />
            Pendaftaran dibuka · Angkatan {DAR_SYAFII.angkatanLabel}
          </p>

          <div className={`${p.kicker} ${p.rise}`} style={d(2)}>
            <span className={p.kickerText}>HITS</span>
            <span className={p.kickerLine} aria-hidden="true" />
          </div>

          <h1 id="ds-pembuka-title" className={`${p.title} ${p.rise}`} style={d(3)}>
            Halaqah Iqra &amp; <span className={p.titleAccent}>Tajwid Spesial</span>
          </h1>

          <p className={`${p.lead} ${p.rise}`} style={d(4)}>
            Kelas perbaikan bacaan dan pendalaman huruf Al-Qur&apos;an untuk ayah, ibu, dan wali
            murid Darsyafii.
          </p>

          <ul className={`${p.facts} ${p.rise}`} style={d(5)}>
            {FACTS.map((f) => (
              <li key={f.big} className={p.fact}>
                <div className={p.factBig}>{f.big}</div>
                <div className={p.factSmall}>{f.small}</div>
              </li>
            ))}
          </ul>

          <div className={`${p.ctaWrap} ${p.rise}`} style={d(6)}>
            <button type="button" className={`${s.btnGold} ${s.btnBlock} ${p.cta}`} onClick={onStart}>
              Bismillah, mulai daftar
              <ArrowRight size={18} strokeWidth={2.6} aria-hidden="true" />
            </button>
            <span className={p.ctaNote}>± 5 menit · siapkan tempat yang tenang untuk merekam</span>
          </div>
        </div>
      </section>

      <div className={`${s.col} ${p.sheet} ${p.rise}`} style={d(7)}>
        <section className={p.secJadwal} aria-labelledby="ds-pembuka-jadwal">
          <div className={s.eyebrow}>Jadwal tersedia</div>
          <h2 id="ds-pembuka-jadwal" className={p.sheetTitle}>
            Satu kelas, <em>tiap pekan</em>
          </h2>

          <div className={p.jadwal}>
            {grup.map((g) => (
              <div key={g.gender} className={p.group}>
                <h3 className={p.groupLabel}>{g.label}</h3>
                <ul className={p.rows}>
                  {g.jadwal.map((j) => (
                    <li key={j.id} className={p.row}>
                      <span className={p.rowAbbr} aria-hidden="true">
                        {j.hari.slice(0, 3)}
                      </span>
                      <div>
                        <div className={p.rowDay}>{j.hari}</div>
                        <div className={p.rowTime}>{j.jam} WIB</div>
                      </div>
                      <span className={p.badge}>{waktuLabel(j.jam)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className={p.secLangkah} aria-labelledby="ds-pembuka-langkah">
          <h2 id="ds-pembuka-langkah" className={`${s.eyebrow} ${p.subHead}`}>
            Tiga langkah
          </h2>
          <ol className={p.steps}>
            {LANGKAH.map((l, i) => (
              <li key={l.title} className={p.stepItem}>
                <span className={p.stepNum} aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className={p.stepName}>{l.title}</h3>
                  <p className={p.stepBody}>{l.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Tidak ada di mockup, tapi fakta ini dulu tampil di pembuka dan
            ditanyakan calon peserta — dipertahankan dalam bentuk ringkas. */}
        <section className={p.secInfo} aria-labelledby="ds-pembuka-info">
          <h2 id="ds-pembuka-info" className={`${s.eyebrow} ${p.subHead}`}>
            Yang perlu diketahui
          </h2>
          <ul className={p.info}>
            <li className={p.infoItem}>
              <MapPin size={16} strokeWidth={2.4} aria-hidden="true" />
              <span>
                Offline di <b>{DAR_SYAFII.tempat}</b>, kelas ikhwan dan akhwat terpisah.
              </span>
            </li>
            <li className={p.infoItem}>
              <BookOpen size={16} strokeWidth={2.4} aria-hidden="true" />
              <span>Materi: {DAR_SYAFII.materi}.</span>
            </li>
            <li className={p.infoItem}>
              <Users size={16} strokeWidth={2.4} aria-hidden="true" />
              <span>
                Untuk {DAR_SYAFII.sasaran}, usia minimal {DAR_SYAFII.usiaMin} tahun.{" "}
                <b>Bebas biaya</b>; peserta yang terpilih diharapkan berkomitmen penuh mengikuti
                program.
              </span>
            </li>
            <li className={p.infoItem}>
              <MessageCircle size={16} strokeWidth={2.4} aria-hidden="true" />
              <span>
                Info lebih lanjut: Admin Muhajir Project Tilawah, WhatsApp{" "}
                <a
                  className={p.infoLink}
                  href={`https://wa.me/${DAR_SYAFII.adminWa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {DAR_SYAFII.adminWaLabel}
                </a>
                .
              </span>
            </li>
          </ul>
        </section>

        {/* Tombol kedua: setelah membaca sampai bawah, tidak perlu gulir balik ke hero. */}
        <button
          type="button"
          className={`${s.btnGreen} ${s.btnBlock} ${p.bottomCta}`}
          onClick={onStart}
        >
          Mulai daftar sekarang
          <ArrowRight size={18} strokeWidth={2.6} aria-hidden="true" />
        </button>

      </div>
    </>
  );
}
