import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal Pengajar — Muhajir Project Tilawah",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function PortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
