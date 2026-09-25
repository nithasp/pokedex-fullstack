import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Parse a comma-separated `CORS_ORIGIN` env value into a normalized allowlist.
 * Returns `"*"` for full wildcard mode (empty or literal `*`), otherwise an
 * array with trailing slashes stripped and entries trimmed.
 */
function parseCorsOrigin(raw: string | undefined): "*" | string[] {
  const value = (raw ?? "*").trim();
  if (value === "" || value === "*") return "*";
  return value
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

/**
 * Parse `KEEP_ALIVE_INTERVAL_HOURS` into a positive number of hours.
 * `0`, a negative value, or anything unparseable disables the keep-alive job.
 */
function parseKeepAliveHours(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  mongoUri: required("MONGO_URI"),
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  // Public base URL for Cloudflare R2 bucket (no trailing slash)
  // e.g. https://pub-XXXX.r2.dev  or  https://images.yourdomain.com
  r2PublicUrl: (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, ""),
  // File extension of pokemon images in the R2 bucket. Defaults to `webp`.
  // Switch all images to a new format → just change this (and re-upload).
  imageExtension: (process.env.IMAGE_EXTENSION ?? "webp").replace(/^\.+/, ""),
  // How often the server touches MongoDB on its own to keep an Atlas free-tier
  // (M0) cluster out of the "60 days idle → auto-pause" bucket.
  // Set to 0 to turn the job off. See `config/keep-alive.ts`.
  keepAliveIntervalHours: parseKeepAliveHours(process.env.KEEP_ALIVE_INTERVAL_HOURS, 12),
} as const;
