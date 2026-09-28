"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import w from "./wave.module.css";

// Sengaja lokal, bukan impor dari StepRekam, supaya tidak ada impor melingkar.
function fmt(sec: number): string {
  const s = Number.isFinite(sec) ? Math.max(0, Math.floor(sec)) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Profil gelombang deterministik 0..1 — rumus sama dengan mockup (`wv`). */
function shape(n: number, seed: number): number[] {
  return Array.from({ length: n }, (_, i) =>
    Math.abs(Math.sin(i * 1.7 + seed) * Math.cos(i * 0.45 + seed * 2)),
  );
}

const pct = (f: number) => `${(f * 100).toFixed(1)}%`;

/** Batang gelombang langsung dari mikrofon. Mengisi lebar induk, tinggi 34px. */
export function LiveWave({
  analyser,
  active,
  bars = 40,
}: {
  analyser: AnalyserNode | null;
  active: boolean;
  bars?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const profile = useMemo(() => shape(bars, 1), [bars]);
  // Saat diam batang tetap berbentuk gelombang, hanya rendah — bukan garis rata.
  const rest = useMemo(() => profile.map((v) => 0.12 + v * 0.14), [profile]);
  const live = active && analyser !== null;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nodes = Array.from(el.children) as HTMLElement[];

    if (!live || !analyser) {
      nodes.forEach((n, i) => {
        n.style.height = pct(rest[i] ?? 0.12);
        n.removeAttribute("data-off");
      });
      return;
    }

    const buf = new Uint8Array(analyser.frequencyBinCount);
    // Pita atas hampir tak pernah terisi suara manusia; batang yang selalu
    // diam terlihat seperti rusak, jadi pakai 60% pita bawah saja.
    const usable = Math.max(1, Math.floor(buf.length * 0.6));
    const half = Math.ceil(bars / 2);
    // Cermin dari tengah: pita rendah di tengah, pita tinggi di tepi, supaya
    // bentuknya menyerupai gelombang suara, bukan spektrum yang berat sebelah.
    const band = (i: number) => {
      const k = Math.abs(i - (bars - 1) / 2) / half; // 0 di tengah, ~1 di tepi
      const lo = Math.floor(Math.pow(k, 1.5) * usable);
      const hi = Math.max(lo + 1, Math.floor(Math.pow(Math.min(1, k + 1 / half), 1.5) * usable));
      let sum = 0;
      for (let j = lo; j < hi; j++) sum += buf[j] ?? 0;
      return sum / (hi - lo) / 255;
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // Tanpa gerak: bentuk batang tetap, hanya jumlah batang yang menyala
      // (dari kiri) mengikuti keras suara — cukup untuk tahu mikrofon hidup.
      nodes.forEach((n, i) => (n.style.height = pct(0.18 + (profile[i] ?? 0) * 0.82)));
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let j = 0; j < usable; j++) sum += buf[j] ?? 0;
        const lit = Math.round(Math.min(1, (sum / usable / 255) * 1.6) * bars);
        nodes.forEach((n, i) => n.setAttribute("data-off", String(i >= lit)));
      };
      tick();
      const id = window.setInterval(tick, 300);
      return () => window.clearInterval(id);
    }

    const smooth = new Float32Array(bars);
    let raf = 0;
    const draw = () => {
      analyser.getByteFrequencyData(buf);
      for (let i = 0; i < bars; i++) {
        const v = band(i);
        const prev = smooth[i] ?? 0;
        // Naik cepat, turun pelan — terasa responsif tanpa berkedip.
        const next = prev + (v - prev) * (v > prev ? 0.5 : 0.15);
        smooth[i] = next;
        const node = nodes[i];
        if (node) node.style.height = pct(0.12 + next * 0.88);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [live, analyser, bars, profile, rest]);

  return (
    <div ref={ref} className={w.live} data-active={live} aria-hidden="true">
      {rest.map((h, i) => (
        <span key={i} className={w.liveBar} style={{ height: pct(h) }} />
      ))}
    </div>
  );
}

const SEEK_STEP = 5;

/** Pemutar rekaman ringkas: tombol putar/jeda bulat + gelombang statis yang terisi sesuai progres + waktu. */
export function AudioPill({
  src,
  durationSec,
  tone = "light",
  bars = 28,
}: {
  src: string;
  durationSec: number | null;
  tone?: "light" | "dark";
  bars?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [metaDur, setMetaDur] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const heights = useMemo(() => shape(bars, 3).map((v) => 0.18 + v * 0.82), [bars]);

  // Rekaman baru → mulai dari nol. Direset saat render (bukan di effect)
  // supaya tidak ada satu frame yang masih menampilkan progres rekaman lama.
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setPlaying(false);
    setPos(0);
    setMetaDur(null);
    setScrubbing(false);
  }

  useEffect(() => {
    const a = audioRef.current;
    return () => a?.pause();
  }, [src]);

  // WebM dari MediaRecorder sering melaporkan durasi Infinity, jadi durasi
  // dari perekam didahulukan; metadata hanya cadangan (mis. berkas unggahan).
  const total =
    durationSec !== null && Number.isFinite(durationSec) && durationSec > 0
      ? durationSec
      : (metaDur ?? 0);
  const shown = total > 0 ? Math.min(pos, total) : pos;
  const played = total > 0 ? Math.round((shown / total) * bars) : 0;

  function readMeta() {
    const d = audioRef.current?.duration;
    if (d !== undefined && Number.isFinite(d) && d > 0) setMetaDur(d);
  }

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setPlaying(false));
    else a.pause();
  }

  function seek(t: number) {
    const a = audioRef.current;
    if (!a || total <= 0) return;
    const next = Math.min(Math.max(0, t), total);
    try {
      a.currentTime = next;
    } catch {
      // Sebagian peramban menolak seek sebelum metadata siap; abaikan saja.
    }
    setPos(next);
  }

  function timeAt(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = r.width > 0 ? (e.clientX - r.left) / r.width : 0;
    return Math.min(Math.max(0, ratio), 1) * total;
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (total <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(true);
    setPos(timeAt(e));
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    // Selama digeser hanya tampilan yang ikut; seek sungguhan sekali saat
    // dilepas, karena seek berulang pada WebM terasa berat di HP.
    if (scrubbing) setPos(timeAt(e));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!scrubbing) return;
    setScrubbing(false);
    seek(timeAt(e));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    let t: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") t = shown + SEEK_STEP;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") t = shown - SEEK_STEP;
    else if (e.key === "Home") t = 0;
    else if (e.key === "End") t = total;
    if (t === null) return;
    e.preventDefault();
    seek(t);
  }

  return (
    <div className={w.pill} data-tone={tone}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        hidden
        onLoadedMetadata={readMeta}
        onDurationChange={readMeta}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEmptied={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          if (!scrubbing) setPos(e.currentTarget.currentTime);
        }}
        onEnded={(e) => {
          e.currentTarget.currentTime = 0;
          setPlaying(false);
          setPos(0);
        }}
      />
      <button
        type="button"
        className={w.play}
        onClick={toggle}
        aria-label={playing ? "Jeda rekaman" : "Putar rekaman"}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 4l14 8-14 8z" />
          </svg>
        )}
      </button>
      <div
        className={w.bars}
        role="slider"
        tabIndex={0}
        aria-label="Posisi rekaman"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(shown)}
        aria-valuetext={`${fmt(shown)} dari ${fmt(total)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setScrubbing(false)}
        onKeyDown={onKeyDown}
      >
        {heights.map((h, i) => (
          <span
            key={i}
            className={w.bar}
            data-played={i < played}
            style={{ height: pct(h) }}
          />
        ))}
      </div>
      <span className={w.time}>{fmt(playing || scrubbing ? shown : total)}</span>
    </div>
  );
}
