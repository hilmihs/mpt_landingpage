import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { countBelumDijawab } from "@/lib/hits-tanya";

export const dynamic = "force-dynamic";

export default async function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  const pertanyaanBaru = await countBelumDijawab();

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: "var(--bg)" }}>
      <AdminNav
        nama={admin.nama}
        email={admin.email}
        role={admin.role}
        badges={{ "/admin/hits-dar-syafii": pertanyaanBaru }}
      />
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
