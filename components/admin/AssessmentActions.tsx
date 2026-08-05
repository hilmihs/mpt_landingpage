"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, UserPlus, Repeat } from "lucide-react";
import type { Tahap } from "@/lib/admin/assessment-query";

/**
 * Tombol penugasan dan pemindahan pengajar.
 *
 * Hanya SATU aksi yang pernah tampil sekaligus: "Tugaskan" untuk rekaman yang
 * belum punya pengajar, "Alihkan" untuk yang sudah. Menampilkan keduanya
 * membuat halaman yang sudah basi bisa mengirim niat yang salah — dan yang
 * salah itu justru menggusur pengajar yang sedang mengerjakan.
 */

export interface KandidatPengajar {
  id: string;
  nama: string;
  antrean: number;
}

interface Props {
  submissionId: string;
  tahap: Tahap;
  pengajarSekarang: string | null;
  jenisKelamin: "ikhwan" | "akhwat";
  kandidat: KandidatPengajar[];
}

type Hasil =
  | { ok: true; pesan: string; waGagal: string | null }
  | { ok: false; pesan: string };

export function AssessmentActions({
  submissionId,
  tahap,
  pengajarSekarang,
  jenisKelamin,
  kandidat,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kirim, setKirim] = useState(false);
  const [pilihan, setPilihan] = useState<string>("");
  const [hasil, setHasil] = useState<Hasil | null>(null);

  // Rekaman yang sudah dinilai tidak boleh dipindah: teacher_evaluations unik
  // per submission dan ditulis dengan upsert, jadi penilai berikutnya akan
  // menimpa yang pertama.
  if (tahap === "selesai") return null;

  const perluTugas = tahap === "perlu_penugasan";
  const aksi = perluTugas ? "assign" : "reassign";
  const sibuk = kirim || pending;

  async function jalankan() {
    if (!pilihan) {
      setHasil({ ok: false, pesan: "Pilih pengajar tujuan lebih dulu." });
      return;
    }

    if (!perluTugas) {
      const tujuan =
        pilihan === "fallback"
          ? "Superadmin (fallback)"
          : pilihan === "auto"
            ? "pengajar berikutnya menurut rotasi"
            : (kandidat.find((k) => k.id === pilihan)?.nama ?? "pengajar lain");
      const setuju = window.confirm(
        `Alihkan rekaman ini dari ${pengajarSekarang ?? "pengajar sekarang"} ke ${tujuan}?\n\n` +
          `Tautan penilaian yang lama akan berhenti berlaku, dan pengajar baru langsung dikabari lewat WhatsApp.`,
      );
      if (!setuju) return;
    }

    setKirim(true);
    setHasil(null);
    try {
      const res = await fetch(`/api/admin/assessment/${aksi}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: submissionId,
          mode: pilihan === "fallback" || pilihan === "auto" ? pilihan : "teacher",
          teacher_id: pilihan === "fallback" || pilihan === "auto" ? null : pilihan,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        teacher?: { nama: string };
        wa_sent?: boolean;
        wa_error?: string | null;
      };

      if (!res.ok) {
        setHasil({
          ok: false,
          pesan: data.message ?? pesanGalat(data.error ?? "unknown"),
        });
        return;
      }

      setHasil({
        ok: true,
        pesan: `${perluTugas ? "Ditugaskan" : "Dialihkan"} ke ${data.teacher?.nama ?? "pengajar baru"}.`,
        // Kegagalan WA sengaja ditampilkan menonjol: penugasannya berhasil tapi
        // pengajarnya belum tahu, dan itu tidak boleh terbaca sebagai beres.
        waGagal: data.wa_sent ? null : (data.wa_error ?? "tidak diketahui"),
      });
      setPilihan("");
      startTransition(() => router.refresh());
    } catch (err) {
      setHasil({ ok: false, pesan: (err as Error).message });
    } finally {
      setKirim(false);
    }
  }

  return (
    <div className="card-mpt" style={{ padding: "16px 20px" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 10,
        }}
      >
        {perluTugas ? "Tugaskan Pengajar" : "Alihkan Pengajar"}
      </div>

      <p
        style={{
          fontSize: 13,
          color: "var(--ink-soft)",
          margin: "0 0 12px",
          lineHeight: 1.6,
        }}
      >
        {perluTugas
          ? `Rekaman ini belum dipegang siapa pun. Hanya pengajar ${jenisKelamin} yang bisa dipilih.`
          : `Sekarang dipegang ${pengajarSekarang ?? "—"}. Memindahkan akan menghentikan tautan penilaian yang lama dan mengabari pengajar baru lewat WhatsApp.`}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <select
          value={pilihan}
          onChange={(e) => setPilihan(e.target.value)}
          disabled={sibuk}
          className="input-mpt"
          style={{ minWidth: 260, height: 38, fontSize: 13, padding: "0 10px" }}
          aria-label="Pengajar tujuan"
        >
          <option value="">Pilih pengajar tujuan…</option>
          <option value="auto">Otomatis (rotasi giliran)</option>
          <option value="fallback">Superadmin (fallback)</option>
          {kandidat.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nama} — {k.antrean} antrean
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={jalankan}
          disabled={sibuk || !pilihan}
          className="btn-mpt btn-mpt-accent"
          style={{
            minHeight: 38,
            padding: "0 16px",
            fontSize: 13,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            opacity: sibuk || !pilihan ? 0.55 : 1,
          }}
        >
          {perluTugas ? (
            <UserPlus size={15} strokeWidth={2.4} />
          ) : (
            <Repeat size={15} strokeWidth={2.4} />
          )}
          {sibuk ? "Memproses…" : perluTugas ? "Tugaskan" : "Alihkan"}
        </button>
      </div>

      {kandidat.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--warning)", margin: "10px 0 0" }}>
          Tidak ada pengajar {jenisKelamin} yang aktif. Pilihan yang tersisa cuma
          Superadmin (fallback).
        </p>
      )}

      {hasil && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <Banner
            color={hasil.ok ? "var(--success)" : "var(--danger)"}
            icon={
              hasil.ok ? (
                <CheckCircle2 size={15} strokeWidth={2.2} />
              ) : (
                <AlertTriangle size={15} strokeWidth={2.2} />
              )
            }
          >
            {hasil.pesan}
          </Banner>
          {hasil.ok && hasil.waGagal && (
            <Banner color="var(--warning)" icon={<AlertTriangle size={15} strokeWidth={2.2} />}>
              Penugasannya tercatat, tapi WhatsApp gagal terkirim ({hasil.waGagal}).
              Pengajar belum tahu ada rekaman menunggu — hubungi manual atau
              alihkan lagi.
            </Banner>
          )}
        </div>
      )}
    </div>
  );
}

function pesanGalat(kode: string): string {
  const peta: Record<string, string> = {
    unauthorized: "Sesi admin sudah berakhir. Masuk ulang.",
    already_assigned:
      "Rekaman ini sudah punya penugasan aktif. Muat ulang halamannya.",
    no_active_assignment:
      "Tidak ada penugasan aktif untuk dipindahkan. Muat ulang halamannya.",
    already_evaluated: "Rekaman ini sudah dinilai, jadi tidak bisa dipindahkan.",
    gender_mismatch: "Gender pengajar tidak cocok dengan peserta.",
    teacher_inactive: "Pengajar itu sedang tidak aktif.",
    teacher_not_found: "Pengajar tidak ditemukan.",
    no_fallback: "SUPERADMIN_WA belum diisi.",
    no_target: "Tidak ada pengajar yang bisa dipilih.",
    submission_not_found: "Rekaman tidak ditemukan.",
  };
  return peta[kode] ?? `Gagal: ${kode}`;
}

function Banner({
  color,
  icon,
  children,
}: {
  color: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.55,
        border: `1px solid ${color}`,
        background: `color-mix(in oklab, ${color}, transparent 92%)`,
        color: "var(--ink)",
      }}
    >
      <span style={{ color, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span>{children}</span>
    </div>
  );
}
