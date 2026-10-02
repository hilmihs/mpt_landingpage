import { redirect } from "next/navigation";
import { Download, Inbox } from "lucide-react";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { signedAudioUrl } from "@/lib/storage";
import { DAR_SYAFII, LEVELS } from "@/lib/hits-dar-syafii";
import { countBelumDijawab } from "@/lib/hits-tanya";
import { HitsTabs } from "@/components/admin/hits/HitsTabs";
import { PenilaianRekaman } from "@/components/admin/hits/PenilaianRekaman";

export const dynamic = "force-dynamic";

// Sama dengan lifecycle rule bucket; setelah ini objek rekamannya sudah hilang.
const RETENSI_HARI = DAR_SYAFII.retensiHari;

interface Row {
  id: string;
  created_at: Date;
  email: string;
  nama: string;
  /** Hanya pendaftar sebelum 30 Sep 2026; formulir tidak lagi memintanya. */
  nama_anak: string | null;
  kelas_anak: string | null;
  nomor_wa: string;
  usia: number;
  kota: string;
  jadwal: string;
  level: string;
  /** Kelas sebenarnya: Lanjutan yang dinilai buta huruf jadi Dasar (migrasi 0015). */
  level_penempatan: string;
  lahn_jaliy: number | null;
  lahn_khofi: number | null;
  buta_huruf: boolean | null;
  penilaian_keterangan: string | null;
  dinilai_at: Date | null;
  dinilai_oleh: string | null;
  /** null untuk level yang mendaftar tanpa rekaman (selain HITS Lanjutan). */
  audio_path: string | null;
  audio_duration_sec: string | null;
  audio_sumber: string | null;
  wa_sent_at: Date | null;
  wa_error: string | null;
  audio_masih_ada: boolean;
}

async function fetchRows(): Promise<Row[]> {
  return sql<Row[]>`
    SELECT id, created_at, email, nama, nama_anak, kelas_anak, nomor_wa, usia, kota, jadwal, level,
           level_penempatan, lahn_jaliy, lahn_khofi, buta_huruf, penilaian_keterangan,
           dinilai_at, dinilai_oleh, audio_path, audio_duration_sec, audio_sumber, wa_sent_at, wa_error,
           created_at > now() - make_interval(days => ${RETENSI_HARI}) AS audio_masih_ada
      FROM hits_pendaftaran
     WHERE program = ${DAR_SYAFII.program}
       AND angkatan = ${DAR_SYAFII.angkatan}
     ORDER BY created_at DESC
  `;
}

