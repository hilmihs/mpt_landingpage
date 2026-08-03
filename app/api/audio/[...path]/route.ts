import { NextResponse } from "next/server";
import { readAudio, verifyAudioToken } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Menyajikan audio peserta untuk driver storage lokal (dev).
 *
 * Di produksi GCS_BUCKET diset, dan signedAudioUrl() mengembalikan signed URL
 * V4 langsung ke Google — route ini tidak terpakai. Tetap disimpan supaya
 * pengembangan lokal jalan tanpa kredensial GCP.
 *
 * Aksesnya lewat token HMAC berumur pendek, bukan sesi login: pemutar audio
 * di halaman pengajar dan server ML sama-sama perlu URL yang bisa langsung
 * diambil tanpa cookie.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const objectPath = path.join("/");

  const url = new URL(req.url);
  if (!verifyAudioToken(objectPath, url.searchParams.get("exp"), url.searchParams.get("sig"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const file = await readAudio(objectPath);
  if (!file) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.body.length),
      "Cache-Control": "private, max-age=600",
    },
  });
}
