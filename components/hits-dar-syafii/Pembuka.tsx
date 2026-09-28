"use client";

import { ArrowRight, MapPin } from "lucide-react";
import { DAR_SYAFII, JADWAL, type Gender } from "@/lib/hits-dar-syafii";
import s from "./dar-syafii.module.css";
import { GirihRosette, Lantern, Star8, TimeGlyph } from "./Ornaments";

const FACTS = [
  { big: "Ayah", small: "& ibu wali murid" },
  { big: "Offline", small: "di sekolah" },
  { big: "Gratis", small: "tanpa biaya apa pun" },
  { big: "45", small: "menit tiap pertemuan" },
];

const JOURNEY = [
  {
    title: "Isi data diri",
    body: "Nama, nomor WhatsApp, usia, dan kota domisili. Kurang dari satu menit.",
  },
  {
    title: "Pilih jadwal",
    body: "Jadwal kelas ikhwan dan akhwat terpisah — pilih yang bisa Anda hadiri tiap pekan.",
  },
  {
    title: "Rekam ujian masuk",
    body: "Baca Surat Asy-Syura ayat 1–6 langsung di halaman ini. Tidak perlu aplikasi lain.",
  },
];

const GRUP: { gender: Gender; label: string }[] = [
  { gender: "ikhwan", label: "Ikhwan · ayah / wali" },
  { gender: "akhwat", label: "Akhwat · ibu / wali" },
];

export function Pembuka({ onStart }: { onStart: () => void }) {
  return (
    <>
      <section className={s.hero}>
        <div className={s.lanterns} aria-hidden="true">
          <Lantern className={s.lanternLeft} chain={70} scale={0.85} />
          <Lantern className={s.lanternRight} chain={140} scale={1.05} delay={-2.2} />
        </div>

        <div className={s.heroArt}>
          <GirihRosette className={s.rosette} />
          <p className={s.arabicTitle} lang="ar" dir="rtl">
            دار الشافعي
          </p>
        </div>

        <div className={s.heroText}>
          <span className={s.chip}>
            <span className={s.chipDot} />
            Pendaftaran dibuka · khusus wali murid Darsyafii
          </span>

          <h1 className={s.latinTitle}>
            HITS <em>Darsyafii</em>
          </h1>

          <p className={s.lead}>
            Muhajir Project Tilawah bekerja sama dengan Darsyafii membuka kelas
            HITS untuk para orang tua dan wali murid — memperkuat pelafalan
            huruf-huruf Al-Qur&apos;an melalui {DAR_SYAFII.materi}.
          </p>

          <div className={s.facts}>
            {FACTS.map((f, i) => (
              <div key={f.small} className={s.fact} style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                <div className={s.factBig}>{f.big}</div>
                <div className={s.factSmall}>{f.small}</div>
              </div>
            ))}
          </div>

          <div className={s.ctaRow}>
            <button type="button" className={s.btnGold} onClick={onStart}>
              Bismillah, mulai daftar
              <ArrowRight size={18} strokeWidth={2.6} />
            </button>
            <span className={s.ctaNote}>
              ± 5 menit · siapkan tempat
              <br />
              yang tenang untuk merekam
            </span>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Jadwal yang masih tersedia</h2>
        <div className={s.infoGrid}>
          <div className={s.placeCard}>
            {GRUP.map((g) => (
              <div key={g.gender} style={{ padding: "6px 0 10px" }}>
                <div className={s.placeName} style={{ color: "var(--ds-gold-bright)", marginBottom: 4 }}>
                  {g.label}
                </div>
                {JADWAL.filter((j) => j.gender === g.gender).map((j) => (
                  <div key={j.id} className={s.placeRow}>
                    <span className={s.placeIcon}>
                      <TimeGlyph jam={j.jam} />
                    </span>
                    <div>
                      <div className={s.placeName}>{j.hari}</div>
                      <div className={s.placeSub}>{j.jam} WIB</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className={s.noteCard}>
            <h3>Yang perlu diketahui</h3>
            <p>
              <MapPin size={15} strokeWidth={2.4} style={{ verticalAlign: -2, marginRight: 6 }} />
              Kelas berlangsung <strong>offline di {DAR_SYAFII.tempat}</strong>,
              kelas ikhwan dan akhwat terpisah.
            </p>
            <p>
              Program ini <strong>bebas biaya</strong>. Peserta yang terpilih
              diharapkan berkomitmen penuh mengikuti program.
            </p>
            <p>
              Info lebih lanjut: Admin Muhajir Project Tilawah, WhatsApp{" "}
              <a href={`https://wa.me/${DAR_SYAFII.adminWa}`} style={{ color: "var(--ds-gold-bright)" }}>
                {DAR_SYAFII.adminWaLabel}
              </a>
              .
            </p>
            <p className={s.bismillah} lang="ar" dir="rtl">
              وَرَتِّلِ ٱلْقُرْءَانَ تَرْتِيلًا
            </p>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Tiga langkah pendaftaran</h2>
        <div className={s.journey}>
          <div className={s.journeyLine} aria-hidden="true" />
          {JOURNEY.map((j, i) => (
            <div key={j.title} className={s.journeyCard}>
              <Star8 size={36} className={s.journeyIcon}>
                {i + 1}
              </Star8>
              <div>
                <h3>{j.title}</h3>
                <p>{j.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={s.section} style={{ paddingBottom: 90, textAlign: "center" }}>
        <button type="button" className={s.btnGold} onClick={onStart}>
          Mulai daftar sekarang
          <ArrowRight size={18} strokeWidth={2.6} />
        </button>
      </section>
    </>
  );
}
