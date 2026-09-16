import { defineConfig } from "vitest/config";
import path from "node:path";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
  },
});
