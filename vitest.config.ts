import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for the pure parts of features/ (parsers, id rules). Pages and adapters are
// checked in the browser. `~` resolves like it does in Nuxt.
export default defineConfig({
  resolve: { alias: { "~": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { include: ["features/**/*.test.ts"] },
});
