import { Suspense } from "react";

export default function DaftarHitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense>{children}</Suspense>;
}
