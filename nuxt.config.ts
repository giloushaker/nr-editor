// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from "nuxt/config";
import pkg from "./package.json";
const electron = process.argv.includes("--electron");
const ghpages = process.argv.includes("--ghpages");

function getGitHubRepo() {
  return pkg.build.publish[0].repo;
}
if (ghpages) {
  console.log("ghpages repo", `/${getGitHubRepo()}/`);
}

export default defineNuxtConfig({
  ssr: false,
  sourcemap: {
    server: true,
    client: true,
  },
  runtimeConfig: {
    public: {
      editor: true,
      electron: electron,
      ghpages: ghpages,
      clientVersion: pkg.version,
    },
  },
  modules: [
    "nuxt-windicss",
    "@pinia/nuxt",
    "@pinia-plugin-persistedstate/nuxt",
    ...(electron ? ["nuxt-electron"] : []),
  ],
  app: ghpages
    ? {
      baseURL: `/${pkg.build.publish[0].repo}/`,
      head: {
        title: "New Recruit - Editor",
        ...(ghpages
          ? {
            base: {
              href: `/${getGitHubRepo()}/`,
            },
          }
          : {}),
      },
    }
    : undefined,
  // @ts-ignore
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
    build: [
      {
        entry: "electron/main.ts",
        vite: {
          build: {
            sourcemap: true
          }
        }
      },
      { entry: "electron/preload.js" }
    ],
  },
  css: ["~/shared_components/css/vars.scss", "~/shared_components/css/style.scss"],
  vite: {
    plugins: [require("vite-plugin-commonjs")()],
  },
  ignore: [".release/**"],
  hooks: {
    "nitro:build:public-assets"(nitro) {
      if (electron) {
        const outputDir = nitro.options.output.publicDir;
        const { copyFileSync } = require("fs");
        // copyFileSync("electron/main.js", `${outputDir}/main.js`);
        // copyFileSync("electron/preload.js", `${outputDir}/preload.js`);
        copyFileSync("dist-electron/main.js", `${outputDir}/main.js`);
        copyFileSync("dist-electron/preload.js", `${outputDir}/preload.js`);
        copyFileSync("package.json", `${outputDir}/package.json`);
      }
      if (ghpages) {
        const { writeFileSync, readdirSync } = require("fs");
        const outputDir = nitro.options.output.publicDir;
        writeFileSync(`${outputDir}/.nojekyll`, "");
      }
    },
  },
  components: [{ path: "~/shared_components/" }, { path: "~/components/" }],

});
