"use client";

import { useEffect, useRef } from "react";
import s from "./dar-syafii.module.css";

/**
 * Lingkaran batang emas di sekeliling tombol rekam. Saat merekam, tiap batang
 * mengikuti satu pita frekuensi suara; saat diam, cincinnya bernapas pelan
 * mengajak peserta menekan tombol.
 */
export function HaloVisualizer({
  analyser,
  active,
}: {
  analyser: AnalyserNode | null;
  active: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.getBoundingClientRect().width || 92;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const BARS = 44;
    const c = size / 2;
    const inner = size * 0.36;
    const maxLen = size * 0.13;
    const buf = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    // Ambil pita bawah-tengah saja; suara manusia jarang mengisi pita tinggi,
    // dan batang yang selalu diam terlihat seperti rusak.
    const usable = buf ? Math.floor(buf.length * 0.6) : 0;
    const smooth = new Float32Array(BARS);
    let raf = 0;
    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      if (active && analyser && buf) analyser.getByteFrequencyData(buf);

      for (let i = 0; i < BARS; i++) {
        let v: number;
        if (active && buf) {
          // Cermin kiri-kanan supaya lingkarannya simetris.
          const k = i < BARS / 2 ? i : BARS - 1 - i;
          const idx = Math.floor((k / (BARS / 2)) * usable);
          v = (buf[idx] ?? 0) / 255;
        } else {
          v = reduce ? 0.15 : 0.12 + 0.1 * Math.sin(t / 22 + i * 0.55);
        }
        smooth[i] = smooth[i]! + (v - smooth[i]!) * 0.35;
        const len = 2 + smooth[i]! * maxLen;
        const a = (i / BARS) * Math.PI * 2 - Math.PI / 2;
        const x1 = c + Math.cos(a) * inner;
        const y1 = c + Math.sin(a) * inner;
        const x2 = c + Math.cos(a) * (inner + len);
        const y2 = c + Math.sin(a) * (inner + len);
        ctx.strokeStyle = active
          ? `rgba(243, 208, 138, ${0.45 + smooth[i]! * 0.55})`
          : "rgba(217, 173, 98, 0.45)";
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      t++;
      if (!reduce || active) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [analyser, active]);

  return <canvas ref={ref} className={s.halo} aria-hidden="true" />;
}
