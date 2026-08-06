import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  fetchPasangan,
  ringkas,
  type Kecocokan,
} from "@/lib/admin/pembanding-query";
import { INDICATOR_LABEL } from "@/lib/teacher-eval/types";
import { AL_FATIHAH_SEGMENTS } from "@/lib/arabic";

/**
 * Seberapa dekat penilaian mesin dengan penilaian pengajar.
 *
 * Inilah satu-satunya keluaran yang diharapkan dari menjalankan mesin secara
 * paralel Agustus–Desember. Halaman ini baru bisa ada setelah kedua penilaian
 * memakai instrumen yang sama; sebelumnya yang tersedia hanya dua angka pada
 * skala berbeda yang tidak boleh disandingkan.
 *
 * Internal, admin saja. Tidak pernah ditampilkan ke peserta maupun pengajar.
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pembanding Mesin — Admin",
  robots: { index: false, follow: false },
};

export default async function PembandingPage() {
  const pasangan = await fetchPasangan().catch((err) => {
    console.error("[admin.pembanding] gagal:", (err as Error).message);
    return null;
  });

  if (!pasangan) {
    return (
      <div style={{ padding: "24px 0" }}>
        <Kembali />
        <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          Gagal membaca data pembanding. Kemungkinan migrasi 0010 belum
          dijalankan.
        </p>
      </div>
    );
  }

  const r = ringkas(pasangan);

  return (
    <div style={{ padding: "24px 0" }}>
      <Kembali />

      <h1 className="font-display" style={{ fontSize: 24, margin: "0 0 6px" }}>
        Pembanding Mesin
      </h1>
      <p
        style={{
          fontSize: 13,
          color: "var(--ink-soft)",
          margin: "0 0 20px",
          lineHeight: 1.6,
          maxWidth: 620,
        }}
      >
        Semua angka dihitung dari rekaman yang punya nilai mesin{" "}
        <strong>dan</strong> nilai pengajar. Keduanya memakai instrumen yang sama
        — delapan segmen, lima indikator, skala 1-10, skor kepala dari segmen
        terlemah — sehingga selisihnya berarti. Baris mock tidak ikut dihitung.
      </p>

      {r.total === 0 ? (
        <div className="card-mpt" style={{ padding: "18px 20px" }}>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.7 }}>
            Belum ada satu pun rekaman yang dinilai oleh keduanya. Yang
            dibutuhkan: ML server hidup (<code>ML_SERVER_URL</code> terisi) dan
            pengajar sudah mengisi penilaian untuk rekaman yang sama. Selama
            model belum jalan, halaman ini memang kosong — bukan error.
          </p>
        </div>
      ) : (
        <>
          {!r.sifaJalan && <PeringatanSifa />}

          <Blok judul="Skor kepala">
            <RingkasKecocokan cocok={r.kepala} />
            <Sebaran data={r.sebaran} total={r.total} />
          </Blok>

          <Blok judul="Per indikator">
            <TabelKecocokan
              baris={r.perIndikator.map((x) => ({
                label: INDICATOR_LABEL[x.key],
                cocok: x.cocok,
              }))}
            />
          </Blok>

          <Blok judul="Per segmen">
            <TabelKecocokan
              baris={r.perSegmen.map((x) => ({
                label: AL_FATIHAH_SEGMENTS[x.key]?.nomor ?? x.key,
                cocok: x.cocok,
              }))}
            />
          </Blok>

          <p style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 18, lineHeight: 1.6 }}>
            {r.total} pasangan · model: {r.model.join(", ") || "—"}
          </p>
        </>
      )}
    </div>
  );
}

function Kembali() {
  return (
    <Link
      href="/admin/assessment"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: "var(--ink-mute)",
        textDecoration: "none",
        marginBottom: 14,
      }}
    >
      <ArrowLeft size={14} /> Daftar assessment
    </Link>
  );
}

/**
 * Sampai head sifa model jalan, mesin buta terhadap lahn khafiy sepenuhnya.
 * Tanpa peringatan ini, bias positif akan terbaca sebagai "mesin cenderung
 * longgar" — padahal sebagian besarnya berasal dari seluruh kategori kesalahan
 * yang memang tidak bisa dilihatnya.
 */
function PeringatanSifa() {
  return (
    <div
      className="card-mpt"
      style={{
        padding: "14px 18px",
        marginBottom: 18,
        borderColor: "var(--danger)",
      }}
    >
      <p style={{ fontSize: 13, margin: 0, lineHeight: 1.7 }}>
        <strong>Baca angka di bawah dengan hati-hati.</strong> Head <em>sifa</em>{" "}
        model belum jalan, sehingga mesin tidak bisa mendeteksi lahn khafiy sama
        sekali — jumlahnya selalu nol. Padahal 57 dari 110 butir instrumen
        pengajar adalah khafiy. Konsekuensinya, skor mesin cenderung lebih tinggi
        daripada pengajar secara sistematis, dan bias positif di bawah{" "}
        <strong>bukan</strong> bukti bahwa mesin longgar dalam menilai.
      </p>
    </div>
  );
}

