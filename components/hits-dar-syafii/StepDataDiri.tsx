"use client";

import { ArrowRight, CircleAlert, Lock } from "lucide-react";
import { DAR_SYAFII, type Gender } from "@/lib/hits-dar-syafii";
import { normalizeWaNumber } from "@/lib/whatsapp";
import s from "./dar-syafii.module.css";
import x from "./data-diri.module.css";
import { KotaPicker } from "./KotaPicker";
import { Field, Sheet } from "./Shared";
import type { Errors, FieldKey, FormState } from "./types";

interface Props {
  form: FormState;
  errors: Errors;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onBlur: (key: FieldKey) => void;
  onNext: () => void;
}

const GENDER: { id: Gender; nama: string; sub: string }[] = [
  { id: "ikhwan", nama: "Laki-laki", sub: "Ikhwan · ayah / wali" },
  { id: "akhwat", nama: "Perempuan", sub: "Akhwat · ibu / wali" },
];

/**
 * Awalan +62 sudah tampil di kotak, jadi yang diketik hanya bagian lokal
 * (812…). Nilai yang disimpan tetap berawalan 62 supaya lolos WA_REGEX dan
 * normalizeWaNumber; "0"/"62"/"+62" yang ikut tertempel dibuang dari tampilan.
 */
function waLokal(v: string): string {
  return v.trimStart().replace(/^(?:(?:\+?\s*62|0)[\s-]*)+/, "");
}

