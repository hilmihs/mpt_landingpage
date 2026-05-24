"use client";

import { useEffect, useRef } from "react";

interface Props {
  analyser: AnalyserNode | null;
  active: boolean;
}

export function AudioVisualizer({ analyser, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (!analyser || !active) {
        // idle: tampilkan baseline bars
        const barCount = 32;
        const bw = w / (barCount * 1.5);
        for (let i = 0; i < barCount; i++) {
          const bh = h * 0.08;
          ctx.fillStyle = "rgba(120,120,120,0.25)";
          ctx.fillRect(i * bw * 1.5 + bw / 2, (h - bh) / 2, bw, bh);
        }
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const buf = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(buf);
      const barCount = 48;
      const step = Math.floor(buf.length / barCount);
      const bw = w / (barCount * 1.2);
      for (let i = 0; i < barCount; i++) {
        const v = buf[i * step] ?? 0;
        const bh = Math.max(2, (v / 255) * h * 0.9);
        const hue = 160 + (v / 255) * 40;
        ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
        ctx.fillRect(i * bw * 1.2 + bw / 2, (h - bh) / 2, bw, bh);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, active]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-24 rounded-md bg-muted/30"
      aria-hidden
    />
  );
}
