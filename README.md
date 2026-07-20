# @clearance/mcp

> Model Context Protocol server for [Clearance](https://clearance.nauti-labs.com) — the human approval API for AI agent commerce.

Stop letting agents move money you didn't approve. One API call. The human approves with one tap. Any service verifies the signed token.

---

## What This Is

An MCP server that exposes Clearance as a set of tools Claude (and other MCP-compatible clients) can call natively. Your AI agent can:

- Request human approval before spending money
- Check approval status
- Verify signed tokens
- Manage API keys and usage

---

## Installation

```bash
npm install -g @clearance/mcp
```

Or run directly via npx:

```bash
npx -y @clearance/mcp
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
      "args": ["-y", "@clearance/mcp"],
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

| Tool | Description |
|------|-------------|
| `clearances_create` | Create a new human approval request |
| `clearances_get` | Get a single clearance by ID |
| `clearances_list` | List all clearances with optional filtering |
| `clearances_approve` | Approve a pending clearance |
| `clearances_deny` | Deny a pending clearance |
| `verify_token` | Verify a signed approval token |
| `keys_create` | Create a new API key |
| `usage_get` | Check current usage and limits |

---

## Example Usage

In Claude, after the MCP server is connected:

> **You:** "I want to book a $500 flight. Can you ask for approval first?"
>
> **Claude:** *calls `clearances_create` with title="Book flight to Austin", budget_amount=500*
>
> **Claude:** "I've created an approval request. Here's the link: [Approve](https://clearance.nauti-labs.com/approve/clr_abc123). Once you approve, I'll proceed with the booking."

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
