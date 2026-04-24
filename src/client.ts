import type {
  Code,
  CodeCreate,
  CodePatch,
  Group,
  Webhook,
  Analytics,
  ListResult,
  ApiError,
} from "./types.js";

const DEFAULT_BASE_URL = "https://pro.qr.abundera.ai";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  userAgent?: string;
  fetch?: typeof fetch;
}

export class AbunderaError extends Error implements ApiError {
  status: number;
  code: string;
  request_id?: string;
  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
  ) {
    super(message);
    this.name = "AbunderaError";
    this.status = status;
    this.code = code;
    this.request_id = requestId;
  }
}

export class AbunderaQRProClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;
  private userAgent: string;
  private _fetch: typeof fetch;

  constructor(opts: ClientOptions) {
    if (!opts.apiKey) throw new Error("apiKey is required");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.userAgent = opts.userAgent ?? "abundera-qr-pro-js/0.1.0";
    this._fetch = opts.fetch ?? fetch;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "User-Agent": this.userAgent,
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this._fetch(url.toString(), {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) return (await res.json()) as T;
          return (await res.text()) as unknown as T;
        }

        if (RETRY_STATUS.has(res.status) && attempt < this.maxRetries) {
          const retryAfter = Number.parseFloat(
            res.headers.get("retry-after") || "0",
          );
          const backoff =
            retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await sleep(backoff);
          continue;
        }

        let code = "http_error";
        let message = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { code?: string; message?: string };
          code = j.code ?? code;
          message = j.message ?? message;
        } catch {}
        throw new AbunderaError(
          res.status,
          code,
          message,
          res.headers.get("x-request-id") ?? undefined,
        );
      } catch (e) {
        clearTimeout(timer);
        lastErr = e;
        if (e instanceof AbunderaError) throw e;
        if (attempt >= this.maxRetries) break;
        await sleep(250 * 2 ** attempt);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("request failed");
  }

  // --- Codes -------------------------------------------------------------

  listCodes(params?: {
    cursor?: string;
    limit?: number;
    tag?: string;
    group_id?: string;
  }) {
    return this.request<ListResult<Code>>(
      "GET",
      "/api/codes",
      undefined,
      params,
    );
  }
  getCode(id: string) {
    return this.request<Code>("GET", `/api/codes/${encodeURIComponent(id)}`);
  }
  createCode(data: CodeCreate) {
    return this.request<Code>("POST", "/api/codes", data);
  }
  updateCode(id: string, patch: CodePatch) {
    return this.request<Code>(
      "PATCH",
      `/api/codes/${encodeURIComponent(id)}`,
      patch,
    );
  }
  deleteCode(id: string) {
    return this.request<{ deleted: true }>(
      "DELETE",
      `/api/codes/${encodeURIComponent(id)}`,
    );
  }
  checkSlug(slug: string) {
    return this.request<{ available: boolean }>(
      "GET",
      "/api/codes/check-slug",
      undefined,
      { slug },
    );
  }
  importCodes(rows: CodeCreate[]) {
    return this.request<{
      imported: number;
      errors: Array<{ index: number; message: string }>;
    }>("POST", "/api/codes/import", { rows });
  }

  // --- Analytics ---------------------------------------------------------

  getAnalytics(id: string, params?: { from?: string; to?: string }) {
    return this.request<Analytics>(
      "GET",
      `/api/codes/${encodeURIComponent(id)}/analytics`,
      undefined,
      params,
    );
  }
  async getAnalyticsCsv(
    id: string,
    params?: { from?: string; to?: string },
  ): Promise<string> {
    return this.request<string>(
      "GET",
      `/api/codes/${encodeURIComponent(id)}/analytics.csv`,
      undefined,
      params,
    );
  }

  // --- Groups ------------------------------------------------------------

  listGroups() {
    return this.request<ListResult<Group>>("GET", "/api/groups");
  }
  createGroup(data: { name: string; description?: string }) {
    return this.request<Group>("POST", "/api/groups", data);
  }
  deleteGroup(id: string) {
    return this.request<{ deleted: true }>(
      "DELETE",
      `/api/groups/${encodeURIComponent(id)}`,
    );
  }

  // --- Webhooks ----------------------------------------------------------

  listWebhooks() {
    return this.request<ListResult<Webhook>>("GET", "/api/webhooks");
  }
  createWebhook(data: { url: string; events: string[] }) {
    return this.request<Webhook & { secret: string }>(
      "POST",
      "/api/webhooks",
      data,
    );
  }
  deleteWebhook(id: string) {
    return this.request<{ deleted: true }>(
      "DELETE",
      `/api/webhooks/${encodeURIComponent(id)}`,
    );
  }

  // --- User --------------------------------------------------------------

  me() {
    return this.request<{
      id: string;
      email: string;
      plan: string;
      workspace_id: string;
    }>("GET", "/api/user/me");
  }
  exportAccount() {
    return this.request<{ download_url: string; expires_at: string }>(
      "POST",
      "/api/user/export",
    );
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
