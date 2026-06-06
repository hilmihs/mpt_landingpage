"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { PLACEMENT_QUESTIONS, computePlacementTier } from "@/lib/demo-data";

export default function TesPenempatanPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const nama = sp.get("nama") ?? "Peserta";
  const gender = sp.get("gender") ?? "ikhwan";

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    PLACEMENT_QUESTIONS.map(() => null),
  );

  const q = PLACEMENT_QUESTIONS[currentQ]!;
  const totalQ = PLACEMENT_QUESTIONS.length;
  const answered = answers[currentQ] !== null;

  const selectAnswer = (idx: number) => {
    const next = [...answers];
    next[currentQ] = idx;
    setAnswers(next);
  };

  const goNext = () => {
    if (currentQ < totalQ - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      const correctCount = answers.filter(
        (a, i) => a === PLACEMENT_QUESTIONS[i]?.correctIndex,
      ).length;
      const tier = computePlacementTier(correctCount);
      const params = new URLSearchParams({
        tier,
        nama,
        skor: String(correctCount),
        total: String(totalQ),
      });
      router.push(`/daftar-hits/hasil?${params}`);
    }
  };

  const stepLabels = ["Data Diri", "Tes Penempatan", "Hasil"];

  return (
    <div
      style={{
        minHeight: "100dvh",
        background:
          "radial-gradient(circle at top, color-mix(in oklab, var(--primary), transparent 92%), var(--bg) 50%)",
        padding: "40px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <button
          onClick={() => (currentQ > 0 ? setCurrentQ(currentQ - 1) : router.back())}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--ink-mute)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            marginBottom: 22,
            padding: 0,
          }}
        >
          <ChevronLeft size={13} strokeWidth={2.4} />
          {currentQ > 0 ? "Soal Sebelumnya" : "Kembali"}
        </button>

        <div style={{ display: "flex", gap: 4, marginBottom: 22 }}>
          {stepLabels.map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: i <= 1 ? "var(--accent)" : "var(--line)",
                  marginBottom: 4,
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  fontWeight: i === 1 ? 700 : 400,
                  color: i === 1 ? "var(--accent)" : "var(--ink-mute)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {s}
              </div>
            </div>
          ))}
        </div>

        <div className="card-mpt" style={{ padding: "24px 22px", marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 18,
            }}
          >
            <span
              className="pill"
              style={{
                background: "color-mix(in oklab, var(--primary), transparent 88%)",
                color: "var(--primary)",
              }}
            >
              {q.category}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>
              {currentQ + 1} / {totalQ}
            </span>
          </div>

          <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 12px", lineHeight: 1.5 }}>
            {q.question}
          </h2>

          {q.arabicText && (
            <div
              className="font-arabic"
              dir="rtl"
              style={{
                fontSize: 32,
                lineHeight: 2,
                textAlign: "center",
                padding: "16px 0",
                margin: "0 0 16px",
                background: "var(--bg)",
                borderRadius: 12,
                color: "var(--ink)",
              }}
            >
              {q.arabicText}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {q.options.map((opt, idx) => {
              const selected = answers[currentQ] === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectAnswer(idx)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: selected
                      ? "2px solid var(--accent)"
                      : "1px solid var(--line-strong)",
                    background: selected
                      ? "color-mix(in oklab, var(--accent), transparent 92%)"
                      : "var(--paper)",
                    color: "var(--ink)",
                    fontSize: 14,
                    fontWeight: selected ? 700 : 500,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    fontFamily: "var(--font-nunito), system-ui, sans-serif",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 24,
                      height: 24,
                      borderRadius: 8,
                      background: selected ? "var(--accent)" : "var(--bg-deep)",
                      color: selected ? "var(--ink)" : "var(--ink-mute)",
                      fontSize: 11,
                      fontWeight: 700,
                      marginRight: 10,
                    }}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        <button
          className="btn-mpt btn-mpt-accent"
          disabled={!answered}
          onClick={goNext}
          style={{ width: "100%", minHeight: 48, fontSize: 15 }}
        >
          {currentQ < totalQ - 1 ? "Soal Berikutnya" : "Lihat Hasil Penempatan"}
          <ArrowRight size={16} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
