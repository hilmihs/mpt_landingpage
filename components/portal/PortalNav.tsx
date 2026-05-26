"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarClock,
  Users,
  ClipboardCheck,
  GraduationCap,
  LogOut,
  Menu,
  X,
  User,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/portal-mpt-x7/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal-mpt-x7/availability", label: "Ketersediaan", icon: CalendarClock },
  { href: "/portal-mpt-x7/bookings", label: "Booking Masuk", icon: Users },
  { href: "/portal-mpt-x7/cohorts", label: "Cohort Tahsin", icon: GraduationCap },
  { href: "/portal-mpt-x7/attendance", label: "Kehadiran", icon: ClipboardCheck },
  { href: "/portal-mpt-x7/profil", label: "Profil", icon: User },
];

interface Props {
  nama: string;
  jenisKelamin: "ikhwan" | "akhwat";
}

export function PortalNav({ nama, jenisKelamin }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="portal-menu-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={open ? "portal-nav portal-nav-open" : "portal-nav"}
        style={{
          width: 240,
          background: "var(--primary)",
          color: "var(--primary-ink)",
          minHeight: "100dvh",
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          position: "sticky",
          top: 0,
        }}
      >
        <div style={{ padding: "0 8px 18px", borderBottom: "1px solid color-mix(in oklab, var(--primary-ink), transparent 80%)" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: 0.6,
              marginBottom: 4,
            }}
          >
            Portal Pengajar
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{nama}</div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
            {jenisKelamin === "ikhwan" ? "Ikhwan" : "Akhwat"}
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 14, flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "var(--accent)" : "var(--primary-ink)",
                  background: isActive ? "color-mix(in oklab, var(--accent), transparent 88%)" : "transparent",
                  textDecoration: "none",
                }}
              >
                <Icon size={16} strokeWidth={2.2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <form action="/api/portal/logout" method="POST">
          <button
            type="submit"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              color: "var(--primary-ink)",
              background: "transparent",
              border: "1px solid color-mix(in oklab, var(--primary-ink), transparent 75%)",
              cursor: "pointer",
            }}
          >
            <LogOut size={16} strokeWidth={2.2} />
            Keluar
          </button>
        </form>
      </aside>

      <style jsx>{`
        .portal-menu-toggle {
          display: none;
        }
        @media (max-width: 768px) {
          .portal-menu-toggle {
            display: grid;
            place-items: center;
            position: fixed;
            top: 14px;
            left: 14px;
            z-index: 60;
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: var(--primary);
            color: var(--primary-ink);
            border: none;
            cursor: pointer;
          }
          .portal-nav {
            position: fixed !important;
            top: 0;
            left: 0;
            z-index: 50;
            transform: translateX(-100%);
            transition: transform 0.2s ease;
          }
          .portal-nav-open {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
