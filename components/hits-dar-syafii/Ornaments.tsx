/**
 * Ornamen SVG untuk halaman HITS Darsyafii. Semua digambar dari kode — tidak
 * ada berkas gambar — dan animasinya murni CSS (transform/opacity/stroke),
 * dimatikan otomatis oleh prefers-reduced-motion di dar-syafii.module.css.
 */
import s from "./dar-syafii.module.css";

/** PRNG kecil bertumpu seed, supaya posisi bintang sama di server dan klien. */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Titik-titik bintang segi-n: bergantian radius luar dan dalam. */
function starPoints(cx: number, cy: number, n: number, outer: number, inner: number, rot = -90) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    pts.push(`${r2(cx + r * Math.cos(a))},${r2(cy + r * Math.sin(a))}`);
  }
  return pts.join(" ");
}

// ---------------------------------------------------------------------------

export function StarField({ count = 70, seed = 7 }: { count?: number; seed?: number }) {
  const rand = mulberry32(seed);
  const stars = Array.from({ length: count }, (_, i) => ({
    x: r2(rand() * 100),
    y: r2(rand() * 100),
    r: r2(0.4 + rand() * 1.3),
    d: r2(2 + rand() * 5),
    delay: r2(rand() * 6),
    big: i % 17 === 0,
  }));
  return (
    <svg className={s.starField} aria-hidden="true" preserveAspectRatio="none">
      {stars.map((st, i) =>
        st.big ? (
          <svg key={i} x={`${st.x}%`} y={`${st.y}%`} overflow="visible">
            <polygon
              className={s.twinkle}
              points={starPoints(0, 0, 4, 5, 1.2)}
              fill="var(--ds-gold-bright)"
              style={{ animationDuration: `${st.d}s`, animationDelay: `${st.delay}s` }}
            />
          </svg>
        ) : (
          <circle
            key={i}
            className={s.twinkle}
            cx={`${st.x}%`}
            cy={`${st.y}%`}
            r={st.r}
            fill="#fff8e6"
            style={{ animationDuration: `${st.d}s`, animationDelay: `${st.delay}s` }}
          />
        ),
      )}
    </svg>
  );
}

/**
 * Rosette girih: bintang delapan {8/3} berlapis, cincin enam belas bintang
 * kecil yang berputar pelan, dan kelopak di antaranya. Garis-garisnya
 * "tergambar" satu per satu saat halaman dibuka.
 */
export function GirihRosette({ className }: { className?: string }) {
  const C = 200;
  const ring16 = Array.from({ length: 16 }, (_, i) => {
    const a = ((i * 360) / 16 - 90) * (Math.PI / 180);
    return { x: r2(C + 170 * Math.cos(a)), y: r2(C + 170 * Math.sin(a)) };
  });
  const petals = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="ds-rosette-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f3d08a" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#d9ad62" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#d9ad62" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={C} r={200} fill="url(#ds-rosette-glow)" className={s.breathe} />

      <g className={s.spinSlow} style={{ transformOrigin: "200px 200px" }}>
        <circle cx={C} cy={C} r={170} className={s.draw} pathLength={1} style={{ animationDelay: "0.1s" }} />
        {ring16.map((p, i) => (
          <polygon
            key={i}
            points={starPoints(p.x, p.y, 8, 11, 5.5, -90 + i * 22.5)}
            className={s.draw}
            pathLength={1}
            style={{ animationDelay: `${0.4 + i * 0.05}s` }}
          />
        ))}
      </g>

      <g className={s.spinReverse} style={{ transformOrigin: "200px 200px" }}>
        {petals.map((deg, i) => (
          <path
            key={deg}
            d="M200 62 C 226 100, 226 124, 200 142 C 174 124, 174 100, 200 62 Z"
            transform={`rotate(${deg} 200 200)`}
            className={s.draw}
            pathLength={1}
            style={{ animationDelay: `${0.9 + i * 0.07}s` }}
          />
        ))}
      </g>

      <polygon
        points={starPoints(C, C, 8, 120, 72)}
        className={s.draw}
        pathLength={1}
        style={{ animationDelay: "0.3s" }}
      />
      <polygon
        points={starPoints(C, C, 8, 120, 72, -67.5)}
        className={s.draw}
        pathLength={1}
        style={{ animationDelay: "0.55s" }}
      />
      <polygon
        points={starPoints(C, C, 8, 64, 40)}
        className={s.draw}
        pathLength={1}
        style={{ animationDelay: "1.2s" }}
      />
      <circle cx={C} cy={C} r={30} className={s.draw} pathLength={1} style={{ animationDelay: "1.5s" }} />
      <polygon points={starPoints(C, C, 8, 18, 9)} className={s.goldFill} />
    </svg>
  );
}

