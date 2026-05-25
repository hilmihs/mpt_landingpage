import { AL_FATIHAH } from "@/lib/arabic";
import { INDIKATOR_META } from "@/lib/scoring";
import type { ErrorItem, IndikatorKey } from "@/types";

interface Props {
  ayatNumber: number;
  errorsByCategory: Record<IndikatorKey, ErrorItem[]>;
}

function buildLookup(
  errorsByCategory: Record<IndikatorKey, ErrorItem[]>,
  ayatNumber: number,
): Map<number, IndikatorKey> {
  const lookup = new Map<number, IndikatorKey>();
  (Object.keys(errorsByCategory) as IndikatorKey[]).forEach((cat) => {
    errorsByCategory[cat].forEach((e) => {
      if (e.ayat === ayatNumber && !lookup.has(e.kata_idx)) {
        lookup.set(e.kata_idx, cat);
      }
    });
  });
  return lookup;
}

export function AyatCard({ ayatNumber, errorsByCategory }: Props) {
  const ayat = AL_FATIHAH.find((a) => a.number === ayatNumber);
  if (!ayat) return null;
  const lookup = buildLookup(errorsByCategory, ayatNumber);
  const noteCount = lookup.size;

  return (
    <div
      style={{
        padding: "20px 22px",
        borderRadius: 16,
        background: "var(--paper)",
        border: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--primary)",
            color: "var(--primary-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          {ayat.number}
        </span>
        {noteCount > 0 ? (
          <span
            className="pill"
            style={{
              background: "color-mix(in oklab, var(--danger), transparent 85%)",
              color: "var(--danger)",
            }}
          >
            {noteCount} catatan
          </span>
        ) : (
          <span
            className="pill"
            style={{
              background: "color-mix(in oklab, var(--success), transparent 85%)",
              color: "var(--success)",
            }}
          >
            Baik
          </span>
        )}
      </div>
      <div
        dir="rtl"
        className="font-arabic"
        style={{
          fontSize: 26,
          lineHeight: 2.1,
          textAlign: "right",
          color: "var(--ink)",
          margin: "0 0 10px",
        }}
      >
        {ayat.words.map((word, idx) => {
          const cat = lookup.get(idx);
          if (cat) {
            const meta = INDIKATOR_META[cat];
            return (
              <span
                key={idx}
                style={{
                  background: `color-mix(in oklab, ${meta.color}, transparent 80%)`,
                  padding: "0 6px",
                  borderRadius: 6,
                  borderBottom: `2px solid ${meta.color}`,
                  margin: "0 2px",
                }}
              >
                {word}
              </span>
            );
          }
          return (
            <span key={idx} style={{ margin: "0 2px" }}>
              {word}
            </span>
          );
        })}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--ink-mute)",
          fontStyle: "italic",
        }}
      >
        {ayat.transliterasi}
      </div>
    </div>
  );
}
