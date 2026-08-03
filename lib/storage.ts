import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Storage } from "@google-cloud/storage";

/**
 * Penyimpanan audio peserta. Menggantikan Supabase Storage.
 *
 * Dua driver, dipilih otomatis:
 *   - GCS_BUCKET diset  -> Google Cloud Storage (produksi)
 *   - tidak diset       -> disk lokal di .data/audio (dev, tanpa kredensial GCP)
 *
 * Retensi 7 hari TIDAK diurus di sini. Di produksi itu tugas lifecycle rule
 * bucket GCS, yang berlaku per-objek tanpa peduli tabel mana yang merujuknya —
 * justru itu yang menutup bug "rekaman HITS tidak pernah terhapus".
 * Lihat docs/MIGRATION_SUPABASE_TO_GCP.md 2.2.
 */

const BUCKET = process.env.GCS_BUCKET;
const LOCAL_ROOT = path.join(process.cwd(), ".data", "audio");

export const usingGcs = Boolean(BUCKET);

let cachedStorage: Storage | undefined;

function gcs(): Storage {
  if (!cachedStorage) {
    // Di Cloud Run kredensial datang dari service account bawaan; di lokal
    // dari GOOGLE_APPLICATION_CREDENTIALS. Keduanya ditangani SDK.
    cachedStorage = new Storage();
  }
  return cachedStorage;
}

function localPathFor(objectPath: string): string {
  // Tolak path yang mencoba keluar dari LOCAL_ROOT.
  const resolved = path.resolve(LOCAL_ROOT, objectPath);
  if (resolved !== LOCAL_ROOT && !resolved.startsWith(LOCAL_ROOT + path.sep)) {
    throw new Error("invalid object path");
  }
  return resolved;
}

export async function uploadAudio(
  objectPath: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  if (BUCKET) {
    await gcs().bucket(BUCKET).file(objectPath).save(data, {
      contentType,
      resumable: false,
    });
    return;
  }
  const target = localPathFor(objectPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
}

export async function removeAudio(objectPaths: string[]): Promise<void> {
  await Promise.all(
    objectPaths.map(async (p) => {
      try {
        if (BUCKET) {
          await gcs().bucket(BUCKET).file(p).delete({ ignoreNotFound: true });
        } else {
          await unlink(localPathFor(p));
        }
      } catch {
        // Objek yang sudah hilang bukan kegagalan — hasil akhirnya sama.
      }
    }),
  );
}

export async function readAudio(
  objectPath: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    if (BUCKET) {
      const file = gcs().bucket(BUCKET).file(objectPath);
      const [buf] = await file.download();
      const [meta] = await file.getMetadata();
      return { body: buf, contentType: meta.contentType ?? "audio/webm" };
    }
    return { body: await readFile(localPathFor(objectPath)), contentType: "audio/webm" };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// URL bertanda tangan
// ---------------------------------------------------------------------------

function signingSecret(): string {
  const s = process.env.STORAGE_SIGNING_SECRET ?? process.env.WORKER_SECRET;
  if (!s) throw new Error("Missing STORAGE_SIGNING_SECRET (atau WORKER_SECRET)");
  return s;
}

function sign(objectPath: string, expEpochSec: number): string {
  return createHmac("sha256", signingSecret())
    .update(`${objectPath}:${expEpochSec}`)
    .digest("hex");
}

/** Verifikasi token dari /api/audio. Menolak tanda tangan salah dan yang kedaluwarsa. */
export function verifyAudioToken(
  objectPath: string,
  exp: string | null,
  sig: string | null,
): boolean {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum * 1000 < Date.now()) return false;

  const expected = Buffer.from(sign(objectPath, expNum));
  const given = Buffer.from(sig);
  // timingSafeEqual melempar kalau panjangnya beda, jadi disamakan dulu.
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

/**
 * URL yang bisa diputar/diunduh tanpa sesi login, berumur pendek.
 *
 * GCS memakai signed URL V4 supaya server ML menarik langsung dari Google
 * tanpa melewati Cloud Run. Driver lokal memakai route /api/audio milik kita.
 */
export async function signedAudioUrl(
  objectPath: string,
  expiresInSec = 600,
): Promise<string> {
  if (BUCKET) {
    const [url] = await gcs()
      .bucket(BUCKET)
      .file(objectPath)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + expiresInSec * 1000,
      });
    return url;
  }

  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const qs = new URLSearchParams({ exp: String(exp), sig: sign(objectPath, exp) });
  return `${base}/api/audio/${objectPath}?${qs}`;
}
