"use client";

import { useState } from "react";
import { INDIKATOR_META } from "@/lib/scoring";
import { getWord } from "@/lib/arabic";
import type { ErrorItem, IndikatorKey } from "@/types";

interface Props {
  kategori: IndikatorKey;
  errors: ErrorItem[];
}

export function IndikatorCard({ kategori, errors }: Props) {
  const meta = INDIKATOR_META[kategori];
  const count = errors.length;
  // Health: 100% - 12% per major - 6% per minor, floored at 0
  const major = errors.filter((e) => e.severity === "major").length;
  const minor = errors.filter((e) => e.severity === "minor").length;
  const val = Math.max(0, 100 - major * 12 - minor * 6);
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        padding: 20,
        borderRadius: 16,
        background: "var(--paper)",
        border: "1px solid var(--line)",
        transition: "all 0.3s",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 14,
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: meta.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
              }}
            >
              {meta.desc}
            </span>
          </div>
          <h4
            className="font-display"
            style={{
              fontSize: 22,
              margin: 0,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            {meta.label}
          </h4>
        </div>
        <div
          className="font-arabic"
          dir="rtl"
          style={{
            fontSize: 28,
            color: meta.color,
            fontWeight: 700,
            opacity: 0.85,
            flexShrink: 0,
          }}
        >
          {meta.arab}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "var(--ink-soft)",
            marginBottom: 6,
            fontWeight: 600,
          }}
        >
          <span>{count} catatan</span>
          <span
            style={{
              fontFamily: "monospace",
              fontWeight: 700,
              color: "var(--ink)",
            }}
          >
            {val}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: "var(--bg-deep)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${val}%`,
              background: meta.color,
              borderRadius: 999,
              transformOrigin: "left",
              animation:
                "barGrowKf 1.4s cubic-bezier(0.16,1,0.3,1) 0.3s both",
            }}
          />
        </div>
      </div>

      {count > 0 && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--accent-deep)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              padding: "6px 0",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontFamily: "var(--font-nunito), system-ui, sans-serif",
            }}
            aria-expanded={open}
          >
            {open ? "Sembunyikan" : "Lihat"} {count} catatan
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              style={{
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 0.3s",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {open && (
            <div
              style={{
                borderTop: "1px solid var(--line)",
                marginTop: 8,
                paddingTop: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                animation: "fadeUp 0.4s both",
              }}
            >
              {errors.map((e, i) => {
                const word = getWord(e.ayat, e.kata_idx) ?? e.expected;
                return (
                  <div
                    key={i}
                    style={{
                      fontSize: 13,
                      color: "var(--ink-soft)",
                      display: "flex",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        color: "var(--ink-mute)",
                        fontWeight: 700,
                        minWidth: 50,
                        fontSize: 11,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        paddingTop: 4,
                      }}
                    >
                      Ayat {e.ayat}
                    </span>
                    <div>
                      <span
                        dir="rtl"
                        className="font-arabic"
                        style={{
                          fontSize: 20,
                          color: meta.color,
                          marginLeft: 6,
                        }}
                      >
                        {word}
                      </span>
                      {e.note && (
                        <div style={{ marginTop: 4 }}>{e.note}</div>
                      )}
                      <span
                        style={{
                          marginTop: 4,
                          display: "inline-block",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color:
                            e.severity === "major"
                              ? "var(--danger)"
                              : "var(--warning)",
                        }}
                      >
                        {e.severity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
