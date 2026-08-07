"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/** Satu pilihan kesalahan, tag kategorinya sudah dipisah dari kalimatnya. */
export interface SegmentOption {
  /** Kalimat asli berikut tag — inilah yang dikirim ke server. */
  raw: string;
  /** Kalimat tanpa tag, untuk dibaca pengajar. */
  text: string;
  /** Indikator (Harakat, Ketepatan Huruf, …), null kalau pilihan tidak bertag. */
  kategori: string | null;
}

export interface SegmentCardProps {
  /** Nomor urut tampil (1–8), bukan nomor ayat — ayat 7 terbagi dua. */
  index: number;
  label: string;
  arabic: string;
  transliterasi: string;
  optionsJaliy: SegmentOption[];
  optionsKhafiy: SegmentOption[];
  markedJaliy: string[];
  markedKhafiy: string[];
  onToggle: (severity: "jaliy" | "khafiy", raw: string) => void;
  /**
   * Kalimat opsi yang diusulkan mesin untuk segmen ini.
   *
   * SENGAJA TIDAK DICENTANG. Yang ditandai hanya perhatiannya; keputusan tetap
   * milik pengajar. Kalau kotaknya tercentang duluan, orang cenderung menerima
   * saja — dan penilaian jadi sepakat dengan mesin secara konstruksi, sehingga
   * tidak ada lagi cara mengetahui apakah mesinnya benar.
   */
  usulan?: readonly string[];
}

/**
 * Satu segmen bacaan dengan daftar centang kesalahannya.
 *
 * Kartu yang belum dicentang tampil terlipat. Pengajar menilai 110 pilihan
 * dalam sekali duduk; kalau semuanya terbuka, layar jadi satu dinding teks dan
 * dia kehilangan jejak sudah sampai mana.
 */
export function SegmentCard({
  index,
  label,
  arabic,
  transliterasi,
  optionsJaliy,
  optionsKhafiy,
  markedJaliy,
  markedKhafiy,
  onToggle,
  usulan,
}: SegmentCardProps) {
  const jumlahJaliy = markedJaliy.length;
  const jumlahKhafiy = markedKhafiy.length;
  const bersih = jumlahJaliy + jumlahKhafiy === 0;
  const adaUsulan = (usulan?.length ?? 0) > 0;

  // Nilai awal saja: begitu pengajar membuka kartu, kartunya tetap terbuka
  // walau centangnya dia batalkan lagi. Segmen yang punya usulan ikut dibuka:
  // usulan yang tersembunyi di balik kartu terlipat tidak menghemat waktu
  // siapa pun.
  const [open, setOpen] = useState(!bersih || adaUsulan);

  const ringkasan = bersih
    ? "Bersih"
    : [
        jumlahJaliy > 0 ? `${jumlahJaliy} fatal` : null,
        jumlahKhafiy > 0 ? `${jumlahKhafiy} perlu diperhatikan` : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <div
      className="card-mpt"
      style={{
        padding: 0,
        overflow: "hidden",
        borderColor: bersih ? "var(--line)" : "var(--line-strong)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
          color: "var(--ink)",
        }}
      >
        <span className="ayat-num" style={{ width: 28, height: 28, fontSize: 12, flexShrink: 0 }}>
          {index}
        </span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{label}</span>
          <span
            style={{
              display: "block",
              fontSize: 12,
              marginTop: 2,
              color: bersih ? "var(--ink-mute)" : "var(--danger)",
              fontWeight: bersih ? 500 : 700,
            }}
          >
            {ringkasan}
          </span>
        </span>

        <ChevronDown
          size={17}
          strokeWidth={2.2}
          color="var(--ink-mute)"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        />
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          {/* line-height bawaan .ayat-arabic sengaja tidak diturunkan: harakat
              di atas huruf terpotong kalau barisnya dirapatkan. */}
          <div className="ayat-arabic font-arabic" dir="rtl" lang="ar">
            {arabic}
          </div>
          <div className="ayat-translit" style={{ textAlign: "center" }}>
            {transliterasi}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
            {/* Khafiy lebih dulu: yang ringan jauh lebih sering ditemui, jadi
                pengajar menemukan centangannya tanpa melewati daftar fatal. */}
            <OptionGroup
              usulan={usulan}
              judul="Perlu Diperhatikan"
              warna="var(--warning)"
              options={optionsKhafiy}
              marked={markedKhafiy}
              onToggle={(raw) => onToggle("khafiy", raw)}
            />
            <OptionGroup
              usulan={usulan}
              judul="Fatal"
              warna="var(--danger)"
              options={optionsJaliy}
              marked={markedJaliy}
              onToggle={(raw) => onToggle("jaliy", raw)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function OptionGroup({
  judul,
  warna,
  options,
  marked,
  onToggle,
  usulan,
}: {
  judul: string;
  warna: string;
  options: SegmentOption[];
  marked: string[];
  onToggle: (raw: string) => void;
  usulan?: readonly string[];
}) {
  if (options.length === 0) return null;

  return (
    <fieldset style={{ border: "none", padding: 0, margin: 0, minWidth: 0 }}>
      <legend
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: 0,
          marginBottom: 8,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: warna,
        }}
      >
        <span
          style={{ width: 7, height: 7, borderRadius: "50%", background: warna, flexShrink: 0 }}
        />
        {judul}
      </legend>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {options.map((opt) => {
          const checked = marked.includes(opt.raw);
          // Diusulkan mesin tapi belum dicentang. Begitu pengajar mencentang,
          // penandanya hilang — yang tersisa keputusan dia, bukan saran mesin.
          const diusulkan = !checked && (usulan?.includes(opt.raw) ?? false);
          return (
            <label
              key={opt.raw}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "9px 11px",
                borderRadius: 10,
                cursor: "pointer",
                background: checked
                  ? `color-mix(in oklab, ${warna}, transparent 90%)`
                  : diusulkan
                    ? "color-mix(in oklab, var(--ink-mute), transparent 94%)"
                    : "transparent",
                border: `1px solid ${
                  checked
                    ? `color-mix(in oklab, ${warna}, transparent 70%)`
                    : diusulkan
                      ? "var(--line)"
                      : "transparent"
                }`,
                borderStyle: !checked && diusulkan ? "dashed" : "solid",
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(opt.raw)}
                style={{
                  marginTop: 2,
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                  accentColor: warna,
                  cursor: "pointer",
                }}
              />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.55 }}>
                {opt.text}
                {/* Spasi eksplisit: tanpa ini nama aksesibel checkbox jadi
                    "…kata اهدناdengar juga oleh mesin" — tersambung tanpa jeda
                    bagi pembaca layar, walau di layar terlihat berjarak. */}
                {diusulkan && " "}
                {diusulkan && (
                  <span
                    style={{
                      marginLeft: 8,
                      padding: "2px 7px",
                      borderRadius: 999,
                      border: "1px dashed var(--line-strong)",
                      color: "var(--ink-mute)",
                      fontSize: 10,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    dengar juga oleh mesin
                  </span>
                )}
              </span>
              {opt.kategori && (
                <span
                  style={{
                    flexShrink: 0,
                    marginTop: 1,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: "var(--bg-deep)",
                    color: "var(--ink-mute)",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {opt.kategori}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
