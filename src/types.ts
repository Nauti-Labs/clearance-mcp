// Clearance API types

export interface ClearanceRequest {
  title: string;
  scope?: string;
  budget_amount?: number;
  budget_currency?: string;
  metadata?: Record<string, unknown>;
  webhook_url?: string;
}

export interface ClearanceResponse {
  id: string;
  title: string;
  scope: string | null;
  budget_amount: number | null;
  budget_currency: string | null;
  status: "pending" | "approved" | "denied" | "revoked";
  approve_url: string;
  deny_url: string;
  token: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  approved_at: string | null;
  denied_at: string | null;
  denied_reason: string | null;
}

export interface ClearanceListResponse {
  items: ClearanceResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface VerifyTokenResponse {
  valid: boolean;
  clearance_id: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface KeyCreateRequest {
  tier?: string;
  email?: string;
}

export interface KeyCreateResponse {
  key: string;
  tier: string;
  clearances_per_month: number;
  created_at: string;
}

export interface UsageResponse {
  tier: string;
  clearances_per_month: number;
  used_this_month: number;
  remaining_this_month: number;
  reset_date: string;
}

export interface ClearanceApproveRequest {
  id: string;
}

export interface ClearanceDenyRequest {
  id: string;
  reason?: string;
}

export interface ClearanceListRequest {
  status?: string;
  limit?: number;
  offset?: number;
}
