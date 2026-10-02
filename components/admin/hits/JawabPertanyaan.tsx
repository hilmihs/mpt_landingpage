"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Send } from "lucide-react";

export interface PertanyaanAdmin {
  id: string;
  jawaban: string | null;
  tampil_faq: boolean;
  wa_sent: boolean;
  wa_error: string | null;
}

/**
 * Kotak jawaban admin untuk satu pertanyaan. Jawaban pertama langsung
 * mengirim kabar WhatsApp ke penanya; perbaikan sesudahnya tidak.
 */
export function JawabPertanyaan({ q }: { q: PertanyaanAdmin }) {
  const router = useRouter();
  const [edit, setEdit] = useState(q.jawaban === null);
  const [jawaban, setJawaban] = useState(q.jawaban ?? "");
  const [faq, setFaq] = useState(q.tampil_faq);
  const [busy, setBusy] = useState<null | "jawab" | "kirim_wa">(null);
  const [pesan, setPesan] = useState<{ ok: boolean; text: string } | null>(null);

  async function kirim(action: "jawab" | "kirim_wa") {
    setBusy(action);
    setPesan(null);
    try {
      const res = await fetch("/api/admin/hits-dar-syafii/pertanyaan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "jawab" ? { action, id: q.id, jawaban, tampil_faq: faq } : { action, id: q.id },
        ),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        wa_sent?: boolean;
        wa_error?: string | null;
      };
      if (!res.ok) {
        setPesan({ ok: false, text: body.message ?? `Gagal (HTTP ${res.status}).` });
        return;
      }
      setPesan(
        body.wa_error
          ? { ok: false, text: `Jawaban tersimpan, tapi WhatsApp gagal terkirim: ${body.wa_error}` }
          : { ok: true, text: body.wa_sent ? "Tersimpan. Penanya sudah dikabari lewat WhatsApp." : "Tersimpan." },
      );
      setEdit(false);
      router.refresh();
    } catch {
      setPesan({ ok: false, text: "Koneksi terputus. Coba lagi." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {edit ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void kirim("jawab");
          }}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <textarea
            value={jawaban}
            onChange={(e) => setJawaban(e.target.value)}
            maxLength={3000}
            rows={4}
            required
            placeholder="Tulis jawaban untuk penanya"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--ink)",
              fontSize: 13.5,
              lineHeight: 1.55,
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: "var(--ink-soft)" }}>
            <input type="checkbox" checked={faq} onChange={(e) => setFaq(e.target.checked)} />
            Tampilkan di FAQ halaman pendaftaran (tanpa nama & nomor penanya)
          </label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="submit"
              disabled={busy !== null || jawaban.trim() === ""}
              className="btn-mpt btn-mpt-primary"
              style={{ minHeight: 36, padding: "0 14px", fontSize: 13 }}
            >
              <Send size={14} />
              {busy === "jawab" ? "Menyimpan…" : q.jawaban === null ? "Jawab & kabari via WA" : "Simpan perubahan"}
            </button>
            {q.jawaban !== null && (
              <button type="button" onClick={() => setEdit(false)} style={linkBtn}>
                Batal
              </button>
            )}
          </div>
        </form>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink)", whiteSpace: "pre-line" }}>
            {jawaban}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
            <button type="button" onClick={() => setEdit(true)} style={linkBtn}>
              <Pencil size={12} /> Ubah jawaban / FAQ
            </button>
            {!q.wa_sent && (
              <button type="button" onClick={() => void kirim("kirim_wa")} disabled={busy !== null} style={linkBtn}>
                <Send size={12} /> {busy === "kirim_wa" ? "Mengirim…" : "Kirim ulang WA"}
              </button>
            )}
          </div>
        </>
      )}
      {pesan && (
        <div role="status" style={{ fontSize: 12, color: pesan.ok ? "var(--success)" : "var(--danger)" }}>
          {pesan.text}
        </div>
      )}
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: 0,
  border: 0,
  background: "none",
  color: "var(--accent-deep)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
