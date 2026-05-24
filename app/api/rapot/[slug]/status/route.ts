import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const sb = supabaseService();

  const { data, error } = await sb
    .from("submissions")
    .select("status, error_message, rapot_slug")
    .eq("rapot_slug", slug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "db_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const headers = { "Cache-Control": "no-store" };

  if (data.status === "completed") {
    return NextResponse.json(
      { status: "completed", rapot_url: `/rapot/${slug}` },
      { headers },
    );
  }
  if (data.status === "failed") {
    return NextResponse.json(
      { status: "failed", error_message: data.error_message ?? "Unknown error" },
      { headers },
    );
  }
  return NextResponse.json(
    { status: data.status, progress: data.status === "processing" ? 60 : 20 },
    { headers },
  );
}
