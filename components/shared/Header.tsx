"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MPTLogo } from "@/components/shared/MPTLogo";

export function Header() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isFlow =
    pathname.startsWith("/assessment") || pathname.startsWith("/rapot");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Flow & rapot pages render their own AssessmentHeader.
  if (isFlow) return null;

  return (
    <header
      className="sticky top-0 z-50 transition-all duration-300"
      style={{
        background: scrolled
          ? "color-mix(in oklab, var(--bg), white 10%)"
          : "transparent",
        backdropFilter: scrolled ? "blur(12px) saturate(140%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px) saturate(140%)" : "none",
        borderBottom: `1px solid ${scrolled ? "var(--line)" : "transparent"}`,
      }}
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-3.5"
          style={{ color: "var(--ink)", textDecoration: "none" }}
        >
          <MPTLogo size={56} priority />
          <div className="flex flex-col leading-tight">
            <span
              className="font-display"
              style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}
            >
              MuhajirProject
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--accent-deep)",
                letterSpacing: "0.02em",
              }}
            >
              #Tilawah
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1.5">
          {isLanding && (
            <>
              <a className="nav-link hidden md:inline-flex" href="#cara-kerja">
                Cara Kerja
              </a>
              <a className="nav-link hidden md:inline-flex" href="#indikator">
                4 Indikator
              </a>
              <a className="nav-link hidden md:inline-flex" href="#tahsin">
                Program Tahsin
              </a>
            </>
          )}
          <Link
            href="/assessment/consent"
            className="btn-ghost"
            style={{ marginLeft: 16, padding: "10px 20px", fontSize: 14 }}
          >
            Mulai
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
        </nav>
      </div>
    </header>
  );
}
