import { redis } from "@/lib/redis";

/**
 * Simple Upstash REST queue (LIST-backed).
 *
 * Kenapa bukan BullMQ? BullMQ butuh persistent TCP connection ke Redis,
 * sedangkan Vercel serverless function lifecycle pendek dan idle-killed.
 * Upstash REST-based LPUSH/RPOP works langsung di serverless tanpa hassle.
 *
 * Swap point: ganti enqueueJob + drainJobs kalau pindah ke worker dedicated
 * (mis. Railway / Fly / GPU server) dengan BullMQ + ioredis TCP.
 */

const QUEUE_KEY = "queue:ml-jobs";

export interface MLJob {
  submission_id: string;
  rapot_slug: string;
  audio_path: string;
  enqueued_at: number;
}

export async function enqueueJob(job: MLJob): Promise<void> {
  await redis().lpush(QUEUE_KEY, JSON.stringify(job));
}

export async function drainJobs(maxJobs = 10): Promise<MLJob[]> {
  const jobs: MLJob[] = [];
  for (let i = 0; i < maxJobs; i++) {
    const raw = await redis().rpop<string>(QUEUE_KEY);
    if (!raw) break;
    try {
      jobs.push(typeof raw === "string" ? JSON.parse(raw) : (raw as MLJob));
    } catch {
      // skip malformed
    }
  }
  return jobs;
}

export async function queueLength(): Promise<number> {
  return await redis().llen(QUEUE_KEY);
}
