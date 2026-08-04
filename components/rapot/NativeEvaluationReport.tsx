import { CheckCircle2, ClipboardCheck, Info, Target, UserCheck } from "lucide-react";
import { RadarChart } from "@/components/rapot/RadarChart";
import { AL_FATIHAH_SEGMENTS } from "@/lib/arabic";
import { parseOption } from "@/lib/teacher-eval/catalog";
import { bandFor } from "@/lib/teacher-eval/scoring";
import {
  INDICATOR_KEYS,
  INDICATOR_LABEL,
  SEGMENT_KEYS,
  type EvaluationAyat,
  type IndicatorKey,
  type SegmentKey,
  type Tone,
} from "@/lib/teacher-eval/types";

/**
 * Rapot peserta untuk penilaian yang lahir di portal ini (source = 'native').
 *
 * Bedanya dengan TeacherEvaluationReport: di sana yang tersimpan hanya lima skor
 * indikator hasil salinan dari panel luar, sedangkan di sini temuan mentah per
 * segmen ikut tersimpan. Karena itu peserta bisa dibawa turun sampai ke kalimat
 * kesalahannya — bukan cuma diberi angka.
 *
 * Skalanya 1-10 dan sepenuhnya milik pengajar. Skor AI tidak boleh muncul di
 * permukaan ini dalam bentuk apa pun.
 */

export interface NativeIndicatorView {
  key: IndicatorKey;
  score: number | null;
  mutu: string | null;
}

export interface NativeEvaluationView {
  pemeriksa: string | null;
  kegiatan: string | null;
  /** ISO string; dirender jadi tanggal Indonesia di sini. */
  createdAt: string | null;
  rekomendasiProgram: string | null;
  scoreTen: number | null;
  labelMin: string | null;
  ayat: EvaluationAyat | null;
  perSegment: Partial<Record<SegmentKey, number>>;
  indikator: NativeIndicatorView[];
}

/**
 * Nada band dipetakan ke token warna repo.
 *
 * "warning-orange" jatuh ke terracotta, bukan ke --warning yang sama dengan
 * band di bawahnya: dua band berurutan yang berwarna identik membuat peserta
 * mengira nilainya tidak bergerak.
 */
const TONE_COLOR: Record<Tone, string> = {
  danger: "var(--danger)",
  warning: "var(--warning)",
  "warning-orange": "var(--terracotta)",
  info: "var(--indikator-mad)",
  success: "var(--success)",
};

/**
 * Peserta tidak pernah membaca istilah "jaliy"/"khafiy".
 *
 * Keduanya istilah kajian yang tidak berarti apa-apa bagi orang yang baru
 * belajar, dan "khafiy" terdengar sepele padahal tetap perlu dibenahi.
 */
const SEVERITY_LABEL = {
  khafiy: "Perlu Diperhatikan",
  jaliy: "Fatal",
} as const;

const SEVERITY_COLOR = {
  khafiy: "var(--warning)",
  jaliy: "var(--danger)",
} as const;

/**
 * Yang ringan ditampilkan lebih dulu, baru yang fatal.
 *
 * Membuka daftar dengan kesalahan terberat membuat peserta berhenti membaca di
 * baris pertama. Urutan menanjak ini menahannya cukup lama untuk sampai ke
 * bagian yang paling perlu ia perbaiki.
 */
const SEVERITY_ORDER = ["khafiy", "jaliy"] as const;

function colorFor(score: number | null): string {
  return score == null ? "var(--ink-mute)" : TONE_COLOR[bandFor(score).tone];
}

