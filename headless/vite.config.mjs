import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Unimport from "unimport/unplugin";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export default {
  root,
  resolve: { alias: { "~": root, "@": root } },
  plugins: [Unimport.vite({ presets: ["vue", "pinia"] })],
};
