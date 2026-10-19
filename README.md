# clearance-mcp

> Model Context Protocol server for [Clearance](https://clearance.nauti-labs.com) — the human approval API for AI agent commerce.

Stop letting agents move money you didn't approve. One API call. The human approves with one tap. Any service verifies the signed token.

---

## What This Is

An MCP server that exposes Clearance as a set of tools Claude (and other MCP-compatible clients) can call natively. Your AI agent can:

- Request human approval before spending money
- Check approval status
- Approve, deny, or revoke a clearance
- Verify signed tokens
- Manage API keys and usage

---

## Installation

### Via npm (recommended)

```bash
npm install -g clearance-mcp
```

Or run directly via npx:

```bash
npx -y clearance-mcp
```

### Via GitHub (if npm not available)

```bash
npx -y github:Nauti-Labs/clearance-mcp
```

---

## Configuration

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "clearance": {
      "command": "npx",
      "args": ["-y", "clearance-mcp"],
      "env": {
        "CLEARANCE_API_KEY": "clr_live_..."
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLEARANCE_API_KEY` | ✅ | Your Clearance API key (get free at clearance.nauti-labs.com) |
| `CLEARANCE_BASE_URL` | ❌ | Override API base URL (default: https://clearance.nauti-labs.com) |

---

## Available Tools

| Tool | Clearance API | Description |
|------|---------------|-------------|
| `clearances_create` | `POST /v1/clearances` | Create a human approval request. Requires `title` and `scope`. |
| `clearances_get` | `GET /v1/clearances/{id}` | Get one clearance by ID |
| `clearances_list` | `GET /v1/clearances` | List clearances. Optional `status` and `limit` (API default 50). |
| `clearances_approve` | `POST /v1/clearances/{id}/decide` | Approve a pending clearance (`approved: true`) |
| `clearances_deny` | `POST /v1/clearances/{id}/decide` | Deny a pending clearance (`approved: false`) |
| `clearances_revoke` | `POST /v1/clearances/{id}/revoke` | Revoke an approved clearance so its token no longer verifies |
| `verify_token` | `GET /v1/verify/{token}` | Verify a signed approval token |
| `keys_create` | `POST /v1/keys` | Create a Starter API key. Requires `email`. |
| `usage_get` | `GET /v1/usage` | Check credits used, credits remaining, and the current period |

### Request fields

`clearances_create` sends `title`, `scope`, and any of `description`, `budget_amount`, `budget_currency`, `callback_url`, `metadata`, and `expires_in` (seconds, API default 3600). The response link for the human is `approval_url`. `webhook_url` is accepted and sent as `callback_url`.

`clearances_list` returns a JSON array. Status filters are `pending`, `approved`, `denied`, `expired`, and `revoked`. Pagination is `limit` only.

`clearances_approve` and `clearances_deny` both call `/decide`. Body is `{ "approved": true|false, "note"?: string }`. `reason` is accepted as an alias of `note`.

`keys_create` sends `{ "email", "name"? }`. New keys are always the free Starter tier. The response field for the secret is `api_key`.

`usage_get` returns `tier`, `credits_used`, `credits_remaining`, `clearances_this_month`, `period_start`, and `period_end`.

---

## Example Usage

In Claude, after the MCP server is connected:

> **You:** "I want to book a $500 flight. Can you ask for approval first?"
>
> **Claude:** *calls `clearances_create` with title="Book flight to Austin", scope="purchase:flight", budget_amount=500*
>
> **Claude:** "I've created an approval request. Open the `approval_url` to approve or deny: [Approve](https://clearance.nauti-labs.com/approve/clr_abc123). Once you approve, I'll proceed with the booking."

---

## Pricing

Clearance pricing:

- **Starter** — Free, 50 clearances/month
- **Pro** — $19/mo, 1,000 clearances/month
- **Scale** — $49/mo, 10,000 clearances/month

Get your free key at [clearance.nauti-labs.com](https://clearance.nauti-labs.com).

---

## Links

- **Product:** [clearance.nauti-labs.com](https://clearance.nauti-labs.com)
- **Company:** [nauti-labs.com](https://nauti-labs.com)
- **API Docs:** [clearance.nauti-labs.com/v1/docs](https://clearance.nauti-labs.com/v1/docs)

---

Built by [Nauti-Labs LLC](https://nauti-labs.com) · Mont Belvieu, TX
