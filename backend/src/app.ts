import compression from "compression";
import cors from "cors";
import express, { Express } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { buildCorsOriginHandler } from "./config/cors";
import { pingDB } from "./config/db";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { pokemonRouter } from "./routes/pokemon-routes";
import type { BuildAppOptions } from "./types/build-app-options.type";

export function buildApp({ corsOrigin = "*", enableLogging = false }: BuildAppOptions = {}): Express {
  const app = express();

  app.use(helmet());
  // gzip/brotli responses larger than 1 KB. Cuts the ~640 KB `?all=true`
  // JSON payload down to ~100 KB on the wire, which is the single biggest
  // factor in the bulk endpoint's transfer time.
  app.use(compression());
  app.use(cors({ origin: buildCorsOriginHandler(corsOrigin) }));
  app.use(express.json({ limit: "1mb" }));
  if (enableLogging) app.use(morgan("dev"));

  app.get("/", (_req, res) => {
    res.json({ status: "ok", service: "pokedex-backend" });
  });

  // Deep health check: unlike `/`, this actually reads from MongoDB, so it
  // doubles as the endpoint an external uptime monitor hits to keep an Atlas
  // free-tier (M0) cluster from auto-pausing after 60 days idle.
  //
  // `no-store` is load-bearing. Every other route sends a long
  // `Cache-Control`, so a scheduled ping against e.g. `/api/pokemon?limit=1`
  // would be served from the Cloudflare edge and never reach the database --
  // the cluster would keep idling while the monitor reported success.
  app.get("/health", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const latencyMs = await pingDB();
      res.json({ status: "ok", db: "connected", latencyMs });
    } catch (err) {
      res.status(503).json({
        status: "error",
        db: "unreachable",
        message: err instanceof Error ? err.message : "Unknown database error",
      });
    }
  });

  app.use("/api/pokemon", pokemonRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
