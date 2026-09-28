"use client";

import { Pencil, Send, ShieldCheck } from "lucide-react";
import { DAR_SYAFII, findJadwal, findLevel, jadwalLabel } from "@/lib/hits-dar-syafii";
import { normalizeWaNumber } from "@/lib/whatsapp";
import s from "./dar-syafii.module.css";
import { Sheet } from "./StepDataDiri";
import { fmtDurasi } from "./StepRekam";
import type { AudioTake, FormState, SendState } from "./types";

interface Props {
  form: FormState;
  audio: AudioTake | null;
  send: SendState;
  onEdit: (step: number) => void;
  onSubmit: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={s.ticketRow}>
      <span className={s.ticketLabel}>{label}</span>
      <span className={s.ticketValue}>{value}</span>
    </div>
  );
}

function Section({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: number;
  onEdit: (n: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={s.ticketSection}>
      <div className={s.ticketHead}>
        <span className={s.ticketHeadTitle}>{title}</span>
        <button type="button" className={s.linkBtn} onClick={() => onEdit(step)}>
          <Pencil size={12} strokeWidth={2.6} style={{ verticalAlign: -1, marginRight: 4 }} />
          Ubah
        </button>
      </div>
      {children}
    </div>
  );
}

export function StepTinjau({ form, audio, send, onEdit, onSubmit }: Props) {
  const jadwal = findJadwal(form.jadwal);
  const level = findLevel(form.level);
  const sending = send.kind === "sending";

  return (
    <Sheet>
      <div className={s.stepEyebrow}>Langkah 4 dari 4</div>
      <h2 className={s.stepTitle}>
        Periksa <em>sekali lagi</em>
      </h2>
      <p className={s.stepDesc}>
        Pastikan nomor WhatsApp benar — pengumuman peserta terpilih dan tautan
        grup kelas dikirim ke sana.
      </p>

      <div className={s.ticket}>
        <Section title="Data diri" step={1} onEdit={onEdit}>
          <Row label="Nama" value={form.nama.trim()} />
          <Row label="Anak" value={`${form.nama_anak.trim()} · kelas ${form.kelas_anak.trim()}`} />
          <Row label="Email" value={form.email.trim().toLowerCase()} />
          <Row label="WhatsApp" value={normalizeWaNumber(form.nomor_wa) ?? form.nomor_wa} />
          <Row label="Usia" value={`${form.usia} tahun`} />
          <Row label="Domisili" value={form.kota} />
          <Row label="Jenis kelamin" value={form.jenis_kelamin === "ikhwan" ? "Laki-laki" : "Perempuan"} />
        </Section>
        <Section title="Kelas" step={2} onEdit={onEdit}>
          <Row label="Jam belajar" value={jadwal ? jadwalLabel(jadwal) : "—"} />
          <Row label="Level" value={level?.nama ?? "—"} />
        </Section>
        <Section title="Ujian masuk" step={3} onEdit={onEdit}>
          <Row
            label="Rekaman"
            value={
              audio
                ? `${audio.sumber === "unggah" ? "Berkas unggahan" : "Direkam di halaman"}${
                    audio.durationSec != null ? ` · ${fmtDurasi(audio.durationSec)}` : ""
                  }`
                : "Belum ada"
            }
          />
        </Section>
      </div>

      <p className={s.privacy}>
        <ShieldCheck size={18} strokeWidth={2.2} style={{ color: "var(--ds-green)" }} />
        <span>
          Data Anda hanya dipakai panitia untuk seleksi dan menghubungi Anda.
          Rekaman disimpan di server Indonesia dan terhapus otomatis setelah{" "}
          {DAR_SYAFII.retensiHari} hari.
        </span>
      </p>

      {send.kind === "error" && (
        <div className={s.formError} role="alert">
          {send.message}
        </div>
      )}

      <button
        type="button"
        className={`${s.btnGold} ${s.btnBlock}`}
        onClick={onSubmit}
        disabled={sending || !audio}
      >
        {sending ? (
          `Mengirim… ${send.pct}%`
        ) : (
          <>
            Kirim pendaftaran
            <Send size={17} strokeWidth={2.6} />
          </>
        )}
      </button>
      {sending && (
        <div className={s.sendProgress} aria-hidden="true">
          <div className={s.sendProgressFill} style={{ width: `${Math.max(4, send.pct)}%` }} />
        </div>
      )}
    </Sheet>
  );
}