function durasi(sec: string | null): string {
  if (sec === null) return "";
  const t = Math.round(Number(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function countBy<T>(list: T[], key: (x: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const x of list) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const FILTER = [
  { id: "semua", label: "Semua" },
  { id: "belum", label: "Belum dinilai" },
  { id: "buta", label: "Buta Huruf" },
  { id: "tidak", label: "Tidak Buta Huruf/Pemula" },
] as const;
type FilterId = (typeof FILTER)[number]["id"];

function lolosFilter(r: Row, f: FilterId): boolean {
  if (f === "semua") return true;
  // Yang bisa dinilai hanya yang berekaman; filter penilaian menyaring sisanya.
  if (!r.audio_path) return false;
  if (f === "belum") return r.buta_huruf === null;
  if (f === "buta") return r.buta_huruf === true;
  return r.buta_huruf === false;
}

export default async function HitsDarSyafiiAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ nilai?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const { nilai } = await searchParams;
  const filter: FilterId = FILTER.some((f) => f.id === nilai) ? (nilai as FilterId) : "semua";

  const [semua, belumDijawab] = await Promise.all([fetchRows(), countBelumDijawab()]);
  const rows = semua.filter((r) => lolosFilter(r, filter));
  const berekaman = semua.filter((r) => r.audio_path);
  const belumDinilai = berekaman.filter((r) => r.buta_huruf === null).length;
  const urls = await Promise.all(
    rows.map((r) =>
      r.audio_path && r.audio_masih_ada ? signedAudioUrl(r.audio_path, 3600).catch(() => null) : null,
    ),
  );
  const levelNama = new Map<string, string>(LEVELS.map((l) => [l.id, l.nama]));
  const perJadwal = countBy(semua, (r) => r.jadwal);
  const perLevel = countBy(semua, (r) => levelNama.get(r.level) ?? r.level);
  const perPenempatan = countBy(semua, (r) => levelNama.get(r.level_penempatan) ?? r.level_penempatan);

  return (
    <div style={{ maxWidth: 1280 }}>
      <header
        style={{
          marginBottom: 22,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
              marginBottom: 6,
            }}
          >
            Pendaftaran · {DAR_SYAFII.angkatanLabel}
          </div>
          <h1
            className="font-display"
            style={{ fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 800, margin: 0, letterSpacing: "-0.025em" }}
          >
            {DAR_SYAFII.nama}
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "6px 0 0", maxWidth: 640 }}>
            {semua.length} pendaftar, {berekaman.length} berekaman ({belumDinilai} belum dinilai).
            Rekaman terhapus otomatis {RETENSI_HARI} hari
            setelah dikirim — dengarkan sebelum itu. Formulir publik:{" "}
            <a href="/daftar-hits/dar-syafii" target="_blank" style={{ color: "var(--accent-deep)" }}>
              /daftar-hits/dar-syafii
            </a>
          </p>
        </div>
        {semua.length > 0 && (
          <a
            href="/api/admin/hits-dar-syafii/csv"
            className="btn-mpt btn-mpt-primary"
            style={{ minHeight: 42, padding: "0 16px", fontSize: 13, textDecoration: "none" }}
          >
            <Download size={15} strokeWidth={2.4} />
            Unduh CSV
          </a>
        )}
      </header>

      <HitsTabs aktif="pendaftar" belumDijawab={belumDijawab} />

      {semua.length === 0 ? (
        <div className="card-mpt" style={{ padding: "48px 28px", textAlign: "center" }}>
          <Inbox size={28} style={{ color: "var(--accent)", marginBottom: 12 }} />
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>Belum ada pendaftar.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginBottom: 18 }}>
            <Tally title="Per level (pilihan pendaftar)" items={perLevel} />
            <Tally title="Per kelas penempatan" items={perPenempatan} />
            <Tally title="Per jam belajar" items={perJadwal} />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {FILTER.map((f) => {
              const on = f.id === filter;
              return (
                <a
                  key={f.id}
                  href={f.id === "semua" ? "?" : `?nilai=${f.id}`}
                  aria-current={on ? "page" : undefined}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: 700,
                    textDecoration: "none",
                    border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`,
                    background: on ? "color-mix(in oklab, var(--accent), transparent 88%)" : "transparent",
                    color: on ? "var(--accent-deep)" : "var(--ink-soft)",
                  }}
                >
                  {f.label}
                </a>
              );
            })}
          </div>

          <div className="card-mpt" style={{ padding: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1320 }}>
              <thead>
                <tr style={{ background: "var(--surface-soft)" }}>
                  <Th>Waktu</Th>
                  <Th>Nama</Th>
                  <Th>WhatsApp</Th>
                  <Th>Usia · Kota</Th>
                  <Th>Jam belajar</Th>
                  <Th>Level</Th>
                  <Th>Rekaman</Th>
                  <Th>Penilaian lajnah</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: "28px 14px", textAlign: "center", fontSize: 13, color: "var(--ink-mute)" }}>
                      Tidak ada pendaftar untuk filter ini.
                    </td>
                  </tr>
                )}
                {rows.map((r, i) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--line)", verticalAlign: "top" }}>
                    <Td>
                      {r.created_at.toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "Asia/Jakarta",
                      })}
                    </Td>
                    <Td>
                      <div style={{ fontWeight: 700, color: "var(--ink)" }}>{r.nama}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{r.email}</div>
                      {r.nama_anak && (
                        <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                          anak: {r.nama_anak} · kelas {r.kelas_anak}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <a
                        href={`https://wa.me/${r.nomor_wa}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--accent-deep)", fontWeight: 600 }}
                      >
                        {r.nomor_wa}
                      </a>
                      <div style={{ fontSize: 11, color: r.wa_sent_at ? "var(--success)" : "var(--ink-mute)" }}>
                        {r.wa_sent_at ? "konfirmasi terkirim" : r.wa_error ? "konfirmasi gagal" : "konfirmasi belum dikirim"}
                      </div>
                    </Td>
                    <Td>
                      {r.usia} th
                      <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{r.kota}</div>
                    </Td>
                    <Td>{r.jadwal}</Td>
                    <Td>
                      {levelNama.get(r.level) ?? r.level}
                      {r.level_penempatan !== r.level && (
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)" }}>
                          → {levelNama.get(r.level_penempatan) ?? r.level_penempatan}
                        </div>
                      )}
                    </Td>
                    <Td>
                      {urls[i] ? (
                        <>
                          <audio controls preload="none" src={urls[i]!} style={{ width: 240, height: 34 }} />
                          <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                            {r.audio_sumber === "unggah" ? "berkas unggahan" : "direkam di halaman"}
                            {r.audio_duration_sec ? ` · ${durasi(r.audio_duration_sec)}` : ""}
                          </div>
                        </>
                      ) : !r.audio_path ? (
                        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                          tanpa rekaman (bukan HITS Lanjutan)
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                          terhapus (lewat {RETENSI_HARI} hari)
                        </span>
                      )}
                    </Td>
                    <Td>
                      {r.audio_path ? (
                        <PenilaianRekaman
                          id={r.id}
                          level={r.level}
                          awal={{
                            lahn_jaliy: r.lahn_jaliy,
                            lahn_khofi: r.lahn_khofi,
                            buta_huruf: r.buta_huruf,
                            keterangan: r.penilaian_keterangan,
                            dinilai_oleh: r.dinilai_oleh,
                            dinilai_label: r.dinilai_at
                              ? r.dinilai_at.toLocaleString("id-ID", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                  timeZone: "Asia/Jakarta",
                                })
                              : null,
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Tally({ title, items }: { title: string; items: [string, number][] }) {
  return (
    <div className="card-mpt" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 8 }}>
        {title}
      </div>
      {items.map(([k, n]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "3px 0" }}>
          <span style={{ color: "var(--ink-soft)" }}>{k}</span>
          <b>{n}</b>
        </div>
      ))}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "10px 14px",
        textAlign: "left",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-mute)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--ink-soft)" }}>{children}</td>;
}