function tanggalIndo(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function NativeEvaluationReport({
  nama,
  ev,
}: {
  nama: string;
  ev: NativeEvaluationView;
}) {
  const band = ev.scoreTen != null ? bandFor(ev.scoreTen) : null;
  const bandColor = band ? TONE_COLOR[band.tone] : "var(--ink-mute)";
  const tanggal = tanggalIndo(ev.createdAt);

  // Skor kepala adalah skor segmen TERENDAH. Daftar ini yang menjawab
  // pertanyaan "kenapa angkanya segitu" tanpa peserta harus membandingkan
  // delapan kartu satu per satu.
  const skorSegmen = SEGMENT_KEYS.map((key) => ev.perSegment[key]);
  const segmenLengkap = skorSegmen.every((s) => typeof s === "number");
  const terlemah =
    ev.scoreTen != null
      ? SEGMENT_KEYS.filter((key) => ev.perSegment[key] === ev.scoreTen)
      : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <IdentitasCard
        nama={nama}
        kegiatan={ev.kegiatan}
        pemeriksa={ev.pemeriksa}
        tanggal={tanggal}
        rekomendasi={ev.rekomendasiProgram}
      />

      <SkorCard
        scoreTen={ev.scoreTen}
        judul={ev.labelMin ?? band?.title ?? null}
        deskripsi={band?.description ?? null}
        warna={bandColor}
      />

      {terlemah.length > 0 && ev.scoreTen != null && (
        <SegmenTerlemahCard
          segmen={terlemah}
          scoreTen={ev.scoreTen}
          warna={bandColor}
        />
      )}

      {segmenLengkap && (
        <div className="card-mpt" style={{ padding: "22px 18px 16px" }}>
          <KartuJudul>Peta Bacaan per Bagian</KartuJudul>
          <p style={paragrafStyle}>
            Makin jauh titiknya dari pusat, makin baik bacaan Anda di bagian itu.
          </p>
          <RadarChart
            axes={SEGMENT_KEYS.map((key) => ({
              label: AL_FATIHAH_SEGMENTS[key]!.nomor,
              value: ev.perSegment[key] ?? 0,
            }))}
            max={10}
          />
        </div>
      )}

      {ev.ayat && <RincianSegmen ayat={ev.ayat} perSegment={ev.perSegment} />}

      <IndikatorRingkas indikator={ev.indikator} />
    </div>
  );
}

function IdentitasCard({
  nama,
  kegiatan,
  pemeriksa,
  tanggal,
  rekomendasi,
}: {
  nama: string;
  kegiatan: string | null;
  pemeriksa: string | null;
  tanggal: string | null;
  rekomendasi: string | null;
}) {
  return (
    <div className="card-mpt" style={{ padding: "22px 20px" }}>
      <div
        className="pill"
        style={{
          background: "color-mix(in oklab, var(--accent), transparent 86%)",
          color: "var(--accent-deep)",
          marginBottom: 14,
        }}
      >
        <ClipboardCheck size={13} strokeWidth={2.4} />
        {kegiatan ?? "Assessment Al-Fatihah"}
      </div>

      <h1
        className="font-display"
        style={{
          fontSize: "clamp(22px, 5vw, 28px)",
          fontWeight: 800,
          margin: "0 0 10px",
          letterSpacing: "-0.025em",
          lineHeight: 1.15,
        }}
      >
        {nama}
      </h1>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "6px 14px",
          fontSize: 12.5,
          color: "var(--ink-mute)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <UserCheck size={14} strokeWidth={2.2} />
          Diperiksa oleh {pemeriksa ?? "pengajar Muhajir Project Tilawah"}
        </span>
        {tanggal && <span>{tanggal}</span>}
      </div>

      {rekomendasi && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid var(--line)",
            fontSize: 13,
            color: "var(--ink-soft)",
            lineHeight: 1.6,
          }}
        >
          Pengajar menyarankan Anda melanjutkan ke{" "}
          <strong style={{ color: "var(--ink)" }}>{rekomendasi}</strong>.
        </div>
      )}
    </div>
  );
}

function SkorCard({
  scoreTen,
  judul,
  deskripsi,
  warna,
}: {
  scoreTen: number | null;
  judul: string | null;
  deskripsi: string | null;
  warna: string;
}) {
  if (scoreTen == null) {
    return (
      <div className="card-mpt" style={{ padding: "24px 20px" }}>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0, lineHeight: 1.65 }}>
          Penilaian sudah masuk, namun skornya belum tersedia. Silakan buka
          kembali halaman ini beberapa saat lagi.
        </p>
      </div>
    );
  }

  return (
    <div
      className="card-mpt"
      style={{
        padding: "26px 20px 20px",
        // Latar ditarik dari warna band supaya kartu ini terbaca lebih dulu
        // daripada kartu lain di halaman, tanpa perlu ukuran yang berlebihan.
        background: `color-mix(in oklab, ${warna}, var(--paper) 92%)`,
        borderColor: `color-mix(in oklab, ${warna}, transparent 70%)`,
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
        <span
          className="font-display"
          style={{
            fontSize: "clamp(48px, 14vw, 64px)",
            fontWeight: 800,
            lineHeight: 1,
            color: warna,
            letterSpacing: "-0.04em",
          }}
        >
          {scoreTen}
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--ink-mute)" }}>/10</span>
      </div>

      {judul && (
        <div
          className="font-display"
          style={{ fontSize: 19, fontWeight: 800, margin: "10px 0 8px", letterSpacing: "-0.02em" }}
        >
          {judul}
        </div>
      )}

      {deskripsi && (
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            lineHeight: 1.7,
            maxWidth: 460,
            margin: "0 auto",
          }}
        >
          {deskripsi}
        </p>
      )}

      {/* Cara baca skor ditulis terbuka, bukan disembunyikan di balik tooltip:
          di layar HP tooltip nyaris tidak pernah tersentuh, padahal justru
          angka inilah yang paling sering disalahpahami. */}
      <div
        style={{
          display: "flex",
          gap: 9,
          alignItems: "flex-start",
          textAlign: "left",
          marginTop: 18,
          paddingTop: 16,
          borderTop: "1px solid var(--line)",
          fontSize: 12.5,
          color: "var(--ink-mute)",
          lineHeight: 1.65,
        }}
      >
        <Info size={15} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Skor berskala 1-10 dan diambil dari bagian yang <strong>paling perlu
          diperbaiki</strong> — bukan rata-rata. Satu kesalahan fatal di satu
          bagian sudah cukup menahan angkanya, karena kesalahan seperti itu
          mengubah makna bacaan.
        </span>
      </div>
    </div>
  );
}

