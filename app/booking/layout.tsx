import type { ReactNode } from "react";

export default function BookingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="screen-enter" style={{ minHeight: "100dvh" }}>
      {children}
    </div>
  );
}
