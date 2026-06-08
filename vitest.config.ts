import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react"
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "components/**/*.test.tsx"]
  }
});
