import type { JSX } from "react";

export interface RadarAxis {
  label: string;
  value: number;
}

interface RadarChartProps {
  axes: RadarAxis[];
  max?: number;
  size?: number;
  showReference?: boolean;
  referenceValue?: number;
}

/** Label dipecah maksimal dua baris supaya delapan sumbu tidak saling menimpa. */
const MAX_LABEL_LINES = 2;
const MAX_LABEL_CHARS = 11;

/**
 * Memecah label jadi beberapa baris pendek dan menutup sisanya dengan elipsis.
 * Pemotongan sengaja dilakukan di sini, bukan lewat CSS: <text> SVG tidak
 * mengenal text-overflow, jadi panjang baris harus sudah final saat dirender.
 */
function wrapLabel(raw: string, maxChars: number, maxLines: number): string[] {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";
  let consumed = 0;

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      consumed += 1;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }
    if (lines.length >= maxLines) break;

    current =
      word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
    consumed += 1;
  }

  if (current && lines.length < maxLines) lines.push(current);

  const result = lines.slice(0, maxLines);
  const lastLine = result[result.length - 1];
  if (consumed < words.length && lastLine && !lastLine.endsWith("…")) {
    result[result.length - 1] =
      `${lastLine.slice(0, Math.max(1, maxChars - 1))}…`;
  }

  return result.length > 0 ? result : [""];
}

