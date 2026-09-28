"use client";

import { ArrowRight, Check, CircleAlert, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { DAR_SYAFII, LEVELS, jadwalUntuk } from "@/lib/hits-dar-syafii";
import s from "./dar-syafii.module.css";
import { LevelGlyph, TimeGlyph, WeekStrip } from "./Ornaments";
import { Sheet } from "./StepDataDiri";
import type { Errors, FormState } from "./types";

interface Props {
  form: FormState;
  errors: Errors;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepKelas({ form, errors, update, onBack, onNext }: Props) {
  const pilihan = jadwalUntuk(form.jenis_kelamin);
  const kelompok = form.jenis_kelamin === "akhwat" ? "Kelas akhwat" : "Kelas ikhwan";

  return (
    <Sheet>
      <div className={s.stepEyebrow}>Langkah 2 dari 4</div>
      <h2 className={s.stepTitle}>
        Pilih <em>kelas</em> Anda
      </h2>
      <p className={s.stepDesc}>
        Kelas berlangsung tatap muka di {DAR_SYAFII.tempat}. Yang tampil hanya
        jadwal {kelompok.toLowerCase()} yang masih tersedia — pilih yang
        benar-benar bisa Anda hadiri tiap pekan.
      </p>

      <div className={s.fields}>
        <div className={s.field}>
          <span className={s.label} id="ds-jadwal-label">
            Jadwal kelas
          </span>
          <div role="radiogroup" aria-labelledby="ds-jadwal-label" className={s.optionList}>
            <div className={s.groupTitle}>
              <MapPin size={13} strokeWidth={2.4} />
              {kelompok} · {DAR_SYAFII.tempat}
            </div>
            {pilihan.map((j, i) => {
              const checked = form.jadwal === j.id;
              return (
                <motion.button
                  key={j.id}
                  id={i === 0 ? "ds-jadwal" : undefined}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  className={s.jadwalCard}
                  onClick={() => update("jadwal", j.id)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.3 }}
                >
                  <TimeGlyph jam={j.jam} />
                  <span>
                    <span className={s.jadwalHari} style={{ display: "block" }}>
                      {j.hari}
                    </span>
                    <span className={s.jadwalJam} style={{ display: "block" }}>
                      {j.jam} WIB
                    </span>
                    <WeekStrip hari={j.hari} />
                  </span>
                  <span className={s.radioDot}>{checked && <Check size={14} strokeWidth={3} />}</span>
                </motion.button>
              );
            })}
          </div>
          {errors.jadwal && (
            <span className={s.error} role="alert">
              <CircleAlert size={14} strokeWidth={2.4} />
              {errors.jadwal}
            </span>
          )}
        </div>

        <div className={s.field}>
          <span className={s.label} id="ds-level-label">
            Level kelas
          </span>
          <div className={s.levelGrid} role="radiogroup" aria-labelledby="ds-level-label">
            {LEVELS.map((l, i) => {
              const checked = form.level === l.id;
              return (
                <button
                  key={l.id}
                  id={i === 0 ? "ds-level" : undefined}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  className={s.levelCard}
                  onClick={() => update("level", l.id)}
                >
                  <LevelGlyph level={l.id} active={checked} />
                  <span>
                    <span className={s.levelName} style={{ display: "block" }}>
                      {l.nama}
                    </span>
                    <span className={s.levelDesc} style={{ display: "block" }}>
                      {l.untuk}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {errors.level && (
            <span className={s.error} role="alert">
              <CircleAlert size={14} strokeWidth={2.4} />
              {errors.level}
            </span>
          )}
        </div>
      </div>

      <div className={s.navRow}>
        <button type="button" className={s.btnGhost} onClick={onBack}>
          Kembali
        </button>
        <button type="button" className={s.btnNight} onClick={onNext}>
          Lanjut ke rekaman
          <ArrowRight size={18} strokeWidth={2.6} />
        </button>
      </div>
    </Sheet>
  );
}
