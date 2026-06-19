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
    <div className="ayat-card">
      {/* Header: nomor ayat + badge catatan */}
      <div className="ayat-card-head">
        <span className="ayat-num">{ayat.number}</span>
        {noteCount > 0 ? (
          <span
            className="pill"
            style={{
              background: "color-mix(in oklab, var(--danger), transparent 86%)",
              color: "var(--danger)",
            }}
          >
            <span className="ayat-badge-dot" />
            {noteCount} catatan
          </span>
        ) : (
          <span
            className="pill"
            style={{
              background:
                "color-mix(in oklab, var(--success), transparent 86%)",
              color: "var(--success)",
            }}
          >
            <span
              className="ayat-badge-dot"
              style={{ background: "var(--success)" }}
            />
            Baik
          </span>
        )}
      </div>

      {/* Teks Arab */}
      <div dir="rtl" lang="ar" className="font-arabic ayat-arabic">
        {ayat.words.map((word, idx) => {
          const cat = lookup.get(idx);
          const sep = idx > 0 ? " " : "";
          if (cat) {
            const meta = INDIKATOR_META[cat];
            return (
              <span key={idx}>
                {sep}
                <span
                  className="arabic-mark"
                  style={{
                    background: `color-mix(in oklab, ${meta.color}, transparent 82%)`,
                    borderBottom: `2.5px solid ${meta.color}`,
                  }}
                >
                  {word}
                </span>
              </span>
            );
          }
          return (
            <span key={idx}>
              {sep}
              {word}
            </span>
          );
        })}
      </div>

      {/* Transliterasi + terjemahan */}
      <div className="ayat-translit">{ayat.transliterasi}</div>
      <div className="ayat-terjemah">{ayat.terjemahan}</div>
    </div>
  );
}