function Blok({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section className="card-mpt" style={{ padding: "16px 20px", marginBottom: 16 }}>
      <h2
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          margin: "0 0 12px",
        }}
      >
        {judul}
      </h2>
      {children}
    </section>
  );
}

function RingkasKecocokan({ cocok }: { cocok: Kecocokan }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 26 }}>
      <Angka
        besar={`${cocok.persisPersen.toFixed(0)}%`}
        label="sama persis"
        catatan={`${cocok.n} pasangan`}
      />
      <Angka besar={`${cocok.dalamDuaPersen.toFixed(0)}%`} label="selisih ≤ 2" />
      <Angka
        besar={tanda(cocok.biasRata)}
        label="bias rata-rata"
        catatan={
          cocok.biasRata > 0
            ? "mesin lebih longgar"
            : cocok.biasRata < 0
              ? "mesin lebih ketat"
              : "seimbang"
        }
      />
      <Angka besar={cocok.selisihRata.toFixed(1)} label="jarak rata-rata" />
    </div>
  );
}

function tanda(n: number): string {
  const s = n.toFixed(1);
  return n > 0 ? `+${s}` : s;
}

function Angka({
  besar,
  label,
  catatan,
}: {
  besar: string;
  label: string;
  catatan?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{besar}</div>
      <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>{label}</div>
      {catatan && (
        <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>{catatan}</div>
      )}
    </div>
  );
}

/** Sebaran selisih. Batang sederhana — yang dicari adalah bentuk, bukan presisi. */
function Sebaran({
  data,
  total,
}: {
  data: { selisih: number; jumlah: number }[];
  total: number;
}) {
  const maks = Math.max(...data.map((d) => d.jumlah), 1);
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 8,
        }}
      >
        Sebaran selisih (mesin − pengajar)
      </div>
      {data.map((d) => (
        <div
          key={d.selisih}
          style={{
            display: "grid",
            gridTemplateColumns: "42px 1fr 60px",
            gap: 10,
            alignItems: "center",
            fontSize: 12,
            padding: "3px 0",
          }}
        >
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              textAlign: "right",
              fontWeight: d.selisih === 0 ? 700 : 400,
              color: d.selisih === 0 ? "var(--ink)" : "var(--ink-soft)",
            }}
          >
            {tandaBulat(d.selisih)}
          </span>
          <span
            style={{
              height: 10,
              borderRadius: 3,
              background: d.selisih === 0 ? "var(--success)" : "var(--line-strong)",
              width: `${(d.jumlah / maks) * 100}%`,
              minWidth: 3,
            }}
          />
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              color: "var(--ink-mute)",
              fontSize: 11,
            }}
          >
            {d.jumlah} · {((d.jumlah / total) * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function tandaBulat(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function TabelKecocokan({
  baris,
}: {
  baris: { label: string; cocok: Kecocokan }[];
}) {
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 60px 60px 60px 44px",
          gap: 8,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          paddingBottom: 6,
        }}
      >
        <span />
        <span style={{ textAlign: "right" }}>Persis</span>
        <span style={{ textAlign: "right" }}>≤ 2</span>
        <span style={{ textAlign: "right" }}>Bias</span>
        <span style={{ textAlign: "right" }}>n</span>
      </div>
      {baris.map((b) => (
        <div
          key={b.label}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 60px 60px 60px 44px",
            gap: 8,
            fontSize: 12,
            padding: "6px 0",
            borderTop: "1px solid var(--line)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>{b.label}</span>
          <span style={{ textAlign: "right" }}>
            {b.cocok.n ? `${b.cocok.persisPersen.toFixed(0)}%` : "—"}
          </span>
          <span style={{ textAlign: "right", color: "var(--ink-soft)" }}>
            {b.cocok.n ? `${b.cocok.dalamDuaPersen.toFixed(0)}%` : "—"}
          </span>
          <span
            style={{
              textAlign: "right",
              color: b.cocok.biasRata === 0 ? "var(--ink-mute)" : "var(--ink)",
            }}
          >
            {b.cocok.n ? tanda(b.cocok.biasRata) : "—"}
          </span>
          <span style={{ textAlign: "right", color: "var(--ink-mute)" }}>{b.cocok.n}</span>
        </div>
      ))}
    </div>
  );
}