/** Sudut mulai dari atas (-90°) lalu searah jarum jam, mengikuti kebiasaan baca rapot. */
function polarPoint(
  cx: number,
  cy: number,
  radius: number,
  index: number,
  total: number,
) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function polygonPoints(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Radar chart SVG murni tanpa dependensi grafik.
 *
 * Sengaja tidak memakai library: satu grafik tidak sebanding dengan ~200KB bundle,
 * dan canvas/DOM-heavy renderer tidak bisa jalan sebagai server component.
 */
export function RadarChart({
  axes,
  max = 10,
  size = 320,
  showReference = true,
  referenceValue = 6,
}: RadarChartProps): JSX.Element {
  // Poligon butuh minimal tiga sumbu; di bawah itu bentuknya bukan radar lagi.
  if (axes.length < 3) return <></>;

  const scaleMax = max > 0 ? max : 10;
  const total = axes.length;

  const clamp = (value: number) =>
    Number.isFinite(value) ? Math.min(scaleMax, Math.max(0, value)) : 0;

  // Jarak lingkar terluar ke tepi viewBox; menampung label sumbu atas dan bawah.
  const pad = size * 0.22;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - pad;
  const labelRadius = radius + size * 0.045;

  // Batas bawah 9px menjaga label tetap terbaca pada kartu sempit.
  const fontSize = Math.max(9, size * 0.033);
  const lineHeight = fontSize * 1.15;

  // Label sumbu kiri dan kanan menjorok jauh lebih lebar daripada label atas dan
  // bawah, jadi viewBox dilebarkan mendatar sebanyak luapan terburuk. Dihitung dari
  // fontSize sungguhan — bukan pecahan tetap dari `size` — karena pada ukuran kecil
  // font tertahan di batas bawah sehingga teks jadi relatif lebih lebar. Tinggi
  // tetap `size` dan lebar total dikunci lewat maxWidth, jadi grafik tidak pernah
  // melewati kolomnya betapapun sempit wadahnya.
  const maxTextWidth = MAX_LABEL_CHARS * fontSize * 0.62;
  const marginX = Math.max(0, labelRadius + maxTextWidth - size / 2) + 2;
  const viewWidth = size + marginX * 2;

  // Satu cincin tiap dua poin skala, dibatasi supaya jaring tidak jadi rapat berlebihan.
  const rings = Math.min(6, Math.max(2, Math.round(scaleMax / 2)));

  // Nilai dan geometri tiap sumbu dihitung sekali di sini supaya penggambaran
  // poligon, titik, dan label tidak perlu saling mengindeks larik terpisah.
  const items = axes.map((axis, i) => {
    const value = clamp(axis.value);
    return {
      label: axis.label,
      value,
      outer: polarPoint(cx, cy, radius, i, total),
      vertex: polarPoint(cx, cy, (value / scaleMax) * radius, i, total),
      anchor: polarPoint(cx, cy, labelRadius, i, total),
    };
  });

  const average = items.reduce((sum, item) => sum + item.value, 0) / total;
  const ratio = average / scaleMax;
  const tone =
    ratio >= 0.8
      ? "var(--success)"
      : ratio >= 0.6
        ? "var(--accent)"
        : "var(--danger)";

  const reference = Math.min(scaleMax, Math.max(0, referenceValue));
  const hasReference = showReference && reference > 0;

  const referencePoints = axes.map((_, i) =>
    polarPoint(cx, cy, (reference / scaleMax) * radius, i, total),
  );

  const summary = items
    .map((item) => `${item.label} ${formatValue(item.value)}`)
    .join(", ");
  const ariaLabel =
    `Grafik radar ${total} aspek penilaian, skala 0 sampai ${scaleMax}. ` +
    `${summary}.` +
    (hasReference ? ` Ambang aman ${formatValue(reference)}.` : "");

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`${-marginX} 0 ${viewWidth} ${size}`}
      style={{
        display: "block",
        width: "100%",
        maxWidth: size,
        height: "auto",
        margin: "0 auto",
      }}
    >
      <title>{ariaLabel}</title>

      {/* Jaring konsentris: cincin terluar dipertegas sebagai batas skala penuh. */}
      {Array.from({ length: rings }, (_, ring) => {
        const level = (ring + 1) / rings;
        const isOuter = ring === rings - 1;
        return (
          <polygon
            key={`ring-${ring}`}
            points={polygonPoints(
              axes.map((_, i) => polarPoint(cx, cy, radius * level, i, total)),
            )}
            fill="none"
            stroke={isOuter ? "var(--line-strong)" : "var(--line)"}
            strokeWidth={isOuter ? 1.25 : 1}
          />
        );
      })}

      {items.map((item, i) => (
        <line
          key={`spoke-${i}`}
          x1={cx}
          y1={cy}
          x2={item.outer.x}
          y2={item.outer.y}
          stroke="var(--line)"
          strokeWidth={1}
        />
      ))}

      {hasReference && (
        <polygon
          points={polygonPoints(referencePoints)}
          fill="none"
          stroke="var(--success)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          strokeLinejoin="round"
          opacity={0.7}
        />
      )}

      <polygon
        points={polygonPoints(items.map((item) => item.vertex))}
        fill={tone}
        fillOpacity={0.18}
        stroke={tone}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {items.map((item, i) => {
        const below = hasReference && item.value < reference;
        return (
          <circle
            key={`dot-${i}`}
            cx={item.vertex.x}
            cy={item.vertex.y}
            r={3.5}
            fill={below ? "var(--danger)" : tone}
            stroke="var(--paper)"
            strokeWidth={1.5}
          />
        );
      })}

      {items.map((item, i) => {
        const anchorPoint = item.anchor;
        const dx = (anchorPoint.x - cx) / labelRadius;
        const dy = (anchorPoint.y - cy) / labelRadius;

        // Toleransi 0.25 menjaga label atas dan bawah tetap rata tengah,
        // bukan tersandar ke samping karena pembulatan sudut.
        const textAnchor =
          dx > 0.25 ? "start" : dx < -0.25 ? "end" : "middle";

        const lines = wrapLabel(item.label, MAX_LABEL_CHARS, MAX_LABEL_LINES);
        const rowCount = lines.length + 1; // baris label + baris angka
        const blockHeight = (rowCount - 1) * lineHeight;
        // Blok teks dipusatkan pada simpul, lalu didorong sedikit menjauhi pusat
        // supaya tidak menempel ke cincin terluar.
        const baseY =
          anchorPoint.y -
          blockHeight / 2 +
          fontSize * 0.35 +
          dy * fontSize * 0.45;

        const below = hasReference && item.value < reference;

        return (
          <text
            key={`label-${i}`}
            textAnchor={textAnchor}
            fontSize={fontSize}
            fontWeight={600}
            fill={below ? "var(--danger)" : "var(--ink-soft)"}
          >
            {lines.map((line, li) => (
              <tspan key={li} x={anchorPoint.x} y={baseY + li * lineHeight}>
                {line}
              </tspan>
            ))}
            <tspan
              x={anchorPoint.x}
              y={baseY + lines.length * lineHeight}
              fontSize={fontSize * 0.92}
              fontWeight={700}
              fill={below ? "var(--danger)" : "var(--ink-mute)"}
            >
              {formatValue(item.value)}/{scaleMax}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
