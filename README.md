# clearance-mcp

MCP server for Clearance, a human-approval API for AI agents. The agent asks for permission, a person approves or denies it, and other services can check the signed token before acting.

The server speaks [Model Context Protocol](https://modelcontextprotocol.io) over stdio and calls the Clearance HTTP API. It can create a clearance, read status, approve, deny, revoke, verify a token, create an API key, and read usage.

The hosted API at `https://clearance.nauti-labs.com` is coming back soon. Until that host answers again, set `CLEARANCE_API_URL` to a Clearance API you can reach, or set `CLEARANCE_OFFLINE=1` to exercise the tools in memory.

## Install

Node.js 18 or newer. Continuous integration runs on Node.js 22.

```bash
npm install -g clearance-mcp
```

Or run it without a global install:

```bash
npx -y clearance-mcp
```

From this repository, before the npm release is published:

```bash
npx -y github:Nauti-Labs/clearance-mcp
```

## MCP client configuration

The process reads the environment from the client that launches it. A live server needs `CLEARANCE_API_KEY`. Add `CLEARANCE_API_URL` when the default host is not the API you want.

### Claude Desktop

macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "clearance": {
      "command": "npx",
      "args": ["-y", "clearance-mcp"],
      "env": {
        "CLEARANCE_API_KEY": "clr_live_...",
        "CLEARANCE_API_URL": "https://clearance.nauti-labs.com"
      }
    }
  }
}
```

### Cursor

User config: `~/.cursor/mcp.json`. Project config: `.cursor/mcp.json`.

```json
{
  "mcpServers": {
    "clearance": {
      "command": "npx",
      "args": ["-y", "clearance-mcp"],
      "env": {
        "CLEARANCE_API_KEY": "clr_live_...",
        "CLEARANCE_API_URL": "https://clearance.nauti-labs.com"
      }
    }
  }
}
```

### Any stdio MCP client

```json
{
  "command": "npx",
  "args": ["-y", "clearance-mcp"],
  "env": {
    "CLEARANCE_API_KEY": "clr_live_...",
    "CLEARANCE_API_URL": "https://clearance.example"
  }
}
```

Offline smoke test, with no API key and no network:

```json
{
  "command": "npx",
  "args": ["-y", "clearance-mcp"],
  "env": {
    "CLEARANCE_OFFLINE": "1"
  }
}
```

Restart the client after changing the config. On startup the server logs the API origin it will call, or that it is in offline mode. Logs go to stderr so they stay off the MCP stdio stream.

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `CLEARANCE_API_KEY` | Yes for live mode | | API key sent as `X-API-Key`. |
| `CLEARANCE_API_URL` | No | `https://clearance.nauti-labs.com` | API origin or path prefix. Routes are appended, for example `/v1/clearances`. Do not include the `/v1` suffix. A trailing slash is ignored. |
| `CLEARANCE_BASE_URL` | No | | Older name for the same setting. Used only when `CLEARANCE_API_URL` is unset. |
| `CLEARANCE_OFFLINE` | No | off | `1`, `true`, or `yes` selects the in-memory client. No API key and no network calls. |

`CLEARANCE_API_URL` must be an absolute `http` or `https` URL. The server exits if live mode has no API key, or if the URL is not absolute.

The default host is the Clearance API, and it is coming back soon. Signup and docs pages on that host are unavailable for now. Point `CLEARANCE_API_URL` at a running API when you have one. `keys_create` can create a Starter key once that API is up: new keys are always the free Starter tier.

## Tools

