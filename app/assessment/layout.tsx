"use client";

import { usePathname } from "next/navigation";
import { Blobs } from "@/components/assessment/Blobs";
import { AssessmentHeader } from "@/components/assessment/AssessmentHeader";

// Dua langkah, bukan tiga. Langkah ketiga dulu adalah layar "menganalisis"
// yang menunggu AI; sejak penilaian dipegang pengajar, mengirim rekaman adalah
// langkah terakhir yang peserta kerjakan — sisanya menunggu kabar WhatsApp.
function deriveStep(pathname: string): number | undefined {
  if (pathname.startsWith("/assessment/record")) return 1;
  if (pathname.startsWith("/assessment/form")) return 2;
  return undefined;
}

export default function AssessmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const step = deriveStep(pathname);

  return (
    <>
      <Blobs />
      <AssessmentHeader step={step} total={2} />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </>
  );
}
