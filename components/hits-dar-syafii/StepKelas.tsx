"use client";

import type { KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, MapPin } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { CATATAN_PENEMPATAN, LEVELS, jadwalUntuk, perluRekaman } from "@/lib/hits-dar-syafii";
import s from "./dar-syafii.module.css";
import k from "./kelas.module.css";
import { Sheet } from "./Shared";
import type { Errors, FormState } from "./types";

interface Props {
  form: FormState;
  errors: Errors;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onBack: () => void;
  onNext: () => void;
}

const ROMAWI = ["I", "II", "III", "IV", "V"];

/**
 * Panah/Home/End memindah pilihan di dalam radiogroup, seperti radio bawaan
 * browser — tanpa ini pengguna keyboard harus Tab melewati tiap kartu.
 */
function onRadioKey(e: KeyboardEvent<HTMLButtonElement>, ids: readonly string[], pilih: (id: string) => void) {
  const i = ids.indexOf(e.currentTarget.dataset.id ?? "");
  let n: number;
  if (e.key === "ArrowDown" || e.key === "ArrowRight") n = (i + 1) % ids.length;
  else if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = (i - 1 + ids.length) % ids.length;
  else if (e.key === "Home") n = 0;
  else if (e.key === "End") n = ids.length - 1;
  else return;
  const id = ids[n];
  if (id === undefined) return;
  e.preventDefault();
  pilih(id);
  const radios = e.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]');
  radios?.[n]?.focus();
}

/** Satu tab stop per grup: yang terpilih, atau kartu pertama kalau belum ada. */
function tabStop(checked: boolean, index: number, adaPilihan: boolean) {
  return checked || (!adaPilihan && index === 0) ? 0 : -1;
}

export function StepKelas({ form, errors, update, onBack, onNext }: Props) {
  const reduce = useReducedMotion();
  const pilihan = jadwalUntuk(form.jenis_kelamin);
  const kelompok = form.jenis_kelamin === "akhwat" ? "Kelas akhwat" : "Kelas ikhwan";
  const jadwalIds = pilihan.map((j) => j.id);
  const levelIds = LEVELS.map((l) => l.id);
  const jadwalDipilih = jadwalIds.includes(form.jadwal);
  const levelDipilih = (levelIds as readonly string[]).includes(form.level);

  return (
    <Sheet>
      <section className={k.group}>
        <div className={k.groupHead}>
          <span className={s.label} id="ds-jadwal-label">
            Jadwal kelas
          </span>
          {form.jenis_kelamin && (
            <span className={k.chip}>
              <MapPin size={12} strokeWidth={2.4} aria-hidden />
              {kelompok}
            </span>
          )}
        </div>

        {pilihan.length > 0 ? (
          <div
            role="radiogroup"
            aria-labelledby="ds-jadwal-label"
            aria-required="true"
            aria-invalid={errors.jadwal ? true : undefined}
            aria-describedby={errors.jadwal ? "ds-jadwal-msg" : undefined}
            className={k.list}
          >
            {pilihan.map((j, i) => {
              const checked = form.jadwal === j.id;
              return (
                <motion.button
                  key={j.id}
                  id={i === 0 ? "ds-jadwal" : undefined}
                  data-id={j.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={tabStop(checked, i, jadwalDipilih)}
                  className={k.jadwalCard}
                  onClick={() => update("jadwal", j.id)}
                  onKeyDown={(e) => onRadioKey(e, jadwalIds, (id) => update("jadwal", id))}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.3 }}
                >
                  <span className={k.dayTile} aria-hidden>
                    {j.hari.slice(0, 3)}
                  </span>
                  <span className={k.jadwalText}>
                    <span className={k.jadwalHari}>{j.hari}</span>
                    <span className={k.jadwalJam}>{j.jam} WIB</span>
                  </span>
                  <span className={k.dot} aria-hidden>
                    {checked && <Check size={13} strokeWidth={3.2} />}
                  </span>
                </motion.button>
              );
            })}
          </div>
        ) : (
          // Normalnya tidak tercapai (jenis kelamin wajib di langkah 1), tapi
          // isian tersimpan lama bisa saja belum punya jenis kelamin.
          <div className={k.empty}>
            <p>Jadwal dipisah untuk ikhwan dan akhwat. Pilih jenis kelamin dulu di langkah Data diri agar jadwal Anda muncul.</p>
            <button type="button" id="ds-jadwal" className={k.emptyBtn} onClick={onBack}>
              <ArrowLeft size={16} strokeWidth={2.4} aria-hidden />
              Kembali ke data diri
            </button>
          </div>
        )}

        {errors.jadwal && (
          <span className={s.error} id="ds-jadwal-msg" role="alert">
            <CircleAlert size={14} strokeWidth={2.4} />
            {errors.jadwal}
          </span>
        )}
      </section>

      <section className={`${k.group} ${k.groupLevel}`}>
        <span className={s.label} id="ds-level-label">
          Level kelas
        </span>
        <div
          role="radiogroup"
          aria-labelledby="ds-level-label"
          aria-required="true"
          aria-invalid={errors.level ? true : undefined}
          aria-describedby={errors.level ? "ds-level-msg" : undefined}
          className={`${k.list} ${k.levelList}`}
        >
          {LEVELS.map((l, i) => {
            const checked = form.level === l.id;
            return (
              <button
                key={l.id}
                id={i === 0 ? "ds-level" : undefined}
                data-id={l.id}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={tabStop(checked, i, levelDipilih)}
                className={k.levelCard}
                onClick={() => update("level", l.id)}
                onKeyDown={(e) => onRadioKey(e, levelIds, (id) => update("level", id))}
              >
                <span className={k.numeral} aria-hidden>
                  {ROMAWI[i] ?? i + 1}
                </span>
                <span className={k.levelText}>
                  <span className={k.levelName}>{l.nama}</span>
                  <span className={k.levelDesc}>{l.untuk}</span>
                  <span className={k.levelTag} data-rekam={perluRekaman(l.id) ? "ya" : "tidak"}>
                    {perluRekaman(l.id) ? "Setor rekaman bacaan" : "Tanpa rekaman"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <span className={s.hint}>{CATATAN_PENEMPATAN}</span>
        {errors.level && (
          <span className={s.error} id="ds-level-msg" role="alert">
            <CircleAlert size={14} strokeWidth={2.4} />
            {errors.level}
          </span>
        )}
      </section>

      <div className={`${s.navRow} ${k.navRow}`}>
        <button type="button" className={s.btnGhost} onClick={onBack}>
          Kembali
        </button>
        <button type="button" className={s.btnGreen} onClick={onNext}>
          {perluRekaman(form.level) ? "Lanjut ke rekaman" : "Lanjut, periksa"}
          <ArrowRight size={18} strokeWidth={2.6} />
        </button>
      </div>
    </Sheet>
  );
}
