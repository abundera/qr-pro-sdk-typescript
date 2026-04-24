# @abundera/qr-pro

Official TypeScript SDK for [Abundera QR Pro](https://pro.qr.abundera.ai).

Dynamic QR codes that you actually own. Scan analytics. Webhooks. Privacy-safe by default.

## Install

```bash
npm install @abundera/qr-pro
```

Requires Node 18+ (uses built-in `fetch` and `node:crypto`).

## Quickstart

```ts
import { AbunderaQRProClient } from "@abundera/qr-pro";

const client = new AbunderaQRProClient({
  apiKey: process.env.ABUNDERA_API_KEY!,
});

// Create a dynamic code
const code = await client.createCode({
  destination_url: "https://example.com/launch",
  label: "Spring launch poster",
  tags: ["print", "q2"],
});

console.log(code.short_url); // https://aqr.net/xY3pK2

// Later: change where it points
await client.updateCode(code.id, {
  destination_url: "https://example.com/launch/v2",
});

// Pull analytics
const stats = await client.getAnalytics(code.id, { from: "2026-04-01" });
console.log(stats.total_scans, stats.by_country);
```

## Webhook verification

```ts
import { verifyWebhookSignature } from "@abundera/qr-pro";

// In your webhook handler:
const signature = req.headers["x-abundera-signature"];
const body = await readRawBody(req); // raw string, NOT parsed JSON

verifyWebhookSignature({
  signature,
  body,
  secret: process.env.ABUNDERA_WEBHOOK_SECRET!,
});
// throws if invalid — safe to parse and act on body after this line
```

## Configuration

| Option         | Default                        | Description                                  |
| -------------- | ------------------------------ | -------------------------------------------- |
| `apiKey`       | **required**                   | API key from `/account/keys`                 |
| `baseUrl`      | `https://pro.qr.abundera.ai`   | Override for self-hosted / staging           |
| `timeoutMs`    | `30000`                        | Per-request timeout                          |
| `maxRetries`   | `3`                            | Retries for 429/5xx (exponential backoff)    |
| `userAgent`    | `abundera-qr-pro-js/<version>` | Sent on every request                        |
| `fetch`        | global `fetch`                 | Inject a custom fetch implementation         |

## Error handling

All non-2xx responses (after retries) throw `AbunderaError`:

```ts
import { AbunderaError } from "@abundera/qr-pro";

try {
  await client.createCode({ destination_url: "not a url" });
} catch (e) {
  if (e instanceof AbunderaError) {
    console.error(e.status, e.code, e.message, e.request_id);
  }
}
```

## Coverage

Supported surfaces: codes (CRUD + import + slug check), analytics (JSON + CSV), groups, webhooks, user. See [API docs](https://pro.qr.abundera.ai/docs/) for the full OpenAPI 3.1 spec.

## License

MIT © Abundera, Inc.
