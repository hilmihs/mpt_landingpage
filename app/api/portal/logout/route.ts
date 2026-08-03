import { signOut } from "@/auth";

export const runtime = "nodejs";

export async function POST() {
  // signOut menghapus cookie sesi lalu melempar redirect yang ditangani Next.
  await signOut({ redirectTo: "/portal-mpt-x7/login" });
}
