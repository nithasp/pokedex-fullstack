import { pingDB } from "./db";
import { config } from "./env";

const HOUR_MS = 60 * 60 * 1000;

let timer: NodeJS.Timeout | undefined;

async function touch(reason: string): Promise<void> {
  try {
    const ms = await pingDB();
    console.log(`[keep-alive] ${reason} — DB read ok in ${ms}ms`);
  } catch (err) {
    // Never throw: a failed keep-alive must not take the server down. If the
    // cluster really is unreachable, the health endpoint surfaces it as a 503.
    console.error(`[keep-alive] ${reason} — DB read failed:`, err);
  }
}

/**
 * Keep an Atlas free-tier (M0) cluster from hitting its "60 days idle →
 * auto-pause" rule by issuing a real read on a fixed interval.
 *
 * Two deliberate choices:
 *
 * 1. It fires once immediately at boot, not only after the first interval.
 *    `setInterval` restarts from zero on every redeploy/crash-restart, so a
 *    long interval on a service that redeploys often would otherwise almost
 *    never fire.
 * 2. The timer is `unref`'d, so it never holds the process open during
 *    shutdown.
 *
 * This covers the cluster for as long as the server itself is running. It
 * cannot help while the server is stopped — for that, point an external
 * uptime monitor at `GET /health`, which performs the same read on demand.
 */
export function startKeepAlive(): void {
  const hours = config.keepAliveIntervalHours;
  if (hours <= 0) {
    console.log("[keep-alive] Disabled (KEEP_ALIVE_INTERVAL_HOURS=0)");
    return;
  }

  void touch("startup");

  timer = setInterval(() => void touch(`scheduled every ${hours}h`), hours * HOUR_MS);
  timer.unref();

  console.log(`[keep-alive] Touching MongoDB every ${hours}h`);
}

export function stopKeepAlive(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = undefined;
}
