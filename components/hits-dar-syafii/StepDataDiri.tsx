"use client";

import { ArrowRight, CircleAlert, Lock } from "lucide-react";
import { DAR_SYAFII, type Gender } from "@/lib/hits-dar-syafii";
import { normalizeWaNumber } from "@/lib/whatsapp";
import s from "./dar-syafii.module.css";
import { CornerOrnament, Star8 } from "./Ornaments";
import { KotaPicker } from "./KotaPicker";
import type { Errors, FieldKey, FormState } from "./types";

interface Props {
  form: FormState;
  errors: Errors;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onBlur: (key: FieldKey) => void;
  onNext: () => void;
}

export function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.sheet}>
      <CornerOrnament className={s.sheetCornerA} />
      <CornerOrnament className={s.sheetCornerB} />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

export function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {label}
        {optional && <span className={s.labelOpt}>{optional}</span>}
      </label>
      {children}
      {error ? (
        <span className={s.error} id={`${id}-msg`} role="alert">
          <CircleAlert size={14} strokeWidth={2.4} />
          {error}
        </span>
      ) : hint ? (
        <span className={s.hint} id={`${id}-msg`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

const GENDER: { id: Gender; nama: string; sub: string }[] = [
  { id: "ikhwan", nama: "Laki-laki", sub: "Ikhwan · ayah / wali" },
  { id: "akhwat", nama: "Perempuan", sub: "Akhwat · ibu / wali" },
];

export function StepDataDiri({ form, errors, update, onBlur, onNext }: Props) {
  const waNorm = form.nomor_wa ? normalizeWaNumber(form.nomor_wa) : null;
  const usiaNum = Number(form.usia) || 0;

  return (
    <Sheet>
      <div className={s.stepEyebrow}>Langkah 1 dari 4</div>
      <h2 className={s.stepTitle}>
        Kenalan <em>dulu</em>
      </h2>
      <p className={s.stepDesc}>
        Diisi oleh orang tua atau wali murid yang akan belajar. Data ini dipakai
        admin untuk menghubungi Anda lewat WhatsApp dan menempatkan Anda di kelas.
      </p>

      <form
        className={s.fields}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onNext();
        }}
      >
        <Field id="ds-email" label="Email" error={errors.email}>
          <input
            id="ds-email"
            className={s.input}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="nama@email.com"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            onBlur={() => onBlur("email")}
            aria-invalid={Boolean(errors.email)}
            aria-describedby="ds-email-msg"
          />
        </Field>

        <Field id="ds-nama" label="Nama lengkap" error={errors.nama}>
          <input
            id="ds-nama"
            className={s.input}
            autoComplete="name"
            autoCapitalize="words"
            placeholder="Sesuai yang ingin dipanggil pengajar"
            value={form.nama}
            onChange={(e) => update("nama", e.target.value)}
            onBlur={() => onBlur("nama")}
            aria-invalid={Boolean(errors.nama)}
            aria-describedby="ds-nama-msg"
          />
        </Field>

        <div className={s.field}>
          <span className={s.label} id="ds-jenis_kelamin-label">
            Konfirmasi jenis kelamin
          </span>
          <div
            className={s.genderGrid}
            role="radiogroup"
            aria-labelledby="ds-jenis_kelamin-label"
          >
            {GENDER.map((g, i) => {
              const dibuka = DAR_SYAFII.genderDibuka.includes(g.id);
              const checked = form.jenis_kelamin === g.id;
              return (
                <button
                  key={g.id}
                  id={i === 0 ? "ds-jenis_kelamin" : undefined}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  disabled={!dibuka}
                  className={s.genderTile}
                  onClick={() => update("jenis_kelamin", g.id)}
                >
                  <span className={s.genderName}>{g.nama}</span>
                  <span className={s.genderSub}>
                    {dibuka ? g.sub : "Belum dibuka untuk angkatan ini"}
                  </span>
                  <span className={s.genderCheck}>
                    {!dibuka ? (
                      <Lock size={16} strokeWidth={2.2} />
                    ) : checked ? (
                      <Star8 size={22}>✓</Star8>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          {errors.jenis_kelamin ? (
            <span className={s.error} role="alert">
              <CircleAlert size={14} strokeWidth={2.4} />
              {errors.jenis_kelamin}
            </span>
          ) : (
            <span className={s.hint}>
              Kelas ikhwan dan akhwat terpisah, jadwalnya pun berbeda.
            </span>
          )}
        </div>

        <Field
          id="ds-nomor_wa"
          label="Nomor WhatsApp"
          error={errors.nomor_wa}
          hint={
            waNorm ? (
              <>
                Akan kami simpan sebagai <b>{waNorm}</b>
              </>
            ) : (
              "Nomor yang aktif di WhatsApp — pengumuman dikirim ke sini."
            )
          }
        >
          <div className={s.inputWrap}>
            <span className={s.inputPrefix} aria-hidden="true">
              WA
            </span>
            <input
              id="ds-nomor_wa"
              className={s.input}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="6281212341xxx"
              value={form.nomor_wa}
              onChange={(e) => update("nomor_wa", e.target.value)}
              onBlur={() => onBlur("nomor_wa")}
              aria-invalid={Boolean(errors.nomor_wa)}
              aria-describedby="ds-nomor_wa-msg"
            />
          </div>
        </Field>

        <Field id="ds-usia" label="Usia" error={errors.usia} hint={`Minimal ${DAR_SYAFII.usiaMin} tahun.`}>
          <div className={s.stepper}>
            <button
              type="button"
              className={s.stepperBtn}
              aria-label="Kurangi usia"
              onClick={() => update("usia", String(Math.max(DAR_SYAFII.usiaMin, (usiaNum || DAR_SYAFII.usiaMin + 1) - 1)))}
            >
              −
            </button>
            <input
              id="ds-usia"
              className={s.input}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="—"
              maxLength={3}
              value={form.usia}
              onChange={(e) => update("usia", e.target.value.replace(/\D/g, ""))}
              onBlur={() => onBlur("usia")}
              aria-invalid={Boolean(errors.usia)}
              aria-describedby="ds-usia-msg"
            />
            <button
              type="button"
              className={s.stepperBtn}
              aria-label="Tambah usia"
              onClick={() => update("usia", String(Math.min(100, (usiaNum || DAR_SYAFII.usiaMin - 1) + 1)))}
            >
              +
            </button>
          </div>
        </Field>

        <Field
          id="ds-kota"
          label="Kota domisili"
          error={errors.kota}
          hint="Tinggal di luar negeri? Pilih alamat Anda saat berada di Indonesia."
        >
          <KotaPicker
            id="ds-kota"
            value={form.kota}
            onChange={(k) => update("kota", k)}
            invalid={Boolean(errors.kota)}
            describedBy="ds-kota-msg"
          />
        </Field>

        <button type="submit" className={`${s.btnNight} ${s.btnBlock}`} style={{ marginTop: 6 }}>
          Lanjut pilih kelas
          <ArrowRight size={18} strokeWidth={2.6} />
        </button>
      </form>
    </Sheet>
  );
}
