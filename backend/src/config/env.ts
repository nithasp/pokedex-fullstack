import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parseCorsOrigin(raw: string | undefined): "*" | string[] {
  const value = (raw ?? "*").trim();
  if (value === "" || value === "*") return "*";
  return value
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

// Note the fail-silent branch: an unparseable value returns 0, which disables
// the keep-alive job rather than falling back to `fallback`.
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
  r2PublicUrl: (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, ""),
  imageExtension: (process.env.IMAGE_EXTENSION ?? "webp").replace(/^\.+/, ""),
  keepAliveIntervalHours: parseKeepAliveHours(process.env.KEEP_ALIVE_INTERVAL_HOURS, 12),
} as const;
