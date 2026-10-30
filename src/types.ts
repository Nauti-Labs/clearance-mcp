// Types for the Clearance HTTP API.
// The default origin is https://clearance.nauti-labs.com; override it with CLEARANCE_API_URL.

export type ClearanceStatus = "pending" | "approved" | "denied" | "expired" | "revoked";

export type Tier = "starter" | "pro" | "scale";

export interface ClearanceRequest {
  title: string;
  scope: string;
  description?: string;
  budget_amount?: number;
  budget_currency?: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
  expires_in?: number;
}

export interface ClearanceResponse {
  id: string;
  status: ClearanceStatus;
  title: string;
  description: string | null;
  scope: string;
  budget_amount: number | null;
  budget_currency: string | null;
  approval_url: string;
  token?: string | null;
  callback_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  expires_at: string;
  decided_at: string | null;
}

export interface DecideRequest {
  approved: boolean;
  note?: string;
}

export interface DecideResponse {
  id: string;
  status: "approved" | "denied";
  decided_at: string;
  token: string | null;
}

export interface RevokeResponse {
  id: string;
  status: "revoked";
}

export interface VerifyTokenResponse {
  valid: boolean;
  clearance_id?: string | null;
  scope?: string | null;
  budget_amount?: number | null;
  budget_currency?: string | null;
  approved_at?: string | null;
  expires_at?: string | null;
  error?: string | null;
}

export interface KeyCreateRequest {
  email: string;
  name?: string;
}

export interface KeyCreateResponse {
  api_key: string;
  tier: Tier;
  credits_remaining: number;
  message: string;
}

export interface UsageResponse {
  tier: Tier;
  credits_used: number;
  credits_remaining: number;
  clearances_this_month: number;
  period_start: string;
  period_end: string;
}

export interface ClearanceListParams {
  status?: string;
  limit?: number;
}