function SegmenTerlemahCard({
  segmen,
  scoreTen,
  warna,
}: {
  segmen: SegmentKey[];
  scoreTen: number;
  warna: string;
}) {
  const nama = segmen.map((key) => AL_FATIHAH_SEGMENTS[key]!.nomor);
  const daftar =
    nama.length === 1
      ? nama[0]!
      : `${nama.slice(0, -1).join(", ")} dan ${nama[nama.length - 1]!}`;

  // Skor 10 berarti tidak ada satu pun temuan; menyebutnya "paling perlu
  // diperbaiki" akan terdengar seperti kesalahan sistem.
  const sempurna = scoreTen >= 10;

  return (
    <div
      className="card-mpt"
      style={{
        padding: "18px 18px",
        display: "flex",
        gap: 13,
        alignItems: "flex-start",
        borderLeft: `3px solid ${warna}`,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          flexShrink: 0,
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
          background: `color-mix(in oklab, ${warna}, transparent 86%)`,
          color: warna,
        }}
      >
        <Target size={17} strokeWidth={2.3} />
      </div>
      <div style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        {sempurna ? (
          <>
            Masya Allah, seluruh bagian bacaan Anda bersih dari catatan —
            termasuk {daftar}. Jaga terus bacaan ini.
          </>
        ) : (
          <>
            Skor Anda mengikuti bagian yang paling perlu diperbaiki:{" "}
            <strong style={{ color: "var(--ink)" }}>{daftar}</strong>. Perbaiki
            bagian itu lebih dulu, dan angkanya akan ikut naik.
          </>
        )}
      </div>
    </div>
  );
}

function RincianSegmen({
  ayat,
  perSegment,
}: {
  ayat: EvaluationAyat;
  perSegment: Partial<Record<SegmentKey, number>>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ padding: "6px 2px 0" }}>
        <KartuJudul>Rincian per Bagian</KartuJudul>
        <p style={{ ...paragrafStyle, marginBottom: 0 }}>
          Catatan pengajar untuk tiap bagian Al-Fatihah, apa adanya.
        </p>
      </div>

      {SEGMENT_KEYS.map((key, i) => (
        <SegmenCard
          key={key}
          nomor={i + 1}
          meta={AL_FATIHAH_SEGMENTS[key]!}
          score={perSegment[key] ?? null}
          temuan={ayat[key]}
        />
      ))}
    </div>
  );
}

