import type { ClearanceApi } from "./client.js";
import type {
  ClearanceListParams,
  ClearanceRequest,
  ClearanceResponse,
  DecideResponse,
  KeyCreateRequest,
  KeyCreateResponse,
  RevokeResponse,
  UsageResponse,
  VerifyTokenResponse,
} from "./types.js";

/**
 * In-memory Clearance stand-in for local MCP clients while the hosted API is
 * unavailable. Responses never leave the process. Tokens use an `offline.`
 * prefix so they cannot be mistaken for API-signed JWTs.
 */
export class OfflineClearanceClient implements ClearanceApi {
  private records: ClearanceResponse[] = [];
  private nextId = 1;

  async createClearance(data: ClearanceRequest): Promise<ClearanceResponse> {
    const id = `clr_offline_${this.nextId++}`;
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + (data.expires_in ?? 3600) * 1000);
    const row: ClearanceResponse = {
      id,
      status: "pending",
      title: data.title,
      description: data.description ?? null,
      scope: data.scope,
      budget_amount: data.budget_amount ?? null,
      budget_currency: data.budget_currency ?? null,
      approval_url: `offline://approve/${id}`,
      token: null,
      callback_url: data.callback_url ?? null,
      metadata: data.metadata ?? null,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      decided_at: null,
    };
    this.records.unshift(row);
    return { ...row };
  }

  async getClearance(id: string): Promise<ClearanceResponse> {
    return { ...this.find(id) };
  }

  async listClearances(params?: ClearanceListParams): Promise<ClearanceResponse[]> {
    let rows = this.records;
    if (params?.status) {
      rows = rows.filter((row) => row.status === params.status);
    }
    if (params?.limit !== undefined) {
      rows = rows.slice(0, params.limit);
    }
    return rows.map((row) => ({ ...row }));
  }

  async decideClearance(id: string, approved: boolean, _note?: string): Promise<DecideResponse> {
    const row = this.find(id);
    if (row.status !== "pending") {
      throw new Error(`Clearance API error 409: clearance ${id} is ${row.status}`);
    }
    const decidedAt = new Date().toISOString();
    const status = approved ? "approved" : "denied";
    const token = approved ? `offline.${id}` : null;
    row.status = status;
    row.decided_at = decidedAt;
    row.token = token;
    return {
      id: row.id,
      status,
      decided_at: decidedAt,
      token,
    };
  }

  async approveClearance(id: string, note?: string): Promise<DecideResponse> {
    return this.decideClearance(id, true, note);
  }

  async denyClearance(id: string, note?: string): Promise<DecideResponse> {
    return this.decideClearance(id, false, note);
  }

  async revokeClearance(id: string): Promise<RevokeResponse> {
    const row = this.find(id);
    if (row.status !== "approved") {
      throw new Error("Clearance API error 409: only an approved clearance can be revoked");
    }
    row.status = "revoked";
    return { id: row.id, status: "revoked" };
  }

  async verifyToken(token: string): Promise<VerifyTokenResponse> {
    const row = this.records.find((item) => item.token === token);
    if (!row || row.status !== "approved") {
      return {
        valid: false,
        error: row?.status === "revoked" ? "revoked" : "invalid token",
      };
    }
    return {
      valid: true,
      clearance_id: row.id,
      scope: row.scope,
      budget_amount: row.budget_amount,
      budget_currency: row.budget_currency,
      approved_at: row.decided_at,
      expires_at: row.expires_at,
    };
  }

  async createKey(_data: KeyCreateRequest): Promise<KeyCreateResponse> {
    return {
      api_key: `clr_offline_${this.nextId++}`,
      tier: "starter",
      credits_remaining: 50,
      message: "Offline mode key. It is not registered with the Clearance API.",
    };
  }

  async getUsage(): Promise<UsageResponse> {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const used = this.records.length;
    return {
      tier: "starter",
      credits_used: used,
      credits_remaining: Math.max(0, 50 - used),
      clearances_this_month: used,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    };
  }

  private find(id: string): ClearanceResponse {
    const row = this.records.find((item) => item.id === id);
    if (!row) {
      throw new Error(`Clearance API error 404: {"detail":"Not Found"}`);
    }
    return row;
  }
}
