import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { ClearanceClient } from "../dist/client.js";
import { TOOLS, handleToolCall } from "../dist/tools.js";

const BASE_URL = "https://clearance.test";
const API_KEY = "clr_live_test";

/** @type {Array<{ url: string, method: string, headers: Record<string, string>, body: string | undefined }>} */
let calls = [];
const originalFetch = globalThis.fetch;

function installFetch(status, payload) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({
      url: String(url),
      method: String(init?.method),
      headers: /** @type {Record<string, string>} */ (init?.headers ?? {}),
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    const text = typeof payload === "string" ? payload : JSON.stringify(payload);
    return new Response(text, {
      status,
      headers: { "content-type": "application/json" },
    });
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function client() {
  return new ClearanceClient(API_KEY, `${BASE_URL}/`);
}

function lastCall() {
  assert.equal(calls.length, 1);
  return calls[0];
}

describe("tool catalog", () => {
  it("exposes every Clearance tool the server implements", () => {
    assert.deepEqual(
      TOOLS.map((tool) => tool.name),
      [
        "clearances_create",
        "clearances_get",
        "clearances_list",
        "clearances_approve",
        "clearances_deny",
        "clearances_revoke",
        "verify_token",
        "keys_create",
        "usage_get",
      ]
    );
  });
});

describe("clearance tools", () => {
  it("creates a clearance with the live request fields", async () => {
    const created = {
      id: "clr_1",
      status: "pending",
      title: "Book flight",
      description: "Austin",
      scope: "purchase:flight",
      budget_amount: 450,
      budget_currency: "USD",
      approval_url: "https://clearance.nauti-labs.com/approve/clr_1",
      callback_url: "https://example.com/hook",
      metadata: { trip: "AUS" },
      created_at: "2026-10-19T00:00:00Z",
      expires_at: "2026-10-19T02:00:00Z",
      decided_at: null,
    };
    installFetch(201, created);

    const result = await handleToolCall(client(), "clearances_create", {
      title: "Book flight",
      description: "Austin",
      scope: "purchase:flight",
      budget_amount: 450,
      budget_currency: "USD",
      callback_url: "https://example.com/hook",
      metadata: { trip: "AUS" },
      expires_in: 7200,
    });

    const call = lastCall();
    assert.equal(call.method, "POST");
    assert.equal(call.url, `${BASE_URL}/v1/clearances`);
    assert.equal(call.headers["X-API-Key"], API_KEY);
    assert.deepEqual(JSON.parse(call.body), {
      title: "Book flight",
      scope: "purchase:flight",
      description: "Austin",
      budget_amount: 450,
      budget_currency: "USD",
      callback_url: "https://example.com/hook",
      metadata: { trip: "AUS" },
      expires_in: 7200,
    });
    assert.equal(result.isError, undefined);
    assert.equal(result.content[0].text, JSON.stringify(created, null, 2));
  });

  it("maps webhook_url onto callback_url", async () => {
    installFetch(201, { id: "clr_1" });
    await handleToolCall(client(), "clearances_create", {
      title: "Send email",
      scope: "send:email",
      webhook_url: "https://example.com/hook",
    });
    assert.deepEqual(JSON.parse(lastCall().body), {
      title: "Send email",
      scope: "send:email",
      callback_url: "https://example.com/hook",
    });
  });

  it("rejects create when scope is missing and does not call the API", async () => {
    installFetch(201, {});
    const result = await handleToolCall(client(), "clearances_create", { title: "Book flight" });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /"scope" is required/);
    assert.equal(calls.length, 0);
  });

  it("gets a clearance by encoded id", async () => {
    installFetch(200, { id: "clr/1", status: "pending" });
    await handleToolCall(client(), "clearances_get", { id: "clr/1" });
    const call = lastCall();
    assert.equal(call.method, "GET");
    assert.equal(call.url, `${BASE_URL}/v1/clearances/${encodeURIComponent("clr/1")}`);
    assert.equal(call.body, undefined);
  });

  it("lists clearances with status and limit and returns the API array", async () => {
    const rows = [{ id: "clr_1", status: "pending" }];
    installFetch(200, rows);
    const result = await handleToolCall(client(), "clearances_list", {
      status: "pending",
      limit: 10,
      offset: 20,
    });
    const call = lastCall();
    assert.equal(call.method, "GET");
    assert.equal(call.url, `${BASE_URL}/v1/clearances?status=pending&limit=10`);
    assert.deepEqual(JSON.parse(result.content[0].text), rows);
  });

  it("lists clearances with no query when filters are omitted", async () => {
    installFetch(200, []);
    await handleToolCall(client(), "clearances_list", {});
    assert.equal(lastCall().url, `${BASE_URL}/v1/clearances`);
  });

  it("approves through POST /decide with approved true", async () => {
    const decided = {
      id: "clr_1",
      status: "approved",
      decided_at: "2026-10-19T01:00:00Z",
      token: "eyJ.token",
    };
    installFetch(200, decided);
    const result = await handleToolCall(client(), "clearances_approve", {
      id: "clr_1",
      note: "looks good",
    });
    const call = lastCall();
    assert.equal(call.method, "POST");
    assert.equal(call.url, `${BASE_URL}/v1/clearances/clr_1/decide`);
    assert.equal(call.url.endsWith("/approve"), false);
    assert.deepEqual(JSON.parse(call.body), { approved: true, note: "looks good" });
    assert.equal(result.content[0].text, JSON.stringify(decided, null, 2));
  });

  it("omits note when approving without one", async () => {
    installFetch(200, { id: "clr_1", status: "approved", token: "eyJ" });
    await handleToolCall(client(), "clearances_approve", { id: "clr_1" });
    assert.equal(lastCall().body, JSON.stringify({ approved: true }));
  });

  it("denies through POST /decide with approved false", async () => {
    installFetch(200, { id: "clr_1", status: "denied", decided_at: "2026-10-19T01:00:00Z", token: null });
    await handleToolCall(client(), "clearances_deny", { id: "clr_1", note: "too expensive" });
    const call = lastCall();
    assert.equal(call.url, `${BASE_URL}/v1/clearances/clr_1/decide`);
    assert.equal(call.url.endsWith("/deny"), false);
    assert.deepEqual(JSON.parse(call.body), { approved: false, note: "too expensive" });
  });

  it("accepts reason as an alias for the decision note", async () => {
    installFetch(200, { id: "clr_1", status: "denied", token: null });
    await handleToolCall(client(), "clearances_deny", { id: "clr_1", reason: "out of policy" });
    assert.deepEqual(JSON.parse(lastCall().body), { approved: false, note: "out of policy" });
  });

  it("revokes an approved clearance", async () => {
    installFetch(200, { id: "clr_1", status: "revoked" });
    const result = await handleToolCall(client(), "clearances_revoke", { id: "clr_1" });
    const call = lastCall();
    assert.equal(call.method, "POST");
    assert.equal(call.url, `${BASE_URL}/v1/clearances/clr_1/revoke`);
    assert.equal(call.body, undefined);
    assert.deepEqual(JSON.parse(result.content[0].text), { id: "clr_1", status: "revoked" });
  });

  it("verifies a token on the public verify route", async () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.payload/with+chars";
    const verified = {
      valid: true,
      clearance_id: "clr_1",
      scope: "purchase:flight",
      budget_amount: 450,
      budget_currency: "USD",
      approved_at: "2026-10-19T01:00:00Z",
      expires_at: "2026-10-19T02:00:00Z",
    };
    installFetch(200, verified);
    const result = await handleToolCall(client(), "verify_token", { token });
    const call = lastCall();
    assert.equal(call.method, "GET");
    assert.equal(call.url, `${BASE_URL}/v1/verify/${encodeURIComponent(token)}`);
    assert.equal(result.content[0].text, JSON.stringify(verified, null, 2));
  });

  it("creates a starter key with email and name, ignoring tier", async () => {
    const created = {
      api_key: "clr_live_new",
      tier: "starter",
      credits_remaining: 50,
      message: "Store this key securely — it won't be shown again.",
    };
    installFetch(200, created);
    const result = await handleToolCall(client(), "keys_create", {
      email: "ada@example.com",
      name: "Ada",
      tier: "scale",
    });
    const call = lastCall();
    assert.equal(call.method, "POST");
    assert.equal(call.url, `${BASE_URL}/v1/keys`);
    assert.deepEqual(JSON.parse(call.body), { email: "ada@example.com", name: "Ada" });
    assert.equal(result.content[0].text, JSON.stringify(created, null, 2));
  });

  it("requires email when creating a key", async () => {
    installFetch(200, {});
    const result = await handleToolCall(client(), "keys_create", { name: "Ada" });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /"email" is required/);
    assert.equal(calls.length, 0);
  });

  it("reads usage from GET /v1/usage", async () => {
    const usage = {
      tier: "starter",
      credits_used: 3,
      credits_remaining: 47,
      clearances_this_month: 3,
      period_start: "2026-09-19T00:00:00Z",
      period_end: "2026-10-19T00:00:00Z",
    };
    installFetch(200, usage);
    const result = await handleToolCall(client(), "usage_get", {});
    const call = lastCall();
    assert.equal(call.method, "GET");
    assert.equal(call.url, `${BASE_URL}/v1/usage`);
    assert.equal(call.body, undefined);
    assert.equal(result.content[0].text, JSON.stringify(usage, null, 2));
  });

  it("returns an MCP error when the API responds with an error", async () => {
    installFetch(404, { detail: "Not Found" });
    const result = await handleToolCall(client(), "clearances_approve", { id: "clr_missing" });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Clearance API error 404/);
    assert.match(result.content[0].text, /Not Found/);
    assert.equal(lastCall().url, `${BASE_URL}/v1/clearances/clr_missing/decide`);
  });

  it("returns an MCP error for an unknown tool", async () => {
    installFetch(200, {});
    const result = await handleToolCall(client(), "clearances_approve_now", { id: "clr_1" });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Unknown tool: clearances_approve_now/);
    assert.equal(calls.length, 0);
  });
});
