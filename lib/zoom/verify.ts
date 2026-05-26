import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify the X-Zm-Signature header on an incoming Zoom webhook request.
 *
 * Zoom signs requests as:
 *   signature = 'v0=' + HMAC_SHA256(
 *     secret_token,
 *     'v0:' + x-zm-request-timestamp + ':' + rawBody
 *   )
 *
 * Reference: https://developers.zoom.us/docs/api/webhooks/#verify-webhook-events
 */
export function verifyZoomSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secretToken: string,
): boolean {
  if (!timestamp || !signature || !signature.startsWith("v0=")) return false;

  // Reject timestamps older than 5 minutes (replay protection)
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const drift = Math.abs(Date.now() - ts * 1000);
  if (drift > 5 * 60_000) return false;

  const message = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${createHmac("sha256", secretToken).update(message).digest("hex")}`;

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;

  try {
    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

/**
 * Compute the response for Zoom's URL Validation challenge.
 * https://developers.zoom.us/docs/api/webhooks/#validate-your-webhook-endpoint
 */
export function computeValidationResponse(
  plainToken: string,
  secretToken: string,
): { plainToken: string; encryptedToken: string } {
  const encryptedToken = createHmac("sha256", secretToken)
    .update(plainToken)
    .digest("hex");
  return { plainToken, encryptedToken };
}
