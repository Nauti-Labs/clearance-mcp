import type { ClearanceRequest, ClearanceResponse, ClearanceListResponse, VerifyTokenResponse, KeyCreateRequest, KeyCreateResponse, UsageResponse } from "./types.js";

export class ClearanceClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey: string, baseUrl = "https://clearance.nauti-labs.com", timeoutMs = 10000) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = timeoutMs;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Clearance API error ${response.status}: ${text || response.statusText}`
        );
      }

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  async createClearance(data: ClearanceRequest): Promise<ClearanceResponse> {
    return this.request<ClearanceResponse>("POST", "/v1/clearances", data);
  }

  async getClearance(id: string): Promise<ClearanceResponse> {
    return this.request<ClearanceResponse>("GET", `/v1/clearances/${encodeURIComponent(id)}`);
  }

  async listClearances(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ClearanceListResponse> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    if (params?.offset !== undefined) query.set("offset", String(params.offset));
    const qs = query.toString();
    return this.request<ClearanceListResponse>("GET", `/v1/clearances${qs ? "?" + qs : ""}`);
  }

  async approveClearance(id: string): Promise<ClearanceResponse> {
    return this.request<ClearanceResponse>("POST", `/v1/clearances/${encodeURIComponent(id)}/approve`);
  }

  async denyClearance(id: string, reason?: string): Promise<ClearanceResponse> {
    return this.request<ClearanceResponse>("POST", `/v1/clearances/${encodeURIComponent(id)}/deny`, { reason });
  }

  async verifyToken(token: string): Promise<VerifyTokenResponse> {
    return this.request<VerifyTokenResponse>("GET", `/v1/verify/${encodeURIComponent(token)}`);
  }

  async createKey(data: KeyCreateRequest): Promise<KeyCreateResponse> {
    return this.request<KeyCreateResponse>("POST", "/v1/keys", data);
  }

  async getUsage(): Promise<UsageResponse> {
    return this.request<UsageResponse>("GET", "/v1/usage");
  }
}
