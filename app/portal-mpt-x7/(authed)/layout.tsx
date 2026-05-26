import { redirect } from "next/navigation";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { PortalNav } from "@/components/portal/PortalNav";

export const dynamic = "force-dynamic";

export default async function AuthedPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const teacher = await getCurrentTeacher();
  if (!teacher) redirect("/portal-mpt-x7/login");

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: "var(--bg)" }}>
      <PortalNav nama={teacher.nama} jenisKelamin={teacher.jenisKelamin} />
      <main
        style={{
          flex: 1,
          padding: "32px 24px 60px",
          maxWidth: "100%",
          overflow: "hidden",
        }}
      >
        {children}
      </main>
    </div>
  );
}
