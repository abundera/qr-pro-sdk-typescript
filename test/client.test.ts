import { describe, it, expect, vi } from "vitest";
import { AbunderaQRProClient, AbunderaError } from "../src/index.js";
import type { ClientOptions } from "../src/index.js";

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function makeClient(
  fetchMock: ReturnType<typeof vi.fn>,
  opts: Partial<ClientOptions> = {},
) {
  return new AbunderaQRProClient({
    apiKey: "sk_test_123",
    fetch: fetchMock as unknown as typeof fetch,
    ...opts,
  });
}

describe("AbunderaQRProClient", () => {
  it("throws when apiKey is missing", () => {
    expect(() => new AbunderaQRProClient({ apiKey: "" })).toThrow(/apiKey is required/);
  });

  it("sends bearer auth + default headers and URL-encodes the path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: "c_1" }));
    await makeClient(fetchMock).getCode("c 1"); // space forces encoding
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://pro.qr.abundera.ai/api/codes/c%201");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer sk_test_123");
    expect(init.headers.Accept).toBe("application/json");
  });

  it("serializes query params and omits undefined ones", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: [], pagination: {} }));
    await makeClient(fetchMock).listCodes({
      limit: 10,
      tag: "promo",
      group_id: undefined,
    });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/api/codes");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("tag")).toBe("promo");
    expect(url.searchParams.has("group_id")).toBe(false);
  });

  it("sends a JSON body with content-type on POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: "c_2" }));
    await makeClient(fetchMock).createCode({ destination_url: "https://x.example" });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ destination_url: "https://x.example" });
  });

  it("strips a trailing slash from a custom baseUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    await makeClient(fetchMock, { baseUrl: "https://api.example.com/" }).me();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/api/user/me");
  });

  it("returns raw text for non-JSON responses", async () => {
    const csv = "date,scans\n2026-01-01,5\n";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(csv, { status: 200, headers: { "content-type": "text/csv" } }),
      );
    const out = await makeClient(fetchMock).getAnalyticsCsv("c_1");
    expect(out).toBe(csv);
  });

  it("throws AbunderaError with parsed body and request id on 4xx", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          404,
          { code: "not_found", message: "no such code" },
          { "x-request-id": "req_abc" },
        ),
      );
    const err = await makeClient(fetchMock)
      .getCode("missing")
      .catch((e) => e);
    expect(err).toBeInstanceOf(AbunderaError);
    expect(err).toMatchObject({
      status: 404,
      code: "not_found",
      message: "no such code",
      request_id: "req_abc",
    });
  });

  it("retries a retryable status then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(503, { code: "unavailable" }, { "retry-after": "0.01" }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { id: "c_ok" }));
    const res = (await makeClient(fetchMock).getCode("c_ok")) as { id: string };
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.id).toBe("c_ok");
  });

  it("gives up after maxRetries and throws AbunderaError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(503, { code: "unavailable", message: "down" }, { "retry-after": "0.01" }),
      );
    const err = await makeClient(fetchMock, { maxRetries: 2 })
      .me()
      .catch((e) => e);
    expect(err).toBeInstanceOf(AbunderaError);
    expect(err.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("propagates a network error without retrying when maxRetries is 0", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    await expect(makeClient(fetchMock, { maxRetries: 0 }).me()).rejects.toThrow(
      /ECONNRESET/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
