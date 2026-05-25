"use client";

import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  // Landing has its own marketing 4-col footer inline; flow pages render
  // bespoke ends. Suppress the minimal footer in all those cases.
  if (
    pathname === "/" ||
    pathname.startsWith("/assessment") ||
    pathname.startsWith("/rapot")
  ) {
    return null;
  }

  return (
    <footer className="border-t mt-16">
      <div className="mx-auto max-w-4xl px-4 py-6 text-xs text-muted-foreground">
        <p>
          © {new Date().getFullYear()} Muhajir Project Tilawah. Audio peserta
          disimpan maksimal 7 hari.
        </p>
      </div>
    </footer>
  );
}
