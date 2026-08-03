import type { MLPredictInput, MLPredictResult } from "@/types";

/**
 * Real ML inference client — calls the self-hosted Mu'alim server (POST /predict).
 * Used by app/api/worker/route.ts when ML_SERVER_URL is set; otherwise the worker
 * falls back to mockMLPredict for local/no-GPU dev.
 *
 * Contract mirrors ml-server/app/schemas.py (MLPredictResult + ErrorItem).
 */
export async function mlPredict(input: MLPredictInput): Promise<MLPredictResult> {
  const base = process.env.ML_SERVER_URL;
  if (!base) throw new Error("ML_SERVER_URL not set");

  const res = await fetch(`${base.replace(/\/$/, "")}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ML_SERVER_API_KEY ?? ""}`,
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ML server ${res.status}: ${body.slice(0, 200)}`);
  }

  return (await res.json()) as MLPredictResult;
}
