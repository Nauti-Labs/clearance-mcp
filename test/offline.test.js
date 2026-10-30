import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OfflineClearanceClient } from "../dist/offline.js";
import { handleToolCall } from "../dist/tools.js";

function client() {
  return new OfflineClearanceClient();
}

describe("offline mode", () => {
  it("creates, lists, approves, and verifies without the network", async () => {
    const api = client();
    const created = await handleToolCall(api, "clearances_create", {
      title: "Book flight",
      scope: "purchase:flight",
      budget_amount: 500,
      budget_currency: "USD",
    });
    assert.equal(created.isError, undefined);
    const clearance = JSON.parse(created.content[0].text);
    assert.equal(clearance.status, "pending");
    assert.match(clearance.id, /^clr_offline_/);
    assert.match(clearance.approval_url, /^offline:\/\/approve\//);

    const listed = await handleToolCall(api, "clearances_list", { status: "pending" });
    assert.equal(JSON.parse(listed.content[0].text)[0].id, clearance.id);

    const approved = await handleToolCall(api, "clearances_approve", {
      id: clearance.id,
      note: "ok",
    });
    const decision = JSON.parse(approved.content[0].text);
    assert.equal(decision.status, "approved");
    assert.equal(decision.token, `offline.${clearance.id}`);

    const verified = await handleToolCall(api, "verify_token", { token: decision.token });
    const check = JSON.parse(verified.content[0].text);
    assert.equal(check.valid, true);
    assert.equal(check.clearance_id, clearance.id);
    assert.equal(check.scope, "purchase:flight");
  });

  it("denies, then refuses a second decision", async () => {
    const api = client();
    const created = JSON.parse(
      (await handleToolCall(api, "clearances_create", { title: "Wire", scope: "transfer:usdc" })).content[0].text
    );
    const denied = JSON.parse(
      (await handleToolCall(api, "clearances_deny", { id: created.id, reason: "no" })).content[0].text
    );
    assert.equal(denied.status, "denied");
    assert.equal(denied.token, null);

    const again = await handleToolCall(api, "clearances_approve", { id: created.id });
    assert.equal(again.isError, true);
    assert.match(again.content[0].text, /409/);
  });

  it("revokes an approved token", async () => {
    const api = client();
    const created = JSON.parse(
      (await handleToolCall(api, "clearances_create", { title: "Send", scope: "send:email" })).content[0].text
    );
    const approved = JSON.parse(
      (await handleToolCall(api, "clearances_approve", { id: created.id })).content[0].text
    );
    const revoked = JSON.parse(
      (await handleToolCall(api, "clearances_revoke", { id: created.id })).content[0].text
    );
    assert.equal(revoked.status, "revoked");
    const verified = JSON.parse(
      (await handleToolCall(api, "verify_token", { token: approved.token })).content[0].text
    );
    assert.equal(verified.valid, false);
    assert.equal(verified.error, "revoked");
  });

  it("reports starter usage and an unregistered key", async () => {
    const api = client();
    await handleToolCall(api, "clearances_create", { title: "One", scope: "demo" });
    const usage = JSON.parse((await handleToolCall(api, "usage_get", {})).content[0].text);
    assert.equal(usage.tier, "starter");
    assert.equal(usage.credits_used, 1);
    assert.equal(usage.clearances_this_month, 1);

    const key = JSON.parse(
      (await handleToolCall(api, "keys_create", { email: "ada@example.com", name: "Ada" })).content[0].text
    );
    assert.match(key.api_key, /^clr_offline_/);
    assert.match(key.message, /not registered/i);
  });
});
