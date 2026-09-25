import type { CorsOptions } from "cors";

/**
 * Build the `origin` option for the `cors` middleware.
 *
 * Requests without an `Origin` header (curl, server-to-server, same-origin)
 * are always allowed — that branch is intentional, not a missing check.
 */
export function buildCorsOriginHandler(
  corsOrigin: "*" | string | string[]
): CorsOptions["origin"] {
  if (corsOrigin === "*") return "*";

  const allowList = (Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin]).map((o) =>
    o.replace(/\/$/, "")
  );

  return (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, "");
    if (allowList.includes(normalized)) return callback(null, true);
    console.warn(`[cors] Blocked origin: ${origin}. Allowed: ${allowList.join(", ")}`);
    callback(new Error(`Not allowed by CORS: ${origin}`));
  };
}
