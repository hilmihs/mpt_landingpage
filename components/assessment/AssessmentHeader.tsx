import Link from "next/link";
import { MPTLogo } from "@/components/shared/MPTLogo";

interface Props {
  step?: number;
  total?: number;
  title?: string;
}

export function AssessmentHeader({ step, total = 3, title }: Props) {
  return (
    <header className="site-header-mpt">
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
            color: "var(--ink)",
          }}
        >
          <MPTLogo size={44} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1.05,
            }}
          >
            <span
              className="font-display"
              style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)" }}
            >
              MuhajirProject
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--accent-deep)",
              }}
            >
              #Tilawah
            </span>
          </div>
        </Link>

        {step ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--ink-mute)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
            }}
          >
            <span style={{ display: "none" }} className="hide-mobile">
              LANGKAH
            </span>
            <span style={{ color: "var(--ink)" }}>
              {step}/{total}
            </span>
          </div>
        ) : (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--ink-mute)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {title ?? "Assessment Al-Fatihah"}
          </div>
        )}
      </div>

      {step ? (
        <div style={{ padding: "0 20px 12px" }}>
          <div className="step-track">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={
                  i < step - 1 ? "done" : i === step - 1 ? "active" : ""
                }
              />
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
