"use client";

import { CircleAlert, Mic, Send, ShieldCheck } from "lucide-react";
import { DAR_SYAFII, findJadwal, findLevel } from "@/lib/hits-dar-syafii";
import { normalizeWaNumber } from "@/lib/whatsapp";
import s from "./dar-syafii.module.css";
import t from "./tinjau.module.css";
import { Sheet } from "./Shared";
import { fmtDurasi } from "./StepRekam";
import { AudioPill } from "./Wave";
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
    <>
      <dt className={t.rowLabel}>{label}</dt>
      <dd className={t.rowValue}>{value}</dd>
    </>
  );
}

function Section({
  title,
  editLabel,
  step,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  step: number;
  onEdit: (n: number) => void;
  children: React.ReactNode;
}) {
  return (
    <section className={t.section}>
      <div className={t.sectionHead}>
        <h3 className={t.sectionTitle}>{title}</h3>
        <button
          type="button"
          className={t.editBtn}
          onClick={() => onEdit(step)}
          aria-label={editLabel}
        >
          Ubah
        </button>
      </div>
      {children}
    </section>
  );
}

export function StepTinjau({ form, audio, send, onEdit, onSubmit }: Props) {
  const jadwal = findJadwal(form.jadwal);
  const level = findLevel(form.level);
  const sending = send.kind === "sending";
  const pct = sending ? Math.round(send.pct) : 0;

  // Label jadwal lengkap (jadwalLabel) ikut menyebut tempat; di tiket tempat
  // dipisah ke barisnya sendiri supaya baris jadwal tetap pendek di HP.
  const jadwalText = jadwal
    ? `${jadwal.gender === "ikhwan" ? "Ikhwan" : "Akhwat"} · ${jadwal.hari}, ${jadwal.jam}`
    : "—";

  const sumberRekaman = audio
    ? audio.sumber === "unggah"
      ? `Berkas unggahan${audio.fileName ? ` · ${audio.fileName}` : ""}`
      : "Direkam di halaman ini"
    : "";

  return (
    <Sheet>
      <div className={t.stack}>
        <div className={t.ticket}>
          <Section title="Data diri" editLabel="Ubah data diri" step={1} onEdit={onEdit}>
            <dl className={t.rows}>
              <Row label="Nama" value={form.nama.trim()} />
              <Row label="Anak" value={`${form.nama_anak.trim()} · ${form.kelas_anak.trim()}`} />
              <Row label="WhatsApp" value={normalizeWaNumber(form.nomor_wa) ?? form.nomor_wa} />
              <Row label="Email" value={form.email.trim().toLowerCase()} />
              <Row label="Usia · kota" value={`${form.usia} th · ${form.kota}`} />
            </dl>
          </Section>

          <Section title="Kelas" editLabel="Ubah jadwal dan level kelas" step={2} onEdit={onEdit}>
            <dl className={t.rows}>
              <Row label="Jadwal" value={jadwalText} />
              <Row label="Tempat" value={DAR_SYAFII.tempat} />
              <Row label="Level" value={level?.nama ?? "—"} />
            </dl>
          </Section>

          <Section title="Ujian masuk" editLabel="Ubah rekaman ujian masuk" step={3} onEdit={onEdit}>
            {audio ? (
              <>
                <AudioPill src={audio.url} durationSec={audio.durationSec} tone="light" />
                <p className={t.audioMeta}>
                  {sumberRekaman}
                  {audio.durationSec != null && (
                    <span className={s.srOnly}>, durasi {fmtDurasi(audio.durationSec)}</span>
                  )}
                </p>
              </>
            ) : (
              <div className={t.empty}>
                <p className={t.emptyText}>
                  Belum ada rekaman. Pendaftaran baru bisa dikirim setelah Anda merekam
                  bacaan ujian masuk.
                </p>
                <button type="button" className={t.emptyBtn} onClick={() => onEdit(3)}>
                  <Mic size={16} strokeWidth={2.4} aria-hidden="true" />
                  Rekam sekarang
                </button>
              </div>
            )}
          </Section>
        </div>

        <p className={t.privacy}>
          <ShieldCheck size={18} strokeWidth={2.2} className={t.privacyIcon} aria-hidden="true" />
          <span>
            Data hanya dipakai panitia untuk seleksi. Rekaman disimpan di server Indonesia dan
            terhapus otomatis setelah {DAR_SYAFII.retensiHari} hari.
          </span>
        </p>

        {send.kind === "error" && (
          <div className={t.formError} role="alert">
            <CircleAlert size={16} strokeWidth={2.4} aria-hidden="true" />
            <span>{send.message}</span>
          </div>
        )}

        <div className={t.submitWrap}>
          <button
            type="button"
            className={`${s.btnGold} ${s.btnBlock}`}
            onClick={onSubmit}
            disabled={sending || !audio}
            aria-busy={sending}
          >
            {sending ? (
              `Mengirim… ${pct}%`
            ) : (
              <>
                {send.kind === "error" ? "Coba kirim lagi" : "Kirim pendaftaran"}
                <Send size={17} strokeWidth={2.6} aria-hidden="true" />
              </>
            )}
          </button>

          {/* Wadah live selalu ada supaya pembaca layar mengumumkan saat mulai
              mengirim; persennya dibaca lewat progressbar, bukan diumumkan
              tiap berubah. */}
          <div aria-live="polite">
            {sending && (
              <div className={t.progress}>
                <div className={t.progressText}>
                  <span>Mengirim pendaftaran… jangan tutup halaman ini.</span>
                  <span className={t.progressPct} aria-hidden="true">
                    {pct}%
                  </span>
                </div>
                <div
                  className={t.progressTrack}
                  role="progressbar"
                  aria-label="Kemajuan pengiriman"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                >
                  <div className={t.progressFill} style={{ width: `${Math.max(4, pct)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
