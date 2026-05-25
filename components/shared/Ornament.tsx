interface Props {
  size?: number;
  opacity?: number;
  spinning?: boolean;
  color?: string;
  variant?: "ripples" | "topo" | "mountains" | "blobs";
  className?: string;
}

export function Ornament({
  size = 48,
  opacity = 1,
  spinning = false,
  color = "currentColor",
  variant = "blobs",
  className,
}: Props) {
  const animStyle = spinning
    ? { animation: "ornamentDrift 80s linear infinite" }
    : {};
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ opacity, color, ...animStyle }}
      fill="none"
      stroke={color}
      strokeWidth="0.7"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      {variant === "ripples" && (
        <g>
          <circle cx="50" cy="50" r="8" />
          <circle cx="50" cy="50" r="16" opacity="0.85" />
          <circle cx="50" cy="50" r="24" opacity="0.7" />
          <circle cx="50" cy="50" r="32" opacity="0.55" />
          <circle cx="50" cy="50" r="40" opacity="0.4" />
          <circle cx="50" cy="50" r="48" opacity="0.25" />
          <circle cx="50" cy="50" r="2" fill={color} stroke="none" />
        </g>
      )}
      {variant === "topo" && (
        <g>
          {Array.from({ length: 12 }).map((_, i) => {
            const r = 6 + i * 4;
            const o = Math.max(0.15, 0.9 - i * 0.07);
            return (
              <path
                key={i}
                d={`M ${50 - r * 0.95} ${50 + r * 0.2}
                    Q ${50} ${50 - r * 1.05}
                      ${50 + r} ${50 + r * 0.2}
                    Q ${50} ${50 + r * 1.0}
                      ${50 - r * 0.95} ${50 + r * 0.2} Z`}
                opacity={o}
              />
            );
          })}
        </g>
      )}
      {variant === "mountains" && (
        <g>
          <path
            d="M0 90 L20 60 L35 75 L55 45 L70 60 L85 50 L100 70 L100 100 L0 100 Z"
            opacity="0.25"
            fill={color}
            stroke="none"
          />
          <path
            d="M0 90 L15 70 L30 80 L50 55 L65 70 L80 60 L100 80 L100 100 L0 100 Z"
            opacity="0.45"
            fill={color}
            stroke="none"
          />
          <path
            d="M0 95 L25 80 L45 88 L60 72 L80 82 L100 88 L100 100 L0 100 Z"
            opacity="0.65"
            fill={color}
            stroke="none"
          />
          <circle cx="72" cy="32" r="8" fill={color} stroke="none" opacity="0.6" />
        </g>
      )}
      {variant === "blobs" && (
        <g>
          <path
            d="M30 25 Q55 15 70 30 Q85 50 70 70 Q50 85 30 75 Q15 60 20 40 Q22 30 30 25 Z"
            opacity="0.7"
            fill={color}
            stroke="none"
          />
          <path
            d="M55 38 Q70 32 78 45 Q82 58 70 65 Q58 70 52 60 Q48 50 55 38 Z"
            opacity="0.5"
            fill={color}
            stroke="none"
          />
          <circle cx="32" cy="60" r="10" opacity="0.4" fill={color} stroke="none" />
        </g>
      )}
    </svg>
  );
}
