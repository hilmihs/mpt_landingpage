interface Props {
  score: number;
  max?: number;
  size?: number;
}

export function ScoreCircle({ score, max = 5, size = 180 }: Props) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / max));
  const offsetTarget = c - c * pct;
  const animName = `scoreRing-${Math.round(pct * 1000)}`;

  return (
    <div
      className="score-circle"
      style={{ position: "relative", width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="7"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c}
          style={{
            animation: `${animName} 1.6s cubic-bezier(0.16,1,0.3,1) 0.3s forwards`,
          }}
        />
      </svg>
      <style>{`@keyframes ${animName} { to { stroke-dashoffset: ${offsetTarget}; } }`}</style>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          className="font-display"
          style={{
            fontSize: size * 0.44,
            fontWeight: 800,
            color: "var(--primary)",
            lineHeight: 1,
            letterSpacing: "-0.04em",
          }}
        >
          {score}
        </span>
        <span
          style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 600 }}
        >
          dari {max}
        </span>
      </div>
    </div>
  );
}