/** Lentera (fanous) yang berayun dari rantai, dengan nyala yang berkedip. */
export function Lantern({
  chain = 80,
  scale = 1,
  delay = 0,
  className,
}: {
  chain?: number;
  scale?: number;
  delay?: number;
  className?: string;
}) {
  const h = chain + 150;
  return (
    <svg
      className={`${s.lantern} ${className ?? ""}`}
      width={80 * scale}
      height={h * scale}
      viewBox={`0 0 80 ${h}`}
      style={{ animationDelay: `${delay}s` }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="ds-flame" cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="#fff4cf" />
          <stop offset="45%" stopColor="#f3c86a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#d9862f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ds-brass" x1="0" x2="1">
          <stop offset="0%" stopColor="#8a6428" />
          <stop offset="50%" stopColor="#e2b86a" />
          <stop offset="100%" stopColor="#8a6428" />
        </linearGradient>
      </defs>
      <line x1="40" y1="0" x2="40" y2={chain} stroke="#b89150" strokeWidth="1.2" strokeDasharray="3 3" />
      <g transform={`translate(0 ${chain})`}>
        <circle cx="40" cy="4" r="4" fill="none" stroke="url(#ds-brass)" strokeWidth="2" />
        <path d="M22 26 Q40 2 58 26 Z" fill="url(#ds-brass)" />
        <rect x="18" y="26" width="44" height="6" rx="2" fill="url(#ds-brass)" />
        <ellipse cx="40" cy="78" rx="46" ry="52" fill="url(#ds-flame)" className={s.flameGlow} />
        <path
          d="M22 32 L58 32 L62 70 Q62 104 40 118 Q18 104 18 70 Z"
          fill="rgba(243, 200, 106, 0.16)"
          stroke="url(#ds-brass)"
          strokeWidth="2"
        />
        <path d="M40 32 L40 116 M22 60 Q40 50 58 60 M20 84 Q40 74 60 84" stroke="#b89150" strokeWidth="1" fill="none" opacity="0.7" />
        <path d="M31 40 Q40 30 49 40 L49 58 L31 58 Z" fill="none" stroke="#e2b86a" strokeWidth="1" opacity="0.8" />
        <ellipse cx="40" cy="76" rx="7" ry="11" fill="#fff1c1" className={s.flame} />
        <path d="M30 118 L50 118 L44 132 L36 132 Z" fill="url(#ds-brass)" />
        <circle cx="40" cy="138" r="3" fill="#e2b86a" />
      </g>
    </svg>
  );
}

export function Crescent({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <mask id="ds-crescent">
          <rect width="64" height="64" fill="#fff" />
          <circle cx="42" cy="24" r="22" fill="#000" />
        </mask>
      </defs>
      <circle cx="30" cy="32" r="24" fill="#f7e2b0" mask="url(#ds-crescent)" />
    </svg>
  );
}

/** Bintang delapan kecil — penanda langkah, nomor bacaan, dan poin daftar. */
export function Star8({
  size = 22,
  filled = true,
  className,
  children,
}: {
  size?: number;
  filled?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className={`${s.star8} ${className ?? ""}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
        <polygon
          points={starPoints(20, 20, 8, 19, 14)}
          fill={filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={filled ? 0 : 2}
        />
      </svg>
      {children !== undefined && <span className={s.star8Label}>{children}</span>}
    </span>
  );
}

/** Pita tujuh hari; dua hari belajar menyala. */
const HARI = [
  ["Senin", "Sn"],
  ["Selasa", "Sl"],
  ["Rabu", "Rb"],
  ["Kamis", "Km"],
  ["Jumat", "Jm"],
  ["Sabtu", "Sb"],
  ["Ahad", "Ah"],
] as const;
export function WeekStrip({ hari }: { hari: string }) {
  const on = hari.split(/\s*&\s*|\s+dan\s+/i).map((h) => h.trim());
  return (
    <span className={s.weekStrip} aria-hidden="true">
      {HARI.map(([h, singkat]) => (
        <span key={h} className={on.includes(h) ? s.weekOn : s.weekOff}>
          {singkat}
        </span>
      ))}
    </span>
  );
}

/** Ikon waktu belajar: fajar untuk pagi, matahari untuk siang, bulan untuk malam. */
export function TimeGlyph({ jam }: { jam: string }) {
  const hour = Number(jam.slice(0, 2));
  if (hour < 10) {
    return (
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className={s.timeGlyph}>
        <path d="M3 18h20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M7 18a6 6 0 0 1 12 0" fill="#f3c86a" />
        <path d="M13 5v3M5.5 9.5l2 2M20.5 9.5l-2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className={s.rays} />
        <path d="M6 22h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
      </svg>
    );
  }
  if (hour < 17) {
    return (
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className={s.timeGlyph}>
        <g className={s.spinSlow} style={{ transformOrigin: "13px 13px" }}>
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i} x1="13" y1="2.5" x2="13" y2="5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${i * 45} 13 13)`} />
          ))}
        </g>
        <circle cx="13" cy="13" r="5" fill="#f3c86a" />
      </svg>
    );
  }
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className={s.timeGlyph}>
      <path d="M17.5 17.8A8 8 0 0 1 10 4.2a8 8 0 1 0 10.8 10.9 8 8 0 0 1-3.3 2.7z" fill="#f3d08a" />
      <circle cx="20" cy="6" r="1" fill="currentColor" className={s.twinkle} />
      <circle cx="23" cy="10" r="0.7" fill="currentColor" className={s.twinkle} style={{ animationDelay: "1s" }} />
    </svg>
  );
}

