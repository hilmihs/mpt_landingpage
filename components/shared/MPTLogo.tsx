import Image from "next/image";

interface Props {
  size?: number;
  className?: string;
  priority?: boolean;
}

export function MPTLogo({ size = 56, className, priority }: Props) {
  return (
    <Image
      src="/logo-mpt.png"
      alt="Muhajir Project Tilawah"
      width={size}
      height={size}
      priority={priority}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        filter: "drop-shadow(0 2px 6px rgba(26,31,42,0.08))",
      }}
    />
  );
}

interface GlyphProps {
  size?: number;
  color?: string;
  className?: string;
}

export function MountainGlyph({
  size = 48,
  color = "var(--accent)",
  className,
}: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden
    >
      <g fill={color}>
        <path d="M22 72 Q22 50 30 42 Q36 38 38 50 L42 72 Z" />
        <path d="M44 72 Q44 38 60 24 Q66 20 70 30 L82 70 Q82 74 78 74 L48 74 Q44 74 44 72 Z" />
      </g>
    </svg>
  );
}
