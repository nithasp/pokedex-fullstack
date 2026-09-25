import dns from "dns";
import mongoose from "mongoose";
import { Pokemon } from "../models/pokemon";
import { config } from "./env";

// Windows IPv6 link-local DNS (fe80::1) can cause ECONNREFUSED on SRV lookups
// when using mongodb+srv:// URIs. Force public resolvers to avoid it.
// Only needed on Windows; Linux containers (e.g. Render) resolve fine natively.
if (process.platform === "win32") {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
}

export async function connectDB(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.mongoUri);
  console.log("[db] Connected to MongoDB");
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  console.log("[db] Disconnected from MongoDB");
}

/**
 * Must stay a real document read, not `db.admin().command({ ping: 1 })`: the
 * driver already sends its own `hello`/`ping` heartbeats every 10s on an open
 * pool, so a ping proves nothing Atlas wasn't already seeing.
 */
export async function pingDB(): Promise<number> {
  const start = Date.now();
  await Pokemon.findOne({}, { _id: 1 }).lean();
  return Date.now() - start;
}
