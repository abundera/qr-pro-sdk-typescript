import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SECONDS = 300;

export interface VerifyOptions {
  signature: string;
  body: string;
  secret: string;
  toleranceSeconds?: number;
  now?: () => number;
}

/**
 * Verify a Stripe-compatible webhook signature of the form:
 *   `t=<unix_ts>,v1=<hex>`
 *
 * Recomputes HMAC-SHA256 of `"{t}.{body}"` with the registered secret and
 * compares in constant time. Throws on any mismatch or timestamp skew > tolerance.
 */
export function verifyWebhookSignature(opts: VerifyOptions): true {
  const tolerance = opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const parts = Object.fromEntries(
    opts.signature.split(",").map((p) => {
      const [k, ...rest] = p.split("=");
      return [k, rest.join("=")];
    }),
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) throw new Error("invalid signature header");

  const ts = Number.parseInt(t, 10);
  if (!Number.isFinite(ts)) throw new Error("invalid timestamp");
  const nowSec = Math.floor((opts.now?.() ?? Date.now()) / 1000);
  if (Math.abs(nowSec - ts) > tolerance) {
    throw new Error("signature timestamp outside tolerance");
  }

  const signedPayload = `${t}.${opts.body}`;
  const expected = createHmac("sha256", opts.secret)
    .update(signedPayload)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("signature mismatch");
  }
  return true;
}
