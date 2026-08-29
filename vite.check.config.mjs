/**
 * Alias config for the vite-node half of `npm run check`.
 *
 * The tsc half compiles its check files standalone, which only works because none of them
 * import anything. bs_search.ts does -- it walks real nodes -- so its check runs through
 * vite-node instead, and vite-node reads this rather than nuxt.config, so the `~` the editor
 * imports with has to be spelled out.
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default {
  resolve: { alias: { "~": root, "@": root } },
};
