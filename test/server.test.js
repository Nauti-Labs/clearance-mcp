import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

function childEnv(overrides) {
  const env = { ...process.env };
  for (const key of ["CLEARANCE_API_KEY", "CLEARANCE_API_URL", "CLEARANCE_BASE_URL", "CLEARANCE_OFFLINE"]) {
    delete env[key];
  }
  return { ...env, ...overrides };
}

function startServer(overrides, stdio = ["ignore", "ignore", "pipe"]) {
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: root,
    env: childEnv(overrides),
    stdio,
  });
  let stderr = "";
  let stdout = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  if (stdio[1] === "pipe") {
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
  }
  return {
    child,
    output: () => stderr,
    stdout: () => stdout,
    messages() {
      return stdout
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => JSON.parse(line));
    },
    send(message) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    },
    stop() {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
      }
    },
  };
}

function waitFor(server, predicate, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`timed out\nstderr:\n${server.output()}\nstdout:\n${server.stdout()}`));
    }, timeoutMs);
    const check = () => {
      try {
        if (predicate()) {
          clearTimeout(timer);
          resolve();
        }
      } catch {
        // stdout may contain a partial line
      }
    };
    server.child.stderr.on("data", check);
    if (server.child.stdout) server.child.stdout.on("data", check);
    server.child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error(`exited before ready\nstderr:\n${server.output()}\nstdout:\n${server.stdout()}`));
    });
    check();
  });
}

async function raceExit(child, output, timeoutMs = 4000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`server timed out\n${output()}`)), timeoutMs);
  });
  try {
    return await Promise.race([once(child, "exit"), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

describe("server process", () => {
  it("exits when live mode has no API key", async () => {
    const server = startServer({});
    try {
      const [code] = await raceExit(server.child, server.output);
      assert.equal(code, 1);
      assert.match(server.output(), /CLEARANCE_API_KEY/);
    } finally {
      server.stop();
    }
  });

  it("exits when CLEARANCE_API_URL is not an absolute URL", async () => {
    const server = startServer({
      CLEARANCE_API_KEY: "clr_live_test",
      CLEARANCE_API_URL: "clearance.example",
    });
    try {
      const [code] = await raceExit(server.child, server.output);
      assert.equal(code, 1);
      assert.match(server.output(), /absolute URL/);
    } finally {
      server.stop();
    }
  });

  it("starts in offline mode without an API key", async () => {
    const server = startServer({ CLEARANCE_OFFLINE: "1" });
    try {
      const started = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`startup timed out\n${server.output()}`)), 4000);
        server.child.stderr.on("data", () => {
          if (server.output().includes("offline mode")) {
            clearTimeout(timer);
            resolve();
          }
        });
        server.child.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`exited ${code} before ready\n${server.output()}`));
        });
      });
      assert.equal(started, undefined);
      assert.match(server.output(), /offline mode/);
    } finally {
      server.stop();
    }
  });

  it("logs the configured API origin in live mode", async () => {
    const server = startServer({
      CLEARANCE_API_KEY: "clr_live_test",
      CLEARANCE_API_URL: "https://clearance.example/api/",
    });
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`startup timed out\n${server.output()}`)), 4000);
        server.child.stderr.on("data", () => {
          if (server.output().includes("https://clearance.example/api")) {
            clearTimeout(timer);
            resolve();
          }
        });
        server.child.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`exited ${code} before ready\n${server.output()}`));
        });
      });
      assert.match(server.output(), /https:\/\/clearance\.example\/api\)/);
    } finally {
      server.stop();
    }
  });

  it("speaks MCP over stdio and calls a tool offline", async () => {
    const server = startServer({ CLEARANCE_OFFLINE: "1" }, ["pipe", "pipe", "pipe"]);
    try {
      await waitFor(server, () => server.output().includes("offline mode"));
      server.send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "clearance-mcp-test", version: "0.0.0" },
        },
      });
      await waitFor(server, () => server.messages().some((message) => message.id === 1));
      const initialized = server.messages().find((message) => message.id === 1);
      assert.equal(initialized.result.serverInfo.name, "clearance-mcp");
      assert.equal(initialized.result.serverInfo.version, version);

      server.send({ jsonrpc: "2.0", method: "notifications/initialized" });
      server.send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
      await waitFor(server, () => server.messages().some((message) => message.id === 2));
      const listed = server.messages().find((message) => message.id === 2);
      assert.deepEqual(
        listed.result.tools.map((tool) => tool.name),
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

      server.send({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "clearances_create",
          arguments: { title: "Book flight", scope: "purchase:flight" },
        },
      });
      await waitFor(server, () => server.messages().some((message) => message.id === 3));
      const called = server.messages().find((message) => message.id === 3);
      const body = JSON.parse(called.result.content[0].text);
      assert.equal(body.status, "pending");
      assert.equal(body.scope, "purchase:flight");
      assert.match(body.approval_url, /^offline:\/\/approve\//);
    } finally {
      server.stop();
    }
  });
});
