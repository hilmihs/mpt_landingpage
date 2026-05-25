import { Blobs } from "@/components/assessment/Blobs";
import { AssessmentHeader } from "@/components/assessment/AssessmentHeader";

export default function RapotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Blobs />
      <AssessmentHeader title="Rapot Bacaan" />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </>
  );
}
