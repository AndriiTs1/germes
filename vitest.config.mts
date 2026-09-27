import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Minimal runner for server/domain logic only: node environment, no DOM,
 * no React. Mirrors the tsconfig "@/*" path alias.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
