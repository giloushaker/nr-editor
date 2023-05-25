// https://nuxt.com/docs/api/configuration/nuxt-config
import { fstat } from "fs";
import { defineNuxtConfig } from "nuxt/config";
const electron = process.argv.includes("--electron");
export default defineNuxtConfig({
  ssr: true,
  // @ts-ignore
  env: {
    PROD_BUILD: true,
    editor: true,
    electron: electron,
  },
  publicRuntimeConfig: {
    PROD_BUILD: true,
    editor: true,
    electron: electron,
  },
  routeRules: {
    "*": { ssr: false, prerender: false },
    "/**": { ssr: false, prerender: false },
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
            ssr: false,
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
        const { copyFileSync } = require("fs");
        copyFileSync("package.json", `${outputDir}/package.json`);
        copyFileSync("electron/index.js", `${outputDir}/index.js`);
        copyFileSync("electron/preload.js", `${outputDir}/preload.js`);
      }
    },
  },
  alias: {
    "./js/teleport": "vue",
  },
  components: [{ path: "~/shared_components" }, { path: "~/components" }],
  head: {
    title: "NR-Editor",
  },
});
