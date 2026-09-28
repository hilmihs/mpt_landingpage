"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { daftarSchema, findJadwal } from "@/lib/hits-dar-syafii";
import s from "./dar-syafii.module.css";
import { Crescent, Star8, StarField } from "./Ornaments";
import { Pembuka } from "./Pembuka";
import { StepDataDiri } from "./StepDataDiri";
import { StepKelas } from "./StepKelas";
import { StepRekam } from "./StepRekam";
import { StepTinjau } from "./StepTinjau";
import { Selesai } from "./Selesai";
import {
  EMPTY_FORM,
  type AudioTake,
  type Errors,
  type FieldKey,
  type FormState,
  type SendState,
} from "./types";

const STORAGE_KEY = "hits-dar-syafii:v1";

const STEPS = ["Data diri", "Kelas", "Rekaman", "Kirim"] as const;

const STEP_FIELDS: Record<1 | 2, FieldKey[]> = {
  1: ["email", "nama", "nama_anak", "kelas_anak", "jenis_kelamin", "nomor_wa", "usia", "kota"],
  2: ["jadwal", "level"],
};

/** Langkah tempat sebuah field diisi — dipakai saat server menolak isian. */
function stepOf(key: string): 1 | 2 | 3 {
  if ((STEP_FIELDS[1] as string[]).includes(key)) return 1;
  if ((STEP_FIELDS[2] as string[]).includes(key)) return 2;
  return 3;
}

export function validateField(key: FieldKey, value: string): string | undefined {
  if (value.trim() === "") {
    if (key === "jenis_kelamin") return "Konfirmasi jenis kelamin Anda";
    if (key === "kota") return "Pilih kota domisili dari daftar";
    if (key === "jadwal") return "Pilih salah satu jam belajar";
    if (key === "level") return "Pilih level kelas";
    return "Wajib diisi";
  }
  const res = daftarSchema.shape[key].safeParse(value);
  return res.success ? undefined : res.error.issues[0]?.message;
}

function validateStep(form: FormState, step: 1 | 2): Errors {
  const errs: Errors = {};
  for (const key of STEP_FIELDS[step]) {
    const e = validateField(key, form[key]);
    if (e) errs[key] = e;
  }
  if (step === 2 && !errs.jadwal && findJadwal(form.jadwal)?.gender !== form.jenis_kelamin) {
    errs.jadwal = "Pilih jadwal kelas yang sesuai";
  }
  return errs;
}

