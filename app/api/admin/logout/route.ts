import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  const { origin } = new URL(req.url);
  return NextResponse.redirect(`${origin}/admin/login`, { status: 303 });
}
