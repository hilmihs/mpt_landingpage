import { redirect } from "next/navigation";
import { Download, Inbox } from "lucide-react";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { signedAudioUrl } from "@/lib/storage";
import { DAR_SYAFII, LEVELS } from "@/lib/hits-dar-syafii";

export const dynamic = "force-dynamic";

// Sama dengan lifecycle rule bucket; setelah ini objek rekamannya sudah hilang.
const RETENSI_HARI = 7;

interface Row {
  id: string;
  created_at: Date;
  email: string;
  nama: string;
  nomor_wa: string;
  usia: number;
  kota: string;
  jadwal: string;
  level: string;
  audio_path: string;
  audio_duration_sec: string | null;
  audio_sumber: string;
  wa_sent_at: Date | null;
  wa_error: string | null;
  audio_masih_ada: boolean;
}

async function fetchRows(): Promise<Row[]> {
  return sql<Row[]>`
    SELECT id, created_at, email, nama, nomor_wa, usia, kota, jadwal, level,
           audio_path, audio_duration_sec, audio_sumber, wa_sent_at, wa_error,
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

export default async function HitsDarSyafiiAdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const rows = await fetchRows();
  const urls = await Promise.all(
    rows.map((r) =>
      r.audio_masih_ada ? signedAudioUrl(r.audio_path, 3600).catch(() => null) : null,
    ),
  );
  const levelNama = new Map<string, string>(LEVELS.map((l) => [l.id, l.nama]));
  const perJadwal = countBy(rows, (r) => r.jadwal);
  const perLevel = countBy(rows, (r) => levelNama.get(r.level) ?? r.level);

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
            {rows.length} pendaftar. Rekaman terhapus otomatis {RETENSI_HARI} hari
            setelah dikirim — dengarkan sebelum itu. Formulir publik:{" "}
            <a href="/daftar-hits/dar-syafii" target="_blank" style={{ color: "var(--accent-deep)" }}>
              /daftar-hits/dar-syafii
            </a>
          </p>
        </div>
        {rows.length > 0 && (
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

      {rows.length === 0 ? (
        <div className="card-mpt" style={{ padding: "48px 28px", textAlign: "center" }}>
          <Inbox size={28} style={{ color: "var(--accent)", marginBottom: 12 }} />
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>Belum ada pendaftar.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginBottom: 18 }}>
            <Tally title="Per level" items={perLevel} />
            <Tally title="Per jam belajar" items={perJadwal} />
          </div>

          <div className="card-mpt" style={{ padding: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
              <thead>
                <tr style={{ background: "var(--surface-soft)" }}>
                  <Th>Waktu</Th>
                  <Th>Nama</Th>
                  <Th>WhatsApp</Th>
                  <Th>Usia · Kota</Th>
                  <Th>Jam belajar</Th>
                  <Th>Level</Th>
                  <Th>Rekaman</Th>
                </tr>
              </thead>
              <tbody>
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
                    <Td>{levelNama.get(r.level) ?? r.level}</Td>
                    <Td>
                      {urls[i] ? (
                        <>
                          <audio controls preload="none" src={urls[i]!} style={{ width: 240, height: 34 }} />
                          <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                            {r.audio_sumber === "unggah" ? "berkas unggahan" : "direkam di halaman"}
                            {r.audio_duration_sec ? ` · ${durasi(r.audio_duration_sec)}` : ""}
                          </div>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                          terhapus (lewat {RETENSI_HARI} hari)
                        </span>
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
