"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Mic, Pause, Play, RotateCcw } from "lucide-react";
import { ASY_SYURA_1_6 } from "@/lib/arabic";
import { BASMALAH, DURASI_WAJAR_MIN_SEC, TAAWUDZ } from "@/lib/hits-dar-syafii";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import s from "./dar-syafii.module.css";
import x from "./rekam.module.css";
import { Sheet } from "./Shared";
import { AudioPill, LiveWave } from "./Wave";
import type { AudioTake } from "./types";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ANGKA_ARAB = "٠١٢٣٤٥٦٧٨٩";
const angkaArab = (n: number) => String(n).replace(/\d/g, (d) => ANGKA_ARAB[Number(d)]!);

export function fmtDurasi(sec: number): string {
  const t = Math.max(0, Math.floor(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function readDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const a = new Audio();
    const timer = window.setTimeout(() => resolve(null), 6000);
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      window.clearTimeout(timer);
      resolve(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : null);
    };
    a.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    a.src = url;
  });
}

interface Props {
  nama: string;
  audio: AudioTake | null;
  onAudio: (a: AudioTake | null) => void;
  error: string | null;
  onBack: () => void;
  onNext: () => void;
}

export function StepRekam({ nama, audio, onAudio, error, onBack, onNext }: Props) {
  const rec = useAudioRecorder();
  const [latin, setLatin] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const handedOff = useRef<Blob | null>(null);

  // Rekaman selesai → serahkan ke induk, supaya tetap ada walau peserta
  // bolak-balik antar langkah (komponen ini dilepas saat pindah langkah).
  useEffect(() => {
    if (rec.status === "stopped" && rec.audioBlob && handedOff.current !== rec.audioBlob) {
      handedOff.current = rec.audioBlob;
      onAudio({
        blob: rec.audioBlob,
        url: URL.createObjectURL(rec.audioBlob),
        durationSec: rec.durationSec,
        sumber: "rekam",
      });
    }
  }, [rec.status, rec.audioBlob, rec.durationSec, onAudio]);

  const recording = rec.status === "recording" || rec.status === "paused";
  const ready = Boolean(audio) && !recording;

  function ulangi() {
    handedOff.current = null;
    onAudio(null);
    rec.reset();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("Berkas terlalu besar (maks. 25 MB).");
      return;
    }
    if (file.type && !file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
      setUploadError("Berkas yang dipilih bukan rekaman suara.");
      return;
    }
    const url = URL.createObjectURL(file);
    const durationSec = await readDuration(url);
    rec.reset();
    handedOff.current = null;
    onAudio({ blob: file, url, durationSec, sumber: "unggah", fileName: file.name });
  }

  const pendek =
    audio?.durationSec != null && audio.durationSec < DURASI_WAJAR_MIN_SEC;

  let status: React.ReactNode;
  if (rec.status === "requesting") status = "Meminta izin mikrofon…";
  else if (rec.status === "recording")
    status = (
      <>
        <span className={x.recDot} aria-hidden />
        Merekam — gulir teks sambil membaca
      </>
    );
  else if (rec.status === "paused")
    status = (
      <>
        <span className={x.pausedDot} aria-hidden />
        Dijeda. Lanjutkan kalau sudah siap.
      </>
    );
  else if (ready && audio)
    status =
      audio.sumber === "unggah"
        ? `Berkas: ${audio.fileName ?? "rekaman"}`
        : "Rekaman siap. Dengarkan dulu sebelum lanjut.";
  else status = "Tekan tombol emas, lalu baca urutan di atas.";

  const timerText = recording
    ? fmtDurasi(rec.durationSec)
    : audio
      ? audio.durationSec != null
        ? fmtDurasi(audio.durationSec)
        : "—"
      : "0:00";

  const namaTampil = nama.trim() || "…";

  return (
    <>
      <Sheet>
        <div className={x.body}>
          <div className={x.chips}>
            <span className={`${x.chip} ${x.chipMain}`}>Asy-Syura · surat ke-42</span>
            <span className={x.chip}>Hal. 483</span>
            <span className={x.chip}>Ayat 1–6</span>
          </div>
          <p className={x.caution}>
            Berbeda dengan <b>Asy-Syu&rsquo;ara</b> (surat ke-26) — pastikan membuka
            surat yang benar.
          </p>

          <ol className={x.script} aria-label="Urutan bacaan">
            <li className={x.scriptItem}>
              <span className={x.num} aria-hidden>1</span>
              <div className={x.say}>
                <span className={x.scriptLabel}>Salam &amp; perkenalan</span>
                &ldquo;Assalamu&rsquo;alaikum warahmatullahi wabarakatuh. Nama saya{" "}
                <b>{namaTampil}</b>.&rdquo;
              </div>
            </li>
            <li className={x.scriptItem}>
              <span className={x.num} aria-hidden>2</span>
              <div>
                <span className={s.srOnly}>Ta&rsquo;awudz: </span>
                <div className={x.arabic} lang="ar" dir="rtl">
                  {TAAWUDZ}
                </div>
              </div>
            </li>
            <li className={x.scriptItem}>
              <span className={x.num} aria-hidden>3</span>
              <div>
                <span className={s.srOnly}>Basmalah: </span>
                <div className={x.arabic} lang="ar" dir="rtl">
                  {BASMALAH}
                </div>
              </div>
            </li>
          </ol>

          <div className={x.ayatHead}>
            <h3 className={x.ayatTitle}>4 · Asy-Syura ayat 1–6</h3>
            <button
              type="button"
              className={x.latinBtn}
              aria-expanded={latin}
              aria-controls={latin ? "ds-rekam-latin" : undefined}
              onClick={() => setLatin((v) => !v)}
            >
              {latin ? "Sembunyikan latin" : "Tampilkan latin"}
            </button>
          </div>
          <div className={x.mushaf}>
            <p className={x.ayat} lang="ar" dir="rtl">
              {ASY_SYURA_1_6.map((a) => (
                <span key={a.number}>
                  {a.arabic}
                  <span className={x.ayahNum}>{angkaArab(a.number)}</span>{" "}
                </span>
              ))}
            </p>
            {latin && (
              <p className={x.latin} id="ds-rekam-latin">
                {ASY_SYURA_1_6.map((a) => `(${a.number}) ${a.transliterasi}`).join("  ")}
              </p>
            )}
          </div>

          <div className={x.accordion}>
            <details className={x.details}>
              <summary>Belum bisa membaca Asy-Syura?</summary>
              <p>
                Tidak apa-apa. Setelah salam dan memperkenalkan nama, sampaikan saja
                bahwa Anda belum bisa membaca surat dan ayat yang diminta, lalu tetap
                kirim rekamannya. Semoga Allah ta&apos;ala mudahkan.
              </p>
            </details>
            <details className={x.details}>
              <summary>Tips supaya rekaman jelas</summary>
              <p>
                Cari tempat yang tenang, pegang HP sekitar sejengkal dari mulut, dan
                jangan tutup halaman ini selama merekam. Batas rekaman 5 menit.
              </p>
            </details>
          </div>

          <p className={x.upload}>
            Sudah merekam di aplikasi lain?{" "}
            <button
              type="button"
              disabled={recording}
              onClick={() => fileRef.current?.click()}
            >
              Unggah berkas
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*,.m4a,.mp3,.aac,.wav,.ogg,.opus,.webm,.3gp,.amr"
              hidden
              onChange={onFile}
            />
          </p>
          {uploadError && (
            <p className={`${s.error} ${x.uploadError}`} role="alert">
              {uploadError}
            </p>
          )}

          {/* Pita hijau juga punya tombol kembali; yang ini untuk yang sudah
              menggulir sampai bawah. Dimatikan saat merekam supaya rekaman
              yang sedang berjalan tidak hilang karena salah ketuk. */}
          <button type="button" className={x.back} onClick={onBack} disabled={recording}>
            <ArrowLeft size={15} strokeWidth={2.4} />
            Ubah pilihan kelas
          </button>
        </div>
      </Sheet>

      <div className={x.dock}>
        <div className={x.dockInner}>
          <div className={x.dockRow}>
            {recording ? (
              <button
                type="button"
                className={x.mic}
                data-state="recording"
                onClick={rec.stop}
                aria-label="Selesai merekam"
              >
                <span className={x.stopIcon} aria-hidden />
              </button>
            ) : ready ? (
              <button
                type="button"
                className={x.mic}
                data-state="ready"
                onClick={ulangi}
                aria-label="Rekam ulang"
              >
                <RotateCcw size={22} strokeWidth={2.4} />
              </button>
            ) : (
              <button
                type="button"
                className={x.mic}
                data-state="idle"
                onClick={() => void rec.start()}
                disabled={rec.status === "requesting"}
                aria-label="Mulai merekam"
              >
                <Mic size={24} strokeWidth={2.4} />
              </button>
            )}

            <div className={x.readout}>
              {/* role=timer tidak diumumkan tiap detik; yang diumumkan hanya
                  perubahan status di bawahnya. */}
              <div className={x.timer} role="timer">
                {timerText}
              </div>
              <div className={x.status} aria-live="polite">
                {status}
              </div>
            </div>

            {recording &&
              (rec.status === "recording" ? (
                <button type="button" className={x.iconBtn} onClick={rec.pause} aria-label="Jeda">
                  <Pause size={16} strokeWidth={0} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  className={x.iconBtn}
                  onClick={rec.resume}
                  aria-label="Lanjutkan merekam"
                >
                  <Play size={16} strokeWidth={0} fill="currentColor" />
                </button>
              ))}
          </div>

          {recording && (
            <div className={x.wave}>
              <LiveWave analyser={rec.analyser} active={rec.status === "recording"} />
            </div>
          )}

          {(rec.errorMessage || error) && !recording && (
            <div className={x.dockError} role="alert">
              {error ?? rec.errorMessage}
              {rec.status === "denied" && (
                <>
                  {" "}
                  Atau{" "}
                  <button
                    type="button"
                    className={x.dockLink}
                    onClick={() => fileRef.current?.click()}
                  >
                    unggah rekaman dari HP
                  </button>
                  .
                </>
              )}
            </div>
          )}

          {ready && audio && (
            <>
              <div className={x.wave}>
                <AudioPill src={audio.url} durationSec={audio.durationSec} tone="dark" />
              </div>
              {pendek && (
                <div className={x.warn}>
                  Rekaman ini hanya {fmtDurasi(audio.durationSec!)}. Salam sampai
                  ayat 6 biasanya butuh 1–1,5 menit. Kalau memang belum bisa membaca
                  Asy-Syura dan sudah menyampaikannya di rekaman, tidak apa-apa —
                  silakan lanjut.
                </div>
              )}
              <div className={x.actions}>
                <button type="button" className={x.btnRedo} onClick={ulangi}>
                  Ulangi
                </button>
                <button type="button" className={x.btnNext} onClick={onNext}>
                  Lanjut, tinjau
                  <ArrowRight size={16} strokeWidth={2.6} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
