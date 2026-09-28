"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Mic, Pause, Play, RotateCcw, Square, Upload } from "lucide-react";
import { ASY_SYURA_1_6 } from "@/lib/arabic";
import { BASMALAH, DURASI_WAJAR_MIN_SEC, TAAWUDZ } from "@/lib/hits-dar-syafii";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import s from "./dar-syafii.module.css";
import { Star8 } from "./Ornaments";
import { Sheet } from "./StepDataDiri";
import { HaloVisualizer } from "./HaloVisualizer";
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
        <span className={s.recDot} />
        Merekam — gulir teks sambil membaca
      </>
    );
  else if (rec.status === "paused") status = "Dijeda. Lanjutkan kalau sudah siap.";
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

  return (
    <>
      <Sheet>
        <div className={s.stepEyebrow}>Langkah 3 dari 4 · Ujian masuk</div>
        <h2 className={s.stepTitle}>
          Rekam <em>bacaan</em> Anda
        </h2>
        <p className={s.stepDesc}>
          Rekaman ini didengarkan pengajar untuk menempatkan Anda di kelas yang
          sesuai. Bacalah dengan tenang — tidak ada yang dinilai dari kecepatan.
        </p>

        <div className={s.callout}>
          <BookOpen size={20} strokeWidth={2.2} className={s.calloutIcon} />
          <div>
            Bacaan yang diminta: <strong>Surat Asy-Syura</strong>, ayat 1–6.
            <br />
            Hati-hati, surat ini <strong>berbeda</strong> dengan Surat
            Asy-Syu&apos;ara (surat ke-26).
            <div className={s.surahMeta}>
              <span>Surat ke-42</span>
              <span>Halaman 483</span>
              <span>Ayat 1–6</span>
            </div>
          </div>
        </div>

        <ol className={s.script}>
          <li className={s.scriptItem}>
            <Star8 size={32} className={s.scriptNum}>1</Star8>
            <div>
              <div className={s.scriptTitle}>Salam &amp; perkenalan</div>
              <div className={s.scriptSay}>
                &ldquo;Assalamu&apos;alaikum warahmatullahi wabarakatuh. Nama saya{" "}
                <b>{nama.trim() || "…"}</b>.&rdquo;
              </div>
            </div>
          </li>
          <li className={s.scriptItem}>
            <Star8 size={32} className={s.scriptNum}>2</Star8>
            <div>
              <div className={s.scriptTitle}>Ta&apos;awudz</div>
              <div className={s.scriptSay}>
                <div className={s.scriptArabic} lang="ar" dir="rtl">
                  {TAAWUDZ}
                </div>
              </div>
            </div>
          </li>
          <li className={s.scriptItem}>
            <Star8 size={32} className={s.scriptNum}>3</Star8>
            <div>
              <div className={s.scriptTitle}>Basmalah</div>
              <div className={s.scriptSay}>
                <div className={s.scriptArabic} lang="ar" dir="rtl">
                  {BASMALAH}
                </div>
              </div>
            </div>
          </li>
          <li className={s.scriptItem}>
            <Star8 size={32} className={s.scriptNum}>4</Star8>
            <div>
              <div className={s.scriptTitle} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>Asy-Syura · ayat 1–6</span>
                <button type="button" className={s.linkBtn} onClick={() => setLatin((v) => !v)}>
                  {latin ? "Sembunyikan latin" : "Tampilkan latin"}
                </button>
              </div>
              <div className={s.mushaf}>
                <div className={s.scriptArabic} lang="ar" dir="rtl">
                  {ASY_SYURA_1_6.map((a) => (
                    <span key={a.number}>
                      {a.arabic}
                      <span className={s.ayahNum}>{angkaArab(a.number)}</span>{" "}
                    </span>
                  ))}
                </div>
                {latin && (
                  <div className={s.translit}>
                    {ASY_SYURA_1_6.map((a) => `(${a.number}) ${a.transliterasi}`).join("  ")}
                  </div>
                )}
              </div>
            </div>
          </li>
        </ol>

        <details className={s.details}>
          <summary>Belum bisa membaca Asy-Syura?</summary>
          <p>
            Tidak apa-apa. Setelah salam dan memperkenalkan nama, sampaikan saja
            bahwa Anda belum bisa membaca surat dan ayat yang diminta, lalu tetap
            kirim rekamannya. Semoga Allah ta&apos;ala mudahkan.
          </p>
        </details>
        <details className={s.details}>
          <summary>Tips supaya rekaman jelas</summary>
          <p>
            Cari tempat yang tenang, pegang HP sekitar sejengkal dari mulut, dan
            jangan tutup halaman ini selama merekam. Batas rekaman 5 menit.
          </p>
        </details>

        <div className={s.uploadAlt}>
          Sudah merekam dengan aplikasi perekam di HP?
          <button
            type="button"
            className={s.linkBtn}
            disabled={recording}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={13} strokeWidth={2.6} style={{ verticalAlign: -2, marginRight: 4 }} />
            Unggah berkasnya
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.m4a,.mp3,.aac,.wav,.ogg,.opus,.webm,.3gp,.amr"
            hidden
            onChange={onFile}
          />
        </div>
        {uploadError && (
          <p className={s.error} role="alert" style={{ justifyContent: "center" }}>
            {uploadError}
          </p>
        )}
      </Sheet>

      <div className={s.dock}>
        <div className={s.dockInner}>
          <div className={s.dockRow}>
            <div className={s.micWrap}>
              <HaloVisualizer analyser={rec.analyser} active={rec.status === "recording"} />
              {recording ? (
                <button
                  type="button"
                  className={s.micBtn}
                  data-state="recording"
                  onClick={rec.stop}
                  aria-label="Selesai merekam"
                >
                  <Square size={20} strokeWidth={0} fill="currentColor" />
                </button>
              ) : ready ? (
                <button
                  type="button"
                  className={s.micBtn}
                  data-state="ready"
                  onClick={ulangi}
                  aria-label="Rekam ulang"
                >
                  <RotateCcw size={22} strokeWidth={2.4} />
                </button>
              ) : (
                <button
                  type="button"
                  className={s.micBtn}
                  data-state="idle"
                  onClick={() => void rec.start()}
                  disabled={rec.status === "requesting"}
                  aria-label="Mulai merekam"
                >
                  <Mic size={24} strokeWidth={2.4} />
                </button>
              )}
            </div>

            <div aria-live="polite">
              <div className={s.dockTimer}>{timerText}</div>
              <div className={s.dockStatus}>{status}</div>
            </div>

            {recording && (
              <div className={s.dockSide}>
                {rec.status === "recording" ? (
                  <button type="button" className={s.iconBtn} onClick={rec.pause} aria-label="Jeda">
                    <Pause size={18} strokeWidth={2.4} />
                  </button>
                ) : (
                  <button type="button" className={s.iconBtn} onClick={rec.resume} aria-label="Lanjutkan merekam">
                    <Play size={18} strokeWidth={2.4} />
                  </button>
                )}
              </div>
            )}
          </div>

          {(rec.errorMessage || error) && !recording && (
            <div className={s.dockError} role="alert">
              {error ?? rec.errorMessage}
              {rec.status === "denied" && (
                <>
                  {" "}
                  Atau{" "}
                  <button
                    type="button"
                    className={s.linkBtn}
                    style={{ color: "#ffd9cc" }}
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
              <audio className={s.player} src={audio.url} controls preload="metadata" />
              {pendek && (
                <div className={s.warn}>
                  Rekaman ini hanya {fmtDurasi(audio.durationSec!)}. Salam sampai
                  ayat 6 biasanya butuh 1–1,5 menit. Kalau memang belum bisa membaca
                  Asy-Syura dan sudah menyampaikannya di rekaman, tidak apa-apa —
                  silakan lanjut.
                </div>
              )}
              <div className={s.dockActions}>
                <button type="button" className={s.btnGhost} onClick={ulangi}>
                  Ulangi
                </button>
                <button type="button" className={s.btnGold} onClick={onNext}>
                  Lanjut, tinjau pendaftaran
                  <ArrowRight size={18} strokeWidth={2.6} />
                </button>
              </div>
            </>
          )}

          {!ready && !recording && (
            <button
              type="button"
              className={s.backLink}
              onClick={onBack}
              style={{ marginTop: 6, fontSize: 12 }}
            >
              ← Ubah pilihan kelas
            </button>
          )}
        </div>
      </div>
    </>
  );
}
