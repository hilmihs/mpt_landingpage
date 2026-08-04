"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { AL_FATIHAH_SEGMENTS } from "@/lib/arabic";
import { EVALUATION_OPTIONS, parseOption } from "@/lib/teacher-eval/catalog";
import { computeEvaluation } from "@/lib/teacher-eval/scoring";
import {
  INDICATOR_LABEL,
  SEGMENT_KEYS,
  emptyAyat,
  type EvaluationAyat,
  type SegmentKey,
} from "@/lib/teacher-eval/types";
import { SegmentCard, type SegmentOption } from "@/components/portal/SegmentCard";

const KEGIATAN_DEFAULT = "Assessment Al-Fatihah Online";
const REKOMENDASI_PILIHAN = ["HITS Dasar", "HITS Lanjutan"] as const;

type Rekomendasi = (typeof REKOMENDASI_PILIHAN)[number];

export interface EvaluationSummary {
  skor: number | null;
  label: string | null;
  kodeUnik: string | null;
}

export interface EvaluationFormProps {
  assignmentId: string;
  /** Terisi kalau rekaman ini sudah pernah dinilai. */
  existing: EvaluationSummary | null;
}

export function EvaluationForm({ assignmentId, existing }: EvaluationFormProps) {
  // Dipisah jadi dua komponen supaya urutan hook tidak bergantung pada ada
  // tidaknya hasil lama.
  return existing ? (
    <HasilTersimpan summary={existing} />
  ) : (
    <FormPenilaian assignmentId={assignmentId} />
  );
}

function FormPenilaian({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [kegiatan, setKegiatan] = useState(KEGIATAN_DEFAULT);
  const [rekomendasi, setRekomendasi] = useState<Rekomendasi | "">("");
  const [ayat, setAyat] = useState<EvaluationAyat>(emptyAyat);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tag kategori dipisah sekali di awal, bukan tiap render — daftarnya 110 baris
  // dan isinya tidak pernah berubah selama halaman hidup.
  const pilihan = useMemo(
    () =>
      SEGMENT_KEYS.map((key) => ({
        key,
        jaliy: EVALUATION_OPTIONS[key].jaliy.map(toSegmentOption),
        khafiy: EVALUATION_OPTIONS[key].khafiy.map(toSegmentOption),
      })),
    [],
  );

  const hasil = useMemo(() => computeEvaluation(ayat), [ayat]);

  // Tandai penugasan sebagai sedang dikerjakan begitu formulirnya terbuka.
  // Papan admin memakai status ini untuk memisahkan rekaman yang belum
  // disentuh dari yang sudah dipegang seseorang; tanpa penanda ini keduanya
  // tampak sama dan tidak ada yang tahu mana yang perlu dialihkan.
  // Gagalnya diabaikan — ini catatan pendukung, bukan syarat menilai.
  useEffect(() => {
    void fetch("/api/portal/evaluation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_id: assignmentId }),
    }).catch(() => {});
  }, [assignmentId]);

  const total = useMemo(() => {
    let jaliy = 0;
    let khafiy = 0;
    for (const key of SEGMENT_KEYS) {
      jaliy += ayat[key].jaliy.length;
      khafiy += ayat[key].khafiy.length;
    }
    return { jaliy, khafiy };
  }, [ayat]);

  function toggle(segment: SegmentKey, severity: "jaliy" | "khafiy", raw: string) {
    setAyat((prev) => {
      const current = prev[segment];
      const list = current[severity];
      return {
        ...prev,
        [segment]: {
          ...current,
          [severity]: list.includes(raw)
            ? list.filter((o) => o !== raw)
            : [...list, raw],
        },
      };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: assignmentId,
          kegiatan: kegiatan.trim() || KEGIATAN_DEFAULT,
          rekomendasi_program: rekomendasi || null,
          ayat,
        }),
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
    <form onSubmit={submit}>
      <div className="card-mpt" style={{ padding: 20, marginBottom: 14 }}>
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <label style={{ display: "block" }}>
            <span style={labelStyle}>Kegiatan</span>
            <input
              className="input-mpt"
              value={kegiatan}
              onChange={(e) => setKegiatan(e.target.value)}
              autoComplete="off"
              style={{ width: "100%" }}
            />
          </label>

          <label style={{ display: "block" }}>
            <span style={labelStyle}>Rekomendasi Program (opsional)</span>
            <select
              className="input-mpt"
              value={rekomendasi}
              onChange={(e) => setRekomendasi(e.target.value as Rekomendasi | "")}
              style={{ width: "100%" }}
            >
              <option value="">— Belum ditentukan —</option>
              {REKOMENDASI_PILIHAN.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pilihan.map((segment, i) => {
          const meta = AL_FATIHAH_SEGMENTS[segment.key]!;
          return (
            <SegmentCard
              key={segment.key}
              index={i + 1}
              label={meta.nomor}
              arabic={meta.arabic}
              transliterasi={meta.transliterasi}
              optionsJaliy={segment.jaliy}
              optionsKhafiy={segment.khafiy}
              markedJaliy={ayat[segment.key].jaliy}
              markedKhafiy={ayat[segment.key].khafiy}
              onToggle={(severity, raw) => toggle(segment.key, severity, raw)}
            />
          );
        })}
      </div>

      {error && (
        <div
          style={{
            marginTop: 14,
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

      {/* Skor menempel di bawah layar: pengajar melihat akibat tiap centang
          tanpa menggulir balik ke atas. */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 30,
          marginTop: 16,
          padding: "14px 16px",
          borderRadius: 16,
          border: "1px solid var(--line-strong)",
          background: "var(--paper)",
          boxShadow: "0 -14px 34px -24px rgba(26, 31, 42, 0.5)",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <span className="font-display" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
            {hasil.scoreTen}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-mute)" }}>/10</span>
        </div>

        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{hasil.band.title}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>
            {total.jaliy} fatal · {total.khafiy} perlu diperhatikan
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="btn-mpt btn-mpt-accent"
          style={{ minHeight: 46, fontSize: 14, fontWeight: 700, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Menyimpan..." : "Simpan & Kirim ke Peserta"}
          <ChevronRight size={16} strokeWidth={2.4} />
        </button>
      </div>
    </form>
  );
}

function HasilTersimpan({ summary }: { summary: EvaluationSummary }) {
  return (
    <div className="card-mpt" style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: 10,
          color: "var(--success)",
        }}
      >
        <CheckCircle2 size={17} strokeWidth={2.3} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>Penilaian sudah tersimpan</span>
      </div>

      {summary.skor != null && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <span className="font-display" style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>
            {summary.skor}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-mute)" }}>/10</span>
          {summary.label && (
            <span style={{ fontSize: 14, fontWeight: 700 }}>{summary.label}</span>
          )}
        </div>
      )}

      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
        Rapotnya sudah dikirim ke peserta lewat WhatsApp.
        {summary.kodeUnik && (
          <>
            {" "}
            Kode penilaian: <strong>{summary.kodeUnik}</strong>.
          </>
        )}
      </p>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
};

function toSegmentOption(raw: string): SegmentOption {
  const { text, indicator } = parseOption(raw);
  return { raw, text, kategori: indicator ? INDICATOR_LABEL[indicator] : null };
}