| Tool | Clearance API | Description |
| --- | --- | --- |
| `clearances_create` | `POST /v1/clearances` | Create a human approval request. Requires `title` and `scope`. |
| `clearances_get` | `GET /v1/clearances/{id}` | Get one clearance by ID. |
| `clearances_list` | `GET /v1/clearances` | List clearances. Optional `status` and `limit` (API default 50). |
| `clearances_approve` | `POST /v1/clearances/{id}/decide` | Approve a pending clearance (`approved: true`). |
| `clearances_deny` | `POST /v1/clearances/{id}/decide` | Deny a pending clearance (`approved: false`). |
| `clearances_revoke` | `POST /v1/clearances/{id}/revoke` | Revoke an approved clearance so its token no longer verifies. |
| `verify_token` | `GET /v1/verify/{token}` | Verify a signed approval token. The API does not require authentication for this route. |
| `keys_create` | `POST /v1/keys` | Create a Starter API key. Requires `email`. The raw key is only shown once. |
| `usage_get` | `GET /v1/usage` | Read tier, credits used, credits remaining, and the current period. |

### Request fields

`clearances_create` sends `title`, `scope`, and any of `description`, `budget_amount`, `budget_currency`, `callback_url`, `metadata`, and `expires_in` (seconds, API default 3600, allowed range 60–604800). The link for the person is `approval_url`. `webhook_url` is accepted and sent as `callback_url`.

`clearances_list` returns a JSON array, newest first. Status filters are `pending`, `approved`, `denied`, `expired`, and `revoked`. Pagination is `limit` only.

`clearances_approve` and `clearances_deny` both call `/decide`. The body is `{ "approved": true|false, "note"?: string }`. `reason` is accepted as an alias of `note`.

`keys_create` sends `{ "email", "name"? }`. New keys are always the Starter tier. The secret in the response is `api_key`.

`usage_get` returns `tier`, `credits_used`, `credits_remaining`, `clearances_this_month`, `period_start`, and `period_end`.

Tool errors are returned as MCP tool results with `isError: true` and a text message, so the model can read the failure.

## Example

Ask the agent to request approval before it spends money:

> Book a $500 flight, and ask for approval first.

The client calls `clearances_create` with a title, scope `purchase:flight`, and `budget_amount` 500. The result includes `approval_url`. The person opens that URL on whatever API `CLEARANCE_API_URL` points at. After they decide, `clearances_get` returns the status and, when approved, a signed `token`. Another service checks that token with `verify_token`.

In offline mode, `approval_url` is an `offline://` URL and there is no browser page. Call `clearances_approve` or `clearances_deny` in the same process. Offline tokens start with `offline.` and are not signed by the Clearance API.

## Offline mode

`CLEARANCE_OFFLINE=1` keeps every clearance in memory for the life of the process:

- Create, list, get, approve, deny, revoke, and verify work against that store.
- `keys_create` returns a key that starts with `clr_offline_` and is not registered with the API.
- `usage_get` reports the Starter tier and counts only the in-memory clearances.
- Restarting the process drops the data.

Use it to confirm an MCP client is wired up. Use a real `CLEARANCE_API_URL` when a decision has to hold up outside the process.

## Development

```bash
npm ci
npm run build
npm test
```

Tests mock `fetch` and do not call the network. `npm test` runs the compiled `dist/` files, so build first. `prepublishOnly` builds before a publish.

## Publishing

npm currently has 1.0.0. Version 1.0.1 is the unpublished release that fixes approve and deny to call `POST /v1/clearances/{id}/decide`.

Publish by pushing a version tag. The workflow runs `npm publish` after the checks below:

1. The package owner adds an npm token as the GitHub Actions secret `NPM_TOKEN` (an automation token, or a granular token that can publish `clearance-mcp`). This repo does not create that secret.
2. `package.json` `version` is the version to release.
3. Push a matching tag, for example `v1.0.1`.
4. The Publish workflow checks that the tag matches `package.json`, runs the Node 22 build and tests, then runs `npm publish`.

The workflow fails with a short message when `NPM_TOKEN` is missing. Publishing still needs the package owner's npm account and their OK. CI on every push and pull request stays build and test on Node 22 and does not publish.

## License

MIT, © 2026 Nauti-Labs LLC. Issues and source: [github.com/Nauti-Labs/clearance-mcp](https://github.com/Nauti-Labs/clearance-mcp).
