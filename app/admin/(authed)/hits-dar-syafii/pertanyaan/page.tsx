import { redirect } from "next/navigation";
import { ExternalLink, Inbox } from "lucide-react";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { DAR_SYAFII, tanyaPath } from "@/lib/hits-dar-syafii";
import { HitsTabs } from "@/components/admin/hits/HitsTabs";
import { JawabPertanyaan } from "@/components/admin/hits/JawabPertanyaan";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  slug: string;
  created_at: Date;
  nama: string;
  nomor_wa: string;
  pertanyaan: string;
  jawaban: string | null;
  dijawab_at: Date | null;
  dijawab_oleh: string | null;
  tampil_faq: boolean;
  wa_sent_at: Date | null;
  wa_error: string | null;
}

const waktu = (d: Date) =>
  d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export default async function HitsPertanyaanAdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  // Belum dijawab di atas, yang terlama dulu (paling lama menunggu); lalu
  // yang sudah dijawab, terbaru dulu.
  const rows = await sql<Row[]>`
    SELECT id, slug, created_at, nama, nomor_wa, pertanyaan, jawaban, dijawab_at,
           dijawab_oleh, tampil_faq, wa_sent_at, wa_error
      FROM hits_pertanyaan
     WHERE program = ${DAR_SYAFII.program}
     ORDER BY (jawaban IS NULL) DESC,
              CASE WHEN jawaban IS NULL THEN created_at END ASC,
              dijawab_at DESC
  `;
  const belum = rows.filter((r) => r.jawaban === null).length;

  return (
    <div style={{ maxWidth: 920 }}>
      <header style={{ marginBottom: 14 }}>
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
          Tanya admin
        </div>
        <h1
          className="font-display"
          style={{ fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 800, margin: 0, letterSpacing: "-0.025em" }}
        >
          {DAR_SYAFII.nama}
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "6px 0 0", maxWidth: 640 }}>
          {rows.length} pertanyaan, {belum} belum dijawab. Jawaban pertama langsung dikabarkan ke
          penanya lewat WhatsApp berisi tautan jawabannya.
        </p>
      </header>

      <HitsTabs aktif="pertanyaan" belumDijawab={belum} />

      {rows.length === 0 ? (
        <div className="card-mpt" style={{ padding: "48px 28px", textAlign: "center" }}>
          <Inbox size={28} style={{ color: "var(--accent)", marginBottom: 12 }} />
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>Belum ada pertanyaan.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((r) => (
            <article
              key={r.id}
              className="card-mpt"
              style={{
                padding: "16px 18px",
                borderLeft: `4px solid ${r.jawaban === null ? "var(--warning)" : "var(--success)"}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "4px 14px",
                  alignItems: "baseline",
                  fontSize: 12,
                  color: "var(--ink-mute)",
                  marginBottom: 8,
                }}
              >
                <b style={{ fontSize: 14, color: "var(--ink)" }}>{r.nama}</b>
                <a
                  href={`https://wa.me/${r.nomor_wa}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--accent-deep)", fontWeight: 600 }}
                >
                  {r.nomor_wa}
                </a>
                <span>{waktu(r.created_at)}</span>
                <a
                  href={tanyaPath(r.slug)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--accent-deep)", display: "inline-flex", gap: 4, alignItems: "center" }}
                >
                  halaman penanya <ExternalLink size={11} />
                </a>
              </div>

              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "var(--ink)",
                  whiteSpace: "pre-line",
                  overflowWrap: "anywhere",
                }}
              >
                {r.pertanyaan}
              </p>

              <div style={{ paddingTop: 12, borderTop: "1px dashed var(--line)" }}>
                <JawabPertanyaan
                  q={{
                    id: r.id,
                    jawaban: r.jawaban,
                    tampil_faq: r.tampil_faq,
                    wa_sent: r.wa_sent_at !== null,
                    wa_error: r.wa_error,
                  }}
                />
                {r.jawaban !== null && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-mute)" }}>
                    Dijawab {r.dijawab_oleh}
                    {r.dijawab_at ? ` · ${waktu(r.dijawab_at)}` : ""}
                    {r.tampil_faq ? " · tampil di FAQ" : ""}
                    {" · "}
                    {r.wa_sent_at ? (
                      <span style={{ color: "var(--success)" }}>WA terkirim</span>
                    ) : r.wa_error ? (
                      <span style={{ color: "var(--danger)" }}>WA gagal: {r.wa_error}</span>
                    ) : (
                      "WA belum terkirim"
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
