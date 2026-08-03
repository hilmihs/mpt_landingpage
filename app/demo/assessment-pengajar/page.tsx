import type { Metadata } from "next";
import { AssessmentScaleNote } from "@/components/rapot/AssessmentScaleNote";
import { TeacherReport } from "@/components/rapot/TeacherReport";
import { DEMO_TEACHER_ASSESSMENT } from "@/lib/teacher-assessment";

export const metadata: Metadata = {
  title: "Demo — Hasil Assessment Pengajar — Muhajir Project Tilawah",
  robots: { index: false, follow: false },
};

export default function DemoAssessmentPengajarPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 48px" }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 14,
        }}
      >
        Demo · Data Contoh
      </div>

      <AssessmentScaleNote />
      <TeacherReport data={DEMO_TEACHER_ASSESSMENT} />
    </div>
  );
}
