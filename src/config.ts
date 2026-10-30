/** Default Clearance API origin. Override with CLEARANCE_API_URL. */
export const DEFAULT_API_URL = "https://clearance.nauti-labs.com";

function nonempty(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Origin (or path prefix) for live Clearance API requests.
 *
 * CLEARANCE_API_URL is the supported name. CLEARANCE_BASE_URL is still read
 * when CLEARANCE_API_URL is unset, so older configs keep working.
 * A trailing slash is removed so route paths join cleanly.
 */
export function resolveApiUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = nonempty(env.CLEARANCE_API_URL) ?? nonempty(env.CLEARANCE_BASE_URL);
  const base = (configured ?? DEFAULT_API_URL).replace(/\/+$/, "");

  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error(`Clearance API URL must be an absolute URL. Received: ${base}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Clearance API URL must use http or https. Received: ${base}`);
  }
  return base;
}

/** In-memory mode. Accepts 1, true, and yes, in any case. */
export function isOfflineMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = nonempty(env.CLEARANCE_OFFLINE)?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
