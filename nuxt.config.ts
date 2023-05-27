// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from "nuxt/config";
import pkg from "./package.json";
const electron = process.argv.includes("--electron");
export default defineNuxtConfig({
  ssr: false,
  // @ts-ignore
  env: {
    PROD_BUILD: true,
    editor: true,
    electron: electron,
  },
  runtimeConfig: {
    public: {
      PROD_BUILD: true,
      editor: true,
      electron: electron,
      clientVersion: pkg.version,
    },
  },
  modules: [
    "nuxt-windicss",
    "@pinia/nuxt",
    "@pinia-plugin-persistedstate/nuxt",
    ...(electron ? ["nuxt-electron"] : []),
  ],
  plugins: [
    ...(electron
      ? [
          {
            mode: "client",
            src: "electron/renderer.js",
          },
        ]
      : []),
  ],
  typescript: {
    strict: true,
  },
  electron: {
    build: [{ entry: "electron/index.js" }, { entry: "electron/preload.js" }],
  },
  css: ["~/shared_components/css/vars.scss", "~/shared_components/css/style.scss"],
  vite: {
    plugins: [require("vite-plugin-commonjs")()],
  },
  hooks: {
    "nitro:build:before"(nitro) {
      if (electron) {
      }
    },
    "nitro:build:public-assets"(nitro) {
      if (electron) {
        const outputDir = nitro.options.output.publicDir;
        const { copyFileSync, symlinkSync } = require("fs");
        copyFileSync("electron/index.js", `${outputDir}/index.js`);
        copyFileSync("electron/preload.js", `${outputDir}/preload.js`);
        // symlinkSync("node_modules", `${outputDir}/node_modules`, "dir");
        copyFileSync("package.json", `${outputDir}/package.json`);
        // copyFileSync("electron/electron-package.json", `${outputDir}/package.json`);
      }
    },
  },
  components: [{ path: "~/shared_components" }, { path: "~/components" }],
  head: {
    title: "NR-Editor",
  },
});
