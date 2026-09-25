import { buildApp } from "./app";
import { connectDB, disconnectDB } from "./config/db";
import { config } from "./config/env";
import { startKeepAlive, stopKeepAlive } from "./config/keep-alive";

async function start(): Promise<void> {
  console.log(`[cors] Allowed origins: ${JSON.stringify(config.corsOrigin)}`);

  await connectDB();

  startKeepAlive();

  const app = buildApp({ corsOrigin: config.corsOrigin, enableLogging: true });
  const server = app.listen(config.port, () => {
    console.log(`[server] Listening on http://localhost:${config.port} (${config.nodeEnv})`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[server] ${signal} received, shutting down...`);
    server.close();
    stopKeepAlive();
    await disconnectDB();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

start().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
