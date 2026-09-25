import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/tests/**/*.spec.ts"],
    globals: true,
    environment: "node",
    setupFiles: ["src/tests/setup.ts"],
    testTimeout: 60_000, // mongodb-memory-server can be slow on first download
    hookTimeout: 60_000,
    pool: "forks",
    forks: {
      singleFork: true,
    },
  },
});
