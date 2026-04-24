// Minimal quickstart: create, update, analytics, webhook verification.
// Run: ABUNDERA_API_KEY=... npx tsx examples/quickstart.ts
import { AbunderaQRProClient, verifyWebhookSignature } from "../src/index.js";

const client = new AbunderaQRProClient({
  apiKey:
    process.env.ABUNDERA_API_KEY ??
    (() => {
      throw new Error("ABUNDERA_API_KEY missing");
    })(),
});

const code = await client.createCode({
  destination_url: "https://example.com/launch",
  label: "Quickstart example",
  tags: ["example"],
});
console.log("created:", code.short_url);

const updated = await client.updateCode(code.id, {
  destination_url: "https://example.com/launch/v2",
});
console.log("updated:", updated.destination_url);

const stats = await client.getAnalytics(code.id);
console.log("scans:", stats.total_scans);

// Webhook verification example (offline — synthesized signature).
import { createHmac } from "node:crypto";
const secret = "whsec_example";
const body = '{"event":"code.scanned","code_id":"' + code.id + '"}';
const ts = String(Math.floor(Date.now() / 1000));
const v1 = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
verifyWebhookSignature({ signature: `t=${ts},v1=${v1}`, body, secret });
console.log("webhook signature verified");

await client.deleteCode(code.id);
