const LINKTREE =
  process.env.NEXT_PUBLIC_LINKTREE_URL ??
  "https://linktr.ee/muhajirprojecttilawah";

export function CTATahsin() {
  return (
    <div
      style={{
        padding: "36px 28px",
        borderRadius: 24,
        background: "var(--primary)",
        color: "var(--primary-ink)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -80,
          right: -80,
          width: 280,
          height: 280,
          background: "var(--accent)",
          opacity: 0.18,
          borderRadius: "50%",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
        aria-hidden
      />

      <div
        className="rapot-cta-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 28,
          alignItems: "center",
          position: "relative",
        }}
      >
        <div>
          <div
            className="pill"
            style={{
              background:
                "color-mix(in oklab, var(--accent), transparent 70%)",
              color: "color-mix(in oklab, var(--accent), white 30%)",
              marginBottom: 14,
            }}
          >
            Rekomendasi
          </div>
          <h2
            className="font-display"
            style={{
              fontSize: "clamp(24px, 3.5vw, 34px)",
              margin: "0 0 12px",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
            }}
          >
            Mari sempurnakan bacaan Anda.
          </h2>
          <p
            style={{
              fontSize: 15,
              opacity: 0.85,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Lanjutkan dengan pendampingan langsung Program Perbaikan Bacaan
            Al-Fatihah bersama Muhajir Project.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a
            href={LINKTREE}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-mpt btn-mpt-accent"
            style={{ minHeight: 56, fontSize: 16 }}
          >
            Daftar Sekarang
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </a>
          <div
            style={{
              fontSize: 12,
              opacity: 0.7,
              textAlign: "center",
            }}
          >
            Gratis untuk peserta MPT
          </div>
        </div>
      </div>
    </div>
  );
}