function SegmenCard({
  nomor,
  meta,
  score,
  temuan,
}: {
  nomor: number;
  meta: { nomor: string; arabic: string; transliterasi: string };
  score: number | null;
  temuan: { jaliy: string[]; khafiy: string[] };
}) {
  const warna = colorFor(score);
  const bersih = temuan.jaliy.length === 0 && temuan.khafiy.length === 0;

  return (
    <div className="card-mpt" style={{ padding: "16px 16px 14px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            flexShrink: 0,
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            background: "color-mix(in oklab, var(--accent), transparent 86%)",
            color: "var(--accent-deep)",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {nomor}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700 }}>
          {meta.nomor}
        </span>
        <span style={{ fontSize: 15, fontWeight: 800, color: warna, whiteSpace: "nowrap" }}>
          {score ?? "—"}
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)" }}>/10</span>
        </span>
      </div>

      <p
        className="font-arabic"
        dir="rtl"
        lang="ar"
        style={{
          fontSize: "clamp(19px, 5.2vw, 24px)",
          lineHeight: 2.15,
          textAlign: "right",
          margin: "0 0 4px",
          color: "var(--ink)",
          wordSpacing: "0.1em",
        }}
      >
        {meta.arabic}
      </p>
      <p
        style={{
          fontSize: 11.5,
          fontStyle: "italic",
          color: "var(--ink-mute)",
          margin: "0 0 12px",
          lineHeight: 1.5,
        }}
      >
        {meta.transliterasi}
      </p>

      {bersih ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingTop: 10,
            borderTop: "1px solid var(--line)",
            fontSize: 12.5,
            color: "var(--success)",
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={15} strokeWidth={2.4} />
          Tidak ada catatan pada bagian ini.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--line)",
          }}
        >
          {/* Kunci diambil dari label yang dilihat peserta, bukan dari nama
              severity: nama internal ikut terbawa ke payload RSC dan bisa
              terbaca dari "view source", padahal istilah jaliy/khafiy memang
              tidak untuk dibaca peserta. */}
          {SEVERITY_ORDER.map((severity) =>
            temuan[severity].length === 0 ? null : (
              <TemuanGroup
                key={SEVERITY_LABEL[severity]}
                severity={severity}
                items={temuan[severity]}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function TemuanGroup({
  severity,
  items,
}: {
  severity: "jaliy" | "khafiy";
  items: string[];
}) {
  const warna = SEVERITY_COLOR[severity];

  return (
    <div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: warna,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: warna,
            flexShrink: 0,
          }}
        />
        {SEVERITY_LABEL[severity]} · {items.length}
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((raw) => {
          // Tag "[Kategori]" di ujung kalimat adalah metadata instrumen, bukan
          // bagian dari catatan — dipisah supaya kalimatnya enak dibaca.
          const { text, indicator } = parseOption(raw);
          return (
            <li
              key={raw}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                gap: "4px 8px",
                fontSize: 13,
                color: "var(--ink-soft)",
                lineHeight: 1.6,
                paddingLeft: 15,
                position: "relative",
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  top: 8,
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: `color-mix(in oklab, ${warna}, transparent 35%)`,
                }}
              />
              <span>{text}</span>
              {indicator && (
                <span
                  style={{
                    flexShrink: 0,
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: "var(--bg-deep)",
                    color: "var(--ink-mute)",
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {INDICATOR_LABEL[indicator]}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IndikatorRingkas({ indikator }: { indikator: NativeIndicatorView[] }) {
  // Aspek yang tidak dinilai disembunyikan, bukan ditampilkan sebagai nol —
  // nol terbaca sebagai "sangat buruk", padahal artinya "tidak ada datanya".
  const terisi = indikator.filter((i) => i.score != null);
  if (terisi.length === 0) return null;

  const urut = INDICATOR_KEYS.map((key) => terisi.find((i) => i.key === key)).filter(
    (i): i is NativeIndicatorView => i != null,
  );

  return (
    <div className="card-mpt" style={{ padding: "22px 18px 18px" }}>
      <KartuJudul>Lima Aspek Penilaian</KartuJudul>
      <p style={paragrafStyle}>
        Rangkuman seluruh catatan di atas, dikelompokkan menurut jenisnya.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {urut.map((i) => {
          const warna = colorFor(i.score);
          const persen = i.score != null ? Math.max(0, Math.min(100, i.score * 10)) : 0;
          return (
            <div key={i.key}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  {INDICATOR_LABEL[i.key]}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: warna, whiteSpace: "nowrap" }}>
                  {i.score}
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-mute)" }}>
                    /10
                  </span>
                </span>
              </div>

              <div
                style={{
                  height: 7,
                  borderRadius: 999,
                  background: "var(--bg-deep)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${persen}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: warna,
                  }}
                />
              </div>

              {i.mutu && (
                <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 5 }}>
                  {i.mutu}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KartuJudul({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-display"
      style={{
        fontSize: 16,
        fontWeight: 800,
        margin: "0 0 4px",
        letterSpacing: "-0.02em",
      }}
    >
      {children}
    </h2>
  );
}

const paragrafStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: "var(--ink-mute)",
  lineHeight: 1.6,
  margin: "0 0 16px",
};
