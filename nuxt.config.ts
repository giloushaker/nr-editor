// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from "nuxt/config";
import pkg from "./package.json";
import { dirname } from "path";
import { copyFileSync, writeFileSync } from "fs";
import commonjs from "vite-plugin-commonjs";
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
    "pinia-plugin-persistedstate/nuxt",
    ...(electron ? ["nuxt-electron"] : []),
  ],
  app: ghpages
    ? {
      baseURL: `/${pkg.build.publish[0].repo}/`,
      head: {
        title: "New Recruit - Editor",
        base: {
          href: `/${getGitHubRepo()}/`,
        },
      },
    }
    : electron
      ? undefined
      : {
        // relative asset paths (assets/icons/...) rely on a <base>; ghpages sets its own,
        // dev and root-domain web builds need one too or icons 404 on nested routes
        head: {
          base: {
            href: "/",
          },
        },
      },
  // @ts-ignore
  plugins: [
    ...(electron
      ? [
        {
          mode: "client",
          src: "electron/renderer.ts",
        },
      ]
      : []),
  ],
  // nuxt-electron sets router.options.hashMode with `??=`, but Nuxt >= 3.15 ships an
  // explicit `hashMode: false` default, so its assignment never fires. Electron loads
  // index.html over file://, where path routing resolves to the filesystem path and
  // every route falls through to the [...slugs] catch-all.
  router: {
    options: {
      hashMode: electron,
    },
  },
  typescript: {
    strict: true,
  },
  electron: {
    build: [
      {
        entry: "electron/main.ts",
        vite: {
          resolve: {
            alias: {

              "~": dirname(__filename),
              "@": dirname(__filename),
              "~~": dirname(__filename),
              "@@": dirname(__filename),
              "assets": `${dirname(__filename)}/assets`,
              "public": `${dirname(__filename)}/public`

            }
          },
          build: {
            sourcemap: true,
            rollupOptions: {
              output: {
                // Setting format to 'iife' for a self-executing function, or 'umd' for universal module definition
                format: 'umd', // or 'umd'
                // Optionally, you can name your module, useful especially for 'umd' format
                name: 'main.js'
              }
            }
          }
        }
      },
      { entry: "electron/preload.js" }
    ],
  },
  css: ["~/shared_components/css/vars.scss", "~/shared_components/css/style.scss"],
  vite: {
    plugins: [commonjs()],
    build: {
      // electron 24 ships chromium ~112: transpile syntax so web-dev code can't silently break the desktop build
      target: "chrome112",
    },
  },
  ignore: [".release/**"],
  hooks: {
    "nitro:build:public-assets"(nitro) {
      if (electron) {
        const outputDir = nitro.options.output.publicDir;
        // copyFileSync("electron/main.js", `${outputDir}/main.js`);
        // copyFileSync("electron/preload.js", `${outputDir}/preload.js`);
        copyFileSync("dist-electron/main.js", `${outputDir}/main.js`);
        copyFileSync("dist-electron/preload.js", `${outputDir}/preload.js`);
        copyFileSync("package.json", `${outputDir}/package.json`);
      }
      if (ghpages) {
        const outputDir = nitro.options.output.publicDir;
        writeFileSync(`${outputDir}/.nojekyll`, "");
      }
    },
  },
  components: [{ path: "~/shared_components/" }, { path: "~/components/" }],

});
