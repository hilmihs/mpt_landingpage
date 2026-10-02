"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { DAR_SYAFII, daftarSchema, findJadwal, perluRekaman } from "@/lib/hits-dar-syafii";
import s from "./dar-syafii.module.css";
import { Pembuka, type FaqItem } from "./Pembuka";
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

const STEPS = [
  { n: 1, label: "Data diri" },
  { n: 2, label: "Kelas" },
  { n: 3, label: "Rekaman" },
  { n: 4, label: "Kirim" },
] as const;

/** Langkah yang dilalui peserta — tanpa langkah rekaman kalau levelnya tidak memerlukannya. */
function langkahUntuk(level: string) {
  return perluRekaman(level) ? STEPS : STEPS.filter((l) => l.n !== 3);
}

const STEP_FIELDS: Record<1 | 2, FieldKey[]> = {
  1: ["email", "nama", "jenis_kelamin", "nomor_wa", "usia", "kota"],
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

export function DaftarDarSyafii({ faq }: { faq: readonly FaqItem[] }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [audio, setAudio] = useState<AudioTake | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [send, setSend] = useState<SendState>({ kind: "idle" });
  const [done, setDone] = useState<{ nama: string; waTerkirim: boolean; denganRekaman: boolean } | null>(null);
  const [restored, setRestored] = useState(false);
  const formTopRef = useRef<HTMLDivElement | null>(null);

  // Isian yang sudah diketik disimpan di localStorage supaya muat ulang atau
  // tab yang tertutup tidak menghapusnya (dihapus setelah berhasil terkirim);
  // dipulihkan saat peserta menekan "Mulai daftar"
  // (bukan saat mount, supaya HTML server dan klien tetap sama). Rekaman tidak
  // ikut disimpan — terlalu besar.
  function mulai() {
    let target = 1;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { form?: Partial<FormState>; step?: number };
        if (saved.form) setForm({ ...EMPTY_FORM, ...saved.form });
        if (typeof saved.step === "number" && saved.step >= 1 && saved.step <= 3) target = saved.step;
        if (target === 3 && !perluRekaman(saved.form?.level ?? "")) target = 2;
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, step: Math.min(step, 3) }));
    } catch {
      // abaikan
    }
  }, [form, step, restored, done]);

  const denganRekaman = perluRekaman(form.level);
  // Rekaman yang tersisa setelah peserta pindah ke level tanpa rekaman tidak
  // ikut dikirim, jadi tidak perlu dijaga.
  const adaRekaman = Boolean(audio) && denganRekaman;

  // Peringatkan sebelum menutup tab kalau sudah ada rekaman yang belum dikirim.
  useEffect(() => {
    if (!adaRekaman || done) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [adaRekaman, done]);

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
    goTo(from === 2 && !perluRekaman(form.level) ? 4 : from + 1);
  }

  function submit() {
    const all = { ...validateStep(form, 1), ...validateStep(form, 2) };
    const first = Object.keys(all)[0];
    if (first) {
      setErrors(all);
      goTo(stepOf(first));
      return;
    }
    if (denganRekaman && !audio) {
      setAudioError("Rekaman bacaan belum ada.");
      goTo(3);
      return;
    }

    const fd = new FormData();
    (Object.keys(form) as (keyof FormState)[]).forEach((k) => fd.append(k, form[k]));
    if (denganRekaman && audio) {
      const ext = audio.fileName?.split(".").pop() ?? (audio.blob.type.includes("mp4") ? "m4a" : "webm");
      fd.append("audio", audio.blob, audio.fileName ?? `rekaman.${ext}`);
      fd.append("audio_sumber", audio.sumber);
      if (audio.durationSec !== null) fd.append("audio_duration_sec", audio.durationSec.toFixed(1));
    }

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
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // abaikan
        }
        setDone({ nama: form.nama.trim(), waTerkirim: Boolean(body.wa_terkirim), denganRekaman });
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
      {step === 0 && <Pembuka onStart={mulai} faq={faq} />}

      {step >= 1 && (
        <div ref={formTopRef} className={inFlow ? s.flow : undefined}>
          {inFlow && (
            <StepHeader
              step={step}
              langkah={langkahUntuk(form.level)}
              adaRekaman={adaRekaman}
              onBack={() => goTo(step === 4 && !denganRekaman ? 2 : step - 1)}
              onJump={(n) => n < step && goTo(n)}
            />
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              {...slide}
              transition={{ duration: reduce ? 0.15 : 0.4, ease: [0.2, 0.8, 0.2, 1] }}
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
                  denganRekaman={denganRekaman}
                  send={send}
                  onEdit={goTo}
                  onSubmit={submit}
                />
              )}
              {step === 5 && done && (
                <Selesai nama={done.nama} waTerkirim={done.waTerkirim} denganRekaman={done.denganRekaman} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/** Judul tiap langkah — dirender di pita hijau, bukan di dalam lembar isian. */
const STEP_HEAD: Record<1 | 2 | 3 | 4, { eyebrow: string; title: React.ReactNode; desc: React.ReactNode }> = {
  1: {
    eyebrow: "Data diri",
    title: (
      <>
        Kenalan <em>dulu</em>
      </>
    ),
    desc: "Diisi orang tua atau wali murid yang akan belajar. Admin menghubungi Anda lewat WhatsApp.",
  },
  2: {
    eyebrow: "Kelas",
    title: (
      <>
        Pilih <em>kelas</em> Anda
      </>
    ),
    desc: `Tatap muka di ${DAR_SYAFII.tempat}. Pilih yang pasti bisa Anda hadiri tiap pekan.`,
  },
  3: {
    eyebrow: "Ujian masuk",
    title: (
      <>
        Rekam <em>bacaan</em> Anda
      </>
    ),
    desc: "Didengarkan pengajar untuk penempatan kelas. Tidak ada yang dinilai dari kecepatan.",
  },
  4: {
    eyebrow: "Kirim",
    title: (
      <>
        Periksa <em>sekali lagi</em>
      </>
    ),
    desc: "Pastikan nomor WhatsApp benar — pengumuman dan tautan grup kelas dikirim ke sana.",
  },
};

function StepHeader({
  step,
  langkah,
  adaRekaman,
  onBack,
  onJump,
}: {
  step: number;
  langkah: readonly { n: number; label: string }[];
  adaRekaman: boolean;
  onBack: () => void;
  onJump: (n: number) => void;
}) {
  const head = STEP_HEAD[step as 1 | 2 | 3 | 4];
  const posisi = langkah.findIndex((l) => l.n === step) + 1;
  return (
    <header className={s.stepHead}>
      <div className={`${s.stepHeadInner} ${s.col}`}>
        <div className={s.stepBar}>
          <button
            type="button"
            className={s.roundBtn}
            onClick={onBack}
            aria-label={step === 1 ? "Kembali ke tentang program" : "Kembali ke langkah sebelumnya"}
          >
            <ChevronLeft size={18} strokeWidth={2.2} />
          </button>
          <Link
            href="/"
            aria-label="Muhajir Project Tilawah — beranda"
            onClick={(e) => {
              // Navigasi klien tidak memicu beforeunload, jadi rekaman yang
              // belum dikirim perlu dijaga di sini sendiri.
              if (adaRekaman && !window.confirm("Rekaman yang belum dikirim akan hilang. Tetap ke beranda?")) {
                e.preventDefault();
              }
            }}
          >
            <Image src="/logo-mpt.png" alt="" width={34} height={34} className={s.logo} priority />
          </Link>
          <span className={s.stepCount} aria-hidden="true">
            {posisi} / {langkah.length}
          </span>
        </div>

        <nav
          className={s.bars}
          aria-label="Langkah pendaftaran"
          style={{ gridTemplateColumns: `repeat(${langkah.length}, 1fr)` }}
        >
          {langkah.map(({ n, label }, i) => {
            const state = n < step ? "done" : n === step ? "current" : "todo";
            return (
              <button
                key={n}
                type="button"
                className={s.bar}
                data-state={state}
                onClick={() => onJump(n)}
                disabled={state !== "done"}
                aria-current={state === "current" ? "step" : undefined}
                aria-label={`Langkah ${i + 1}: ${label}${state === "done" ? " (selesai, buka lagi)" : ""}`}
              />
            );
          })}
        </nav>

        <div className={s.eyebrow}>{head.eyebrow}</div>
        <h2 className={s.stepTitle}>{head.title}</h2>
        <p className={s.stepDesc}>{head.desc}</p>

        {/* Hanya tampil di layar lebar, mengisi dasar panel hijau. */}
        <div className={s.stepAside} aria-hidden="true">
          <span>Muhajir Project Tilawah × Darsyafii</span>
        </div>
      </div>
    </header>
  );
}