export function StepDataDiri({ form, errors, update, onBlur, onNext }: Props) {
  const waNorm = form.nomor_wa ? normalizeWaNumber(form.nomor_wa) : null;
  const usiaNum = Number(form.usia) || 0;
  const genderPertama = GENDER.find((g) => DAR_SYAFII.genderDibuka.includes(g.id))?.id;

  return (
    <Sheet>
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

        <div className={`${x.row} ${x.rowAnak}`}>
          <Field id="ds-nama_anak" label="Nama anak" error={errors.nama_anak}>
            <input
              id="ds-nama_anak"
              className={`${s.input} ${x.inputTight}`}
              autoCapitalize="words"
              placeholder="Nama lengkap anak"
              value={form.nama_anak}
              onChange={(e) => update("nama_anak", e.target.value)}
              onBlur={() => onBlur("nama_anak")}
              aria-invalid={Boolean(errors.nama_anak)}
              aria-describedby="ds-nama_anak-msg ds-anak-hint"
            />
          </Field>
          <Field id="ds-kelas_anak" label="Kelas" error={errors.kelas_anak}>
            <input
              id="ds-kelas_anak"
              className={`${s.input} ${x.inputTight}`}
              autoCapitalize="characters"
              placeholder="cth. 2B SD"
              value={form.kelas_anak}
              onChange={(e) => update("kelas_anak", e.target.value)}
              onBlur={() => onBlur("kelas_anak")}
              aria-invalid={Boolean(errors.kelas_anak)}
              aria-describedby="ds-kelas_anak-msg ds-anak-hint"
            />
          </Field>
        </div>
        <span className={`${s.hint} ${x.rowHint}`} id="ds-anak-hint">
          Anak yang bersekolah di Darsyafii. Lebih dari satu anak? Pisahkan dengan koma, mis. 1A, 4C.
        </span>

        <div className={s.field}>
          <span className={s.label} id="ds-jenis_kelamin-label">
            Konfirmasi jenis kelamin
          </span>
          <div
            className={x.segTrack}
            role="radiogroup"
            aria-labelledby="ds-jenis_kelamin-label"
            aria-describedby="ds-jenis_kelamin-msg"
            aria-invalid={Boolean(errors.jenis_kelamin)}
            data-invalid={Boolean(errors.jenis_kelamin)}
          >
            {GENDER.map((g) => {
              const dibuka = DAR_SYAFII.genderDibuka.includes(g.id);
              const checked = form.jenis_kelamin === g.id;
              return (
                <button
                  key={g.id}
                  // Target fokus saat validasi gagal: opsi pertama yang bisa dipilih.
                  id={g.id === genderPertama ? "ds-jenis_kelamin" : undefined}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  disabled={!dibuka}
                  className={x.segOpt}
                  onClick={() => update("jenis_kelamin", g.id)}
                >
                  <span className={x.segName}>{g.nama}</span>
                  <span className={x.segSub}>
                    {!dibuka && <Lock size={11} strokeWidth={2.4} aria-hidden="true" />}
                    {dibuka ? g.sub : "Belum dibuka untuk angkatan ini"}
                  </span>
                </button>
              );
            })}
          </div>
          {errors.jenis_kelamin ? (
            <span className={s.error} id="ds-jenis_kelamin-msg" role="alert">
              <CircleAlert size={14} strokeWidth={2.4} />
              {errors.jenis_kelamin}
            </span>
          ) : (
            <span className={s.hint} id="ds-jenis_kelamin-msg">
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
                Disimpan sebagai <b>{waNorm}</b>
              </>
            ) : (
              "Tanpa 0 di depan. Nomor yang aktif di WhatsApp — pengumuman dikirim ke sini."
            )
          }
        >
          <div className={s.inputWrap}>
            <span className={s.inputPrefix} aria-hidden="true">
              +62
            </span>
            <input
              id="ds-nomor_wa"
              className={s.input}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="812 1234 5678"
              value={waLokal(form.nomor_wa)}
              onChange={(e) => {
                const lokal = waLokal(e.target.value);
                update("nomor_wa", lokal.trim() ? `62${lokal}` : "");
              }}
              onBlur={() => onBlur("nomor_wa")}
              aria-invalid={Boolean(errors.nomor_wa)}
              aria-describedby="ds-nomor_wa-msg"
            />
          </div>
        </Field>

        <div className={`${x.row} ${x.rowUsia}`}>
          <Field id="ds-usia" label="Usia" error={errors.usia}>
            <div className={x.stepper}>
              <button
                type="button"
                className={x.stepperBtn}
                aria-label="Kurangi usia"
                onClick={() => update("usia", String(Math.max(DAR_SYAFII.usiaMin, (usiaNum || DAR_SYAFII.usiaMin + 1) - 1)))}
              >
                −
              </button>
              <input
                id="ds-usia"
                className={x.stepperInput}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="—"
                maxLength={3}
                value={form.usia}
                onChange={(e) => update("usia", e.target.value.replace(/\D/g, ""))}
                onBlur={() => onBlur("usia")}
                aria-invalid={Boolean(errors.usia)}
                aria-describedby="ds-usia-msg ds-usia-kota-hint"
              />
              <button
                type="button"
                className={x.stepperBtn}
                aria-label="Tambah usia"
                onClick={() => update("usia", String(Math.min(100, (usiaNum || DAR_SYAFII.usiaMin - 1) + 1)))}
              >
                +
              </button>
            </div>
          </Field>
          <Field id="ds-kota" label="Kota domisili" error={errors.kota}>
            <KotaPicker
              id="ds-kota"
              value={form.kota}
              onChange={(k) => update("kota", k)}
              invalid={Boolean(errors.kota)}
              describedBy="ds-kota-msg ds-usia-kota-hint"
            />
          </Field>
        </div>
        <span className={`${s.hint} ${x.rowHint}`} id="ds-usia-kota-hint">
          Usia minimal {DAR_SYAFII.usiaMin} tahun. Tinggal di luar negeri? Pilih alamat Anda saat berada di Indonesia.
        </span>

        <button type="submit" className={`${s.btnGreen} ${s.btnBlock} ${x.submit}`}>
          Lanjut pilih kelas
          <ArrowRight size={18} strokeWidth={2.6} />
        </button>
      </form>

      <div className={x.foot}>
        <div className={s.footNote}>
          <Lock size={13} strokeWidth={2.2} aria-hidden="true" />
          Isian tersimpan otomatis di perangkat ini
        </div>
      </div>
    </Sheet>
  );
}
