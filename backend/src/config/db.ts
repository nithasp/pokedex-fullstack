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
 * Run the cheapest possible *real* read against the pokemon collection and
 * return how long it took, in milliseconds.
 *
 * Why a real query instead of `db.admin().command({ ping: 1 })`:
 * Atlas pauses free (M0) clusters after 60 days of inactivity, and the driver
 * already sends its own `hello`/`ping` heartbeats every 10s on an open pool —
 * so a `ping` proves nothing that Atlas wasn't already seeing. An actual
 * document read is unambiguous cluster activity.
 *
 * Cost is negligible: `findOne` with an `_id`-only projection stops at the
 * first document and returns a few bytes.
 */
export async function pingDB(): Promise<number> {
  const start = Date.now();
  await Pokemon.findOne({}, { _id: 1 }).lean();
  return Date.now() - start;
}
