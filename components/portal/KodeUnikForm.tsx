"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight } from "lucide-react";

/**
 * Menautkan penilaian yang baru dibuat pengajar di sistem muhajirproject dengan
 * submission di sini.
 *
 * Kodenya ditempel manual, bukan dicocokkan otomatis, karena API di sana
 * read-only dan tidak menyimpan rujukan apa pun ke submission kita. Pencocokan
 * berdasar nama pemeriksa dan waktu bisa tertukar kalau seorang pengajar
 * menilai beberapa peserta beruntun — dan salah tautan berarti peserta menerima
 * rapot milik orang lain. Lihat docs/INTEGRASI_PENILAIAN_PENGAJAR.md bagian 4.
 */
export function KodeUnikForm({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [kode, setKode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kode.trim() || busy) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignmentId, kode_unik: kode.trim() }),
      });
      const body = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(body.message ?? "Gagal menyimpan. Coba lagi.");
        return;
      }
      router.refresh();
    } catch {
      setError("Gagal menghubungi server. Periksa koneksi Anda.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
        Tempelkan kode unik dari formulir tadi. Kami akan mengambil hasil
        penilaiannya dan mengirim rapot ke WhatsApp peserta.
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 10,
        }}
      >
        <CheckCircle2 size={16} strokeWidth={2.2} color="var(--ink-mute)" />
        <input
          value={kode}
          onChange={(e) => setKode(e.target.value)}
          placeholder="Contoh: A1B2C3"
          autoComplete="off"
          required
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 14,
            color: "var(--ink)",
            fontFamily: "inherit",
          }}
        />
      </div>

      {error && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "color-mix(in oklab, var(--danger), transparent 88%)",
            color: "var(--danger)",
            fontSize: 12,
            lineHeight: 1.55,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="btn-mpt btn-mpt-accent"
        style={{ minHeight: 46, fontSize: 14, fontWeight: 700, opacity: busy ? 0.6 : 1 }}
      >
        {busy ? "Mengambil hasil..." : "Simpan & Kirim ke Peserta"}
        <ChevronRight size={16} strokeWidth={2.4} />
      </button>
    </form>
  );
}
