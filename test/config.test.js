import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_API_URL, isOfflineMode, resolveApiUrl } from "../dist/config.js";

describe("resolveApiUrl", () => {
  it("defaults to the hosted Clearance API", () => {
    assert.equal(DEFAULT_API_URL, "https://clearance.nauti-labs.com");
    assert.equal(resolveApiUrl({}), DEFAULT_API_URL);
  });

  it("uses CLEARANCE_API_URL and strips trailing slashes", () => {
    assert.equal(
      resolveApiUrl({ CLEARANCE_API_URL: "https://clearance.example/api/" }),
      "https://clearance.example/api"
    );
  });

  it("falls back to CLEARANCE_BASE_URL when CLEARANCE_API_URL is unset", () => {
    assert.equal(
      resolveApiUrl({ CLEARANCE_BASE_URL: "http://127.0.0.1:8787/" }),
      "http://127.0.0.1:8787"
    );
  });

  it("prefers CLEARANCE_API_URL when both names are set", () => {
    assert.equal(
      resolveApiUrl({
        CLEARANCE_API_URL: "https://primary.example",
        CLEARANCE_BASE_URL: "https://legacy.example",
      }),
      "https://primary.example"
    );
  });

  it("ignores blank values", () => {
    assert.equal(
      resolveApiUrl({ CLEARANCE_API_URL: "  ", CLEARANCE_BASE_URL: "" }),
      DEFAULT_API_URL
    );
  });

  it("rejects a URL that is not absolute http(s)", () => {
    assert.throws(() => resolveApiUrl({ CLEARANCE_API_URL: "clearance.example" }), /absolute URL/);
    assert.throws(() => resolveApiUrl({ CLEARANCE_API_URL: "ftp://files.example" }), /http or https/);
  });
});

describe("isOfflineMode", () => {
  it("accepts 1, true, and yes in any case", () => {
    assert.equal(isOfflineMode({}), false);
    assert.equal(isOfflineMode({ CLEARANCE_OFFLINE: "0" }), false);
    assert.equal(isOfflineMode({ CLEARANCE_OFFLINE: "false" }), false);
    assert.equal(isOfflineMode({ CLEARANCE_OFFLINE: "1" }), true);
    assert.equal(isOfflineMode({ CLEARANCE_OFFLINE: " TRUE " }), true);
    assert.equal(isOfflineMode({ CLEARANCE_OFFLINE: "yes" }), true);
  });
});