export function DaftarDarSyafii() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [audio, setAudio] = useState<AudioTake | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [send, setSend] = useState<SendState>({ kind: "idle" });
  const [done, setDone] = useState<{ nama: string; waTerkirim: boolean } | null>(null);
  const [restored, setRestored] = useState(false);
  const formTopRef = useRef<HTMLDivElement | null>(null);

  // Isian yang sudah diketik disimpan di sessionStorage supaya muat ulang
  // halaman tidak menghapusnya; dipulihkan saat peserta menekan "Mulai daftar"
  // (bukan saat mount, supaya HTML server dan klien tetap sama). Rekaman tidak
  // ikut disimpan — terlalu besar.
  function mulai() {
    let target = 1;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { form?: Partial<FormState>; step?: number };
        if (saved.form) setForm({ ...EMPTY_FORM, ...saved.form });
        if (typeof saved.step === "number" && saved.step >= 1 && saved.step <= 3) target = saved.step;
      }
    } catch {
      // Mode privat atau storage diblokir — mulai dari kosong saja.
    }
    setRestored(true);
    goTo(target);
  }

  useEffect(() => {
    if (!restored || done) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ form, step: Math.min(step, 3) }));
    } catch {
      // abaikan
    }
  }, [form, step, restored, done]);

  // Peringatkan sebelum menutup tab kalau sudah ada rekaman yang belum dikirim.
  useEffect(() => {
    if (!audio || done) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [audio, done]);

  const goTo = useCallback(
    (next: number) => {
      setStep(next);
      requestAnimationFrame(() => {
        const el = formTopRef.current;
        if (!el) {
          window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
          return;
        }
        const top = el.getBoundingClientRect().top + window.scrollY - 8;
        window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
      });
    },
    [reduce],
  );

  const gantiAudio = useCallback((a: AudioTake | null) => {
    setAudio((prev) => {
      if (prev && prev.url !== a?.url) URL.revokeObjectURL(prev.url);
      return a;
    });
    setAudioError(null);
  }, []);

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Jadwal dipisah per jenis kelamin; ganti jenis kelamin → pilihan lama gugur.
      if (key === "jenis_kelamin" && findJadwal(f.jadwal)?.gender !== value) next.jadwal = "";
      return next;
    });
    setErrors((e) => (e[key as FieldKey] ? { ...e, [key]: undefined } : e));
  }, []);

  const blurValidate = useCallback(
    (key: FieldKey) => {
      if (form[key].trim() === "") return;
      const e = validateField(key, form[key]);
      setErrors((prev) => ({ ...prev, [key]: e }));
    },
    [form],
  );

  function next(from: 1 | 2) {
    const errs = validateStep(form, from);
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      document.getElementById(`ds-${first}`)?.focus({ preventScroll: false });
      return;
    }
    goTo(from + 1);
  }

  function submit() {
    const all = { ...validateStep(form, 1), ...validateStep(form, 2) };
    const first = Object.keys(all)[0];
    if (first) {
      setErrors(all);
      goTo(stepOf(first));
      return;
    }
    if (!audio) {
      setAudioError("Rekaman bacaan belum ada.");
      goTo(3);
      return;
    }

    const fd = new FormData();
    (Object.keys(form) as (keyof FormState)[]).forEach((k) => fd.append(k, form[k]));
    const ext = audio.fileName?.split(".").pop() ?? (audio.blob.type.includes("mp4") ? "m4a" : "webm");
    fd.append("audio", audio.blob, audio.fileName ?? `rekaman.${ext}`);
    fd.append("audio_sumber", audio.sumber);
    if (audio.durationSec !== null) fd.append("audio_duration_sec", audio.durationSec.toFixed(1));

    // XHR, bukan fetch: fetch belum bisa melaporkan progres unggah, dan di
    // jaringan HP rekaman 1-2 MB bisa makan waktu — peserta perlu melihat
    // bahwa sesuatu sedang berjalan.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/hits/dar-syafii");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setSend({ kind: "sending", pct: Math.round((e.loaded / e.total) * 100) });
    };
    xhr.onerror = () =>
      setSend({ kind: "error", message: "Koneksi terputus. Periksa jaringan Anda lalu tekan Kirim lagi." });
    xhr.onload = () => {
      const body = (xhr.response ?? {}) as {
        ok?: boolean;
        error?: string;
        message?: string;
        fields?: Record<string, string>;
        wa_terkirim?: boolean;
      };
      if (xhr.status >= 200 && xhr.status < 300 && body.ok) {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          // abaikan
        }
        setDone({ nama: form.nama.trim(), waTerkirim: Boolean(body.wa_terkirim) });
        setSend({ kind: "idle" });
        goTo(5);
        return;
      }
      if (body.fields) {
        setErrors(body.fields as Errors);
        const f = Object.keys(body.fields)[0];
        setSend({ kind: "error", message: body.message ?? "Ada isian yang perlu diperbaiki." });
        if (f) goTo(stepOf(f));
        return;
      }
      if (body.error?.startsWith("audio_")) {
        setAudioError(body.message ?? "Rekaman bermasalah. Mohon rekam ulang.");
        setSend({ kind: "idle" });
        goTo(3);
        return;
      }
      setSend({
        kind: "error",
        message: body.message ?? "Pendaftaran belum terkirim. Coba lagi sebentar.",
      });
    };
    setSend({ kind: "sending", pct: 0 });
    xhr.send(fd);
  }

  const slide = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        // Tanpa filter blur: di HP kelas bawah blur pada kartu setinggi ini
        // membuat transisi tersendat.
        initial: { opacity: 0, y: 24 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -16 },
      };

  const inFlow = step >= 1 && step <= 4;

  return (
    <div className={s.shell}>
      <div className={s.sky} aria-hidden="true">
        <StarField />
        <Crescent size={58} className={s.moon} />
        <div className={s.groundPattern} />
      </div>

      <div className={s.content}>
        <div className={s.topbar}>
          {inFlow ? (
            <button type="button" className={s.backLink} onClick={() => goTo(step - 1)}>
              <ArrowLeft size={15} strokeWidth={2.4} />
              {step === 1 ? "Tentang program" : "Kembali"}
            </button>
          ) : (
            <Link href="/" className={s.backLink}>
              <ArrowLeft size={15} strokeWidth={2.4} />
              Beranda
            </Link>
          )}
          <span className={s.brand}>Muhajir Project Tilawah</span>
        </div>

        {step === 0 && <Pembuka onStart={mulai} />}

        {step >= 1 && (
          <div className={s.formArea} ref={formTopRef}>
            {inFlow && <Progress step={step} onJump={(n) => n < step && goTo(n)} />}

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                {...slide}
                transition={{ duration: reduce ? 0.15 : 0.45, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {step === 1 && (
                  <StepDataDiri
                    form={form}
                    errors={errors}
                    update={update}
                    onBlur={blurValidate}
                    onNext={() => next(1)}
                  />
                )}
                {step === 2 && (
                  <StepKelas
                    form={form}
                    errors={errors}
                    update={update}
                    onBack={() => goTo(1)}
                    onNext={() => next(2)}
                  />
                )}
                {step === 3 && (
                  <StepRekam
                    nama={form.nama}
                    audio={audio}
                    onAudio={gantiAudio}
                    error={audioError}
                    onBack={() => goTo(2)}
                    onNext={() => goTo(4)}
                  />
                )}
                {step === 4 && (
                  <StepTinjau
                    form={form}
                    audio={audio}
                    send={send}
                    onEdit={goTo}
                    onSubmit={submit}
                  />
                )}
                {step === 5 && done && <Selesai nama={done.nama} waTerkirim={done.waTerkirim} />}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function Progress({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  const pct = ((step - 1) / (STEPS.length - 1)) * 75;
  return (
    <nav className={s.progress} aria-label="Langkah pendaftaran">
      <div className={s.progressTrack} />
      <div className={s.progressFill} style={{ width: `${pct}%` }} />
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "current" : "todo";
        return (
          <button
            key={label}
            type="button"
            className={s.progressNode}
            data-state={state}
            onClick={() => onJump(n)}
            disabled={state !== "done"}
            aria-current={state === "current" ? "step" : undefined}
          >
            <Star8 size={36} filled={state !== "todo"}>
              {state === "done" ? "✓" : n}
            </Star8>
            <span className={s.progressLabel}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