/**
 * Ilustrasi level: benih (Dasar), pohon muda (Lanjutan), pohon berbuah bintang
 * (Alumni). Saat dipilih, tanamannya "tumbuh".
 */
export function LevelGlyph({ level, active }: { level: "dasar" | "lanjutan" | "alumni"; active: boolean }) {
  const cls = `${s.levelGlyph} ${active ? s.levelGrow : ""}`;
  return (
    <svg viewBox="0 0 64 64" width="56" height="56" className={cls} aria-hidden="true">
      <path d="M8 54 Q32 48 56 54" stroke="#a07a35" strokeWidth="2" fill="none" strokeLinecap="round" />
      {level === "dasar" && (
        <g className={s.sprout}>
          <path d="M32 53 L32 40" stroke="#4a7d5a" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M32 44 Q22 42 21 33 Q30 33 32 42" fill="#6fa27c" />
          <path d="M32 41 Q41 38 43 30 Q34 30 32 39" fill="#4a7d5a" />
        </g>
      )}
      {level === "lanjutan" && (
        <g className={s.sprout}>
          <path d="M32 53 L32 30" stroke="#7a5a2e" strokeWidth="3" strokeLinecap="round" />
          <path d="M32 40 L24 33 M32 36 L40 29" stroke="#7a5a2e" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="24" r="11" fill="#4a7d5a" />
          <circle cx="23" cy="30" r="7" fill="#6fa27c" />
          <circle cx="41" cy="27" r="8" fill="#5b8f6a" />
        </g>
      )}
      {level === "alumni" && (
        <g className={s.sprout}>
          <path d="M32 53 L32 30" stroke="#7a5a2e" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="32" cy="22" r="14" fill="#3f6e4d" />
          <circle cx="20" cy="29" r="9" fill="#4a7d5a" />
          <circle cx="44" cy="28" r="10" fill="#5b8f6a" />
          <polygon points={starPoints(26, 18, 5, 4, 1.8)} fill="#f3d08a" className={s.twinkle} />
          <polygon points={starPoints(40, 22, 5, 4, 1.8)} fill="#f3d08a" className={s.twinkle} style={{ animationDelay: "0.8s" }} />
          <polygon points={starPoints(21, 30, 5, 3.4, 1.5)} fill="#f3d08a" className={s.twinkle} style={{ animationDelay: "1.6s" }} />
        </g>
      )}
    </svg>
  );
}

/** Sudut hiasan untuk kartu perkamen. */
export function CornerOrnament({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 90" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <polygon points={starPoints(0, 0, 8, 58, 40)} />
        <polygon points={starPoints(0, 0, 8, 34, 24)} />
        <circle cx="0" cy="0" r="72" />
        <circle cx="0" cy="0" r="80" strokeDasharray="2 4" />
      </g>
    </svg>
  );
}
