import { DEFAULT_API_URL } from "./config.js";
import type {
  ClearanceListParams,
  ClearanceRequest,
  ClearanceResponse,
  DecideRequest,
  DecideResponse,
  KeyCreateRequest,
  KeyCreateResponse,
  RevokeResponse,
  UsageResponse,
  VerifyTokenResponse,
} from "./types.js";

/** Methods the MCP tools call. Live and offline clients both implement this. */
export interface ClearanceApi {
  createClearance(data: ClearanceRequest): Promise<ClearanceResponse>;
  getClearance(id: string): Promise<ClearanceResponse>;
  listClearances(params?: ClearanceListParams): Promise<ClearanceResponse[]>;
  decideClearance(id: string, approved: boolean, note?: string): Promise<DecideResponse>;
  approveClearance(id: string, note?: string): Promise<DecideResponse>;
  denyClearance(id: string, note?: string): Promise<DecideResponse>;
  revokeClearance(id: string): Promise<RevokeResponse>;
  verifyToken(token: string): Promise<VerifyTokenResponse>;
  createKey(data: KeyCreateRequest): Promise<KeyCreateResponse>;
  getUsage(): Promise<UsageResponse>;
}

export class ClearanceClient implements ClearanceApi {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey: string, baseUrl = DEFAULT_API_URL, timeoutMs = 10000) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = timeoutMs;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
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
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Clearance API error ${response.status}: ${text || response.statusText}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async createClearance(data: ClearanceRequest): Promise<ClearanceResponse> {
    return this.request<ClearanceResponse>("POST", "/v1/clearances", data);
  }

  async getClearance(id: string): Promise<ClearanceResponse> {
    return this.request<ClearanceResponse>("GET", `/v1/clearances/${encodeURIComponent(id)}`);
  }

  async listClearances(params?: ClearanceListParams): Promise<ClearanceResponse[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<ClearanceResponse[]>("GET", `/v1/clearances${qs ? `?${qs}` : ""}`);
  }

  /**
   * Approve or deny a pending clearance.
   * The API exposes POST /v1/clearances/{id}/decide, not /approve or /deny.
   */
  async decideClearance(id: string, approved: boolean, note?: string): Promise<DecideResponse> {
    const body: DecideRequest = note !== undefined ? { approved, note } : { approved };
    return this.request<DecideResponse>(
      "POST",
      `/v1/clearances/${encodeURIComponent(id)}/decide`,
      body
    );
  }

  async approveClearance(id: string, note?: string): Promise<DecideResponse> {
    return this.decideClearance(id, true, note);
  }

  async denyClearance(id: string, note?: string): Promise<DecideResponse> {
    return this.decideClearance(id, false, note);
  }

  async revokeClearance(id: string): Promise<RevokeResponse> {
    return this.request<RevokeResponse>("POST", `/v1/clearances/${encodeURIComponent(id)}/revoke`);
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
