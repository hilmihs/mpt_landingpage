"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navigation, X } from "lucide-react";
import { DEMO_NAV_LINKS } from "@/lib/demo-data";

export function DemoNavigator() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999 }}>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: 64,
            right: 0,
            width: 320,
            maxHeight: "70vh",
            overflowY: "auto",
            background: "var(--paper)",
            border: "1px dashed var(--accent)",
            borderRadius: 16,
            padding: "16px 14px",
            boxShadow: "0 24px 60px -20px rgba(0,0,0,0.25)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--accent-deep)",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Navigation size={13} />
            Demo Navigator
          </div>

          {DEMO_NAV_LINKS.map((group) => (
            <div key={group.group} style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                  marginBottom: 6,
                  padding: "0 4px",
                }}
              >
                {group.group}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {group.links.map((link) => {
                  const isActive = pathname === link.href.split("?")[0];
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      style={{
                        fontSize: 12,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? "var(--accent)" : "var(--ink-soft)",
                        textDecoration: "none",
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: isActive
                          ? "color-mix(in oklab, var(--accent), transparent 90%)"
                          : "transparent",
                        transition: "background 0.15s",
                      }}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: open ? "var(--primary)" : "var(--accent)",
          color: open ? "var(--primary-ink)" : "var(--ink)",
          border: "none",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 8px 24px -8px rgba(0,0,0,0.3)",
          transition: "all 0.2s",
        }}
      >
        {open ? <X size={22} /> : <Navigation size={22} />}
      </button>
    </div>
  );
}
