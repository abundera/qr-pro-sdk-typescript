import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "../src/index.js";

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ event: "scan.created", id: "c_1" });
const T = 1_700_000_000; // fixed unix seconds
const now = () => T * 1000; // freeze "now" at exactly T

function sign(body: string, secret: string, t: number): string {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

describe("verifyWebhookSignature", () => {
  it("accepts a valid signature", () => {
    const sig = sign(BODY, SECRET, T);
    expect(
      verifyWebhookSignature({ signature: sig, body: BODY, secret: SECRET, now }),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = sign(BODY, SECRET, T);
    expect(() =>
      verifyWebhookSignature({ signature: sig, body: BODY + " ", secret: SECRET, now }),
    ).toThrow(/signature mismatch/);
  });

  it("rejects a wrong secret", () => {
    const sig = sign(BODY, SECRET, T);
    expect(() =>
      verifyWebhookSignature({ signature: sig, body: BODY, secret: "whsec_wrong", now }),
    ).toThrow(/signature mismatch/);
  });

  it("rejects a timestamp outside the default tolerance", () => {
    const sig = sign(BODY, SECRET, T);
    const stale = () => (T + 3600) * 1000; // 1h skew, default tolerance is 300s
    expect(() =>
      verifyWebhookSignature({ signature: sig, body: BODY, secret: SECRET, now: stale }),
    ).toThrow(/outside tolerance/);
  });

  it("accepts a skew within a custom tolerance", () => {
    const sig = sign(BODY, SECRET, T);
    const skew = () => (T + 100) * 1000;
    expect(
      verifyWebhookSignature({
        signature: sig,
        body: BODY,
        secret: SECRET,
        now: skew,
        toleranceSeconds: 200,
      }),
    ).toBe(true);
  });

  it("rejects a malformed header missing v1", () => {
    expect(() =>
      verifyWebhookSignature({ signature: `t=${T}`, body: BODY, secret: SECRET, now }),
    ).toThrow(/invalid signature header/);
  });

  it("rejects a non-numeric timestamp", () => {
    expect(() =>
      verifyWebhookSignature({
        signature: `t=abc,v1=deadbeef`,
        body: BODY,
        secret: SECRET,
        now,
      }),
    ).toThrow(/invalid timestamp/);
  });
});
