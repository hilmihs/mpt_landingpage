"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil } from "lucide-react";
import {
  BATAS_JALIY_BUTA_HURUF,
  LABEL_BUTA_HURUF,
  formulaButaHuruf,
  levelPenempatan,
} from "@/lib/hits-dar-syafii";

export interface PenilaianAwal {
  lahn_jaliy: number | null;
  lahn_khofi: number | null;
  buta_huruf: boolean | null;
  keterangan: string | null;
  dinilai_oleh: string | null;
  /** Sudah diformat untuk tampilan (WIB). */
  dinilai_label: string | null;
}

const labelBH = (v: boolean | null) =>
  v === null ? "—" : v ? LABEL_BUTA_HURUF.ya : LABEL_BUTA_HURUF.tidak;

/**
 * Formulir "Penilaian oleh Lajnah" untuk satu pendaftar — kolom L, M, N, O,
 * dan P di spreadsheet lama. Formula (O) hanya pembanding; yang menentukan
 * penempatan adalah pilihan manual (N).
 */
export function PenilaianRekaman({
  id,
  level,
  awal,
}: {
  id: string;
  level: string;
  awal: PenilaianAwal;
}) {
  const router = useRouter();
  // Nilai yang tampil di mode baca. Diisi dari respons simpan supaya tidak
  // menunggu router.refresh() selesai untuk menampilkan hasilnya.
  const [nilai, setNilai] = useState<PenilaianAwal>(awal);
  const sudah = nilai.buta_huruf !== null;
  const [edit, setEdit] = useState(!sudah);
  const [jaliy, setJaliy] = useState(awal.lahn_jaliy?.toString() ?? "");
  const [khofi, setKhofi] = useState(awal.lahn_khofi?.toString() ?? "");
  const [bh, setBh] = useState<"" | "ya" | "tidak">(sudah ? (awal.buta_huruf ? "ya" : "tidak") : "");
  const [ket, setKet] = useState(awal.keterangan ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jaliyNum = /^\d{1,3}$/.test(jaliy.trim()) ? Number(jaliy) : null;
  const formula = formulaButaHuruf(jaliyNum);
  const manual = bh === "" ? null : bh === "ya";
  const beda = formula !== null && manual !== null && formula !== manual;
  const pindah = levelPenempatan(level, manual) !== level;

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/hits-dar-syafii/penilaian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, lahn_jaliy: jaliy, lahn_khofi: khofi, buta_huruf: bh, keterangan: ket }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        lahn_jaliy?: number;
        lahn_khofi?: number;
        buta_huruf?: boolean;
        penilaian_keterangan?: string | null;
        dinilai_oleh?: string;
      };
      if (!res.ok) {
        setError(body.message ?? `Gagal menyimpan (HTTP ${res.status}).`);
        return;
      }
      setNilai({
        lahn_jaliy: body.lahn_jaliy ?? null,
        lahn_khofi: body.lahn_khofi ?? null,
        buta_huruf: body.buta_huruf ?? null,
        keterangan: body.penilaian_keterangan ?? null,
        dinilai_oleh: body.dinilai_oleh ?? null,
        dinilai_label: "baru saja",
      });
      setEdit(false);
      router.refresh();
    } catch {
      setError("Koneksi terputus. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  if (!edit) {
    const f = formulaButaHuruf(nilai.lahn_jaliy);
    const bedaTersimpan = f !== null && f !== nilai.buta_huruf;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 220, fontSize: 12.5 }}>
        <div>
          Jaliy <b style={{ color: "var(--ink)" }}>{nilai.lahn_jaliy}</b> · Khofi{" "}
          <b style={{ color: "var(--ink)" }}>{nilai.lahn_khofi}</b>
        </div>
        <div>
          Lajnah: <b style={{ color: nilai.buta_huruf ? "var(--danger)" : "var(--success)" }}>{labelBH(nilai.buta_huruf)}</b>
        </div>
        <div style={{ color: bedaTersimpan ? "var(--warning)" : "var(--ink-mute)" }}>
          {bedaTersimpan && <AlertTriangle size={12} style={{ verticalAlign: -1, marginRight: 4 }} />}
          Formula: {labelBH(f)}
        </div>
        {nilai.keterangan && <div style={{ whiteSpace: "pre-line" }}>{nilai.keterangan}</div>}
        <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
          {nilai.dinilai_oleh} · {nilai.dinilai_label}
        </div>
        <button
          type="button"
          onClick={() => setEdit(true)}
          style={{ ...linkBtn, alignSelf: "flex-start" }}
        >
          <Pencil size={12} /> Ubah
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={simpan} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 250 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <label style={lbl}>
          Lahn jaliy
          <input
            value={jaliy}
            onChange={(e) => setJaliy(e.target.value)}
            inputMode="numeric"
            required
            style={{ ...inp, width: 72 }}
          />
        </label>
        <label style={lbl}>
          Lahn khofi
          <input
            value={khofi}
            onChange={(e) => setKhofi(e.target.value)}
            inputMode="numeric"
            required
            style={{ ...inp, width: 72 }}
          />
        </label>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <legend style={{ ...lbl, marginBottom: 3 }}>Penilaian lajnah</legend>
        {(["ya", "tidak"] as const).map((v) => (
          <label key={v} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
            <input type="radio" name={`bh-${id}`} checked={bh === v} onChange={() => setBh(v)} required />
            {LABEL_BUTA_HURUF[v]}
          </label>
        ))}
      </fieldset>

      <div style={{ fontSize: 12, color: beda ? "var(--warning)" : "var(--ink-mute)" }}>
        {beda && <AlertTriangle size={12} style={{ verticalAlign: -1, marginRight: 4 }} />}
        Formula (jaliy &gt; {BATAS_JALIY_BUTA_HURUF}): <b>{labelBH(formula)}</b>
        {beda && " — berbeda dengan pilihan lajnah, cek lagi."}
      </div>
      {pindah && (
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-deep)" }}>
          Akan ditempatkan di HITS Dasar.
        </div>
      )}

      <label style={lbl}>
        Keterangan
        <textarea
          value={ket}
          onChange={(e) => setKet(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="cth. Peserta membaca Maryam 1-5"
          style={{ ...inp, height: "auto", padding: "6px 8px", resize: "vertical" }}
        />
      </label>

      {error && <div style={{ fontSize: 12, color: "var(--danger)" }}>{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={saving}
          className="btn-mpt btn-mpt-primary"
          style={{ minHeight: 34, padding: "0 12px", fontSize: 12.5 }}
        >
          {saving ? "Menyimpan…" : "Simpan penilaian"}
        </button>
        {sudah && (
          <button type="button" onClick={() => setEdit(false)} style={linkBtn}>
            Batal
          </button>
        )}
      </div>
    </form>
  );
}

const lbl: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  color: "var(--ink-mute)",
};

const inp: React.CSSProperties = {
  height: 32,
  padding: "0 8px",
  borderRadius: 6,
  border: "1px solid var(--line)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: 13,
  fontFamily: "inherit",
};

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
