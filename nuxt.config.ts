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
  vue: {
    compilerOptions: {
      /**
       * Every right-panel field is a bare <table><tr> -- 25 of them across 23 files. The parser
       * inserts the <tbody> itself, and nothing here renders on a server (ssr is false), so there
       * is no hydration to mismatch. Vue 3.5 started warning about the nesting anyway, which the
       * Nuxt 4 upgrade turned into a screenful on every build.
       *
       * Only that one warning is dropped; anything else the template compiler says still prints.
       */
      onWarn: (warning: { message: string }) => {
        if (!warning.message.includes("cannot be child of")) {
          console.warn(`[vue/compiler] ${warning.message}`);
        }
      },
    },
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
                name: 'main.js',
                // Only main.js and preload.js are copied to .output/public, so main.js has to be
                // self-contained. Rollup enforced that on its own -- it refuses to code-split a
                // UMD build -- but rolldown splits one happily, and main.js came out requiring
                // sibling chunks that were never copied next to it.
                inlineDynamicImports: true
              }
            }
          }
        }
      },
      { entry: "electron/preload.js" }
    ],
  },
  // windi re-parses every <style> block through its own CSS parser, which flattens scss nesting and
  // reorders rules -- that pushed rules above `@use`, which sass rejects. Nothing here uses @apply /
  // @screen / theme(), so the transform only ever had a downside. Class scanning is unaffected.
  windicss: { transformCSS: false },
  css: ["~/shared_components/css/vars.scss", "~/shared_components/css/style.scss"],
  vite: {
    plugins: [commonjs()],
    build: {
      // electron 44 ships chromium 152: transpile syntax so web-dev code can't silently break the desktop build.
      // The web build keeps the older floor on purpose, so raising Electron does not drop
      // browsers that were supported before.
      target: electron ? "chrome152" : "chrome112",
    },
  },
  ignore: [".release/**"],
  hooks: {
    // @pinia/nuxt appends `import.meta.hot.accept(acceptHMRUpdate(useXStore, import.meta.hot))` to
    // every file that calls defineStore. Pinia's hot patch keeps only the state keys the *fresh*
    // state object already has (patchObject: `if (!(key in newState)) continue`), and every store
    // here is a dynamically-keyed record -- scripts/hooks/loaded, catalogues, dict, systemInfo.
    // So a hot update emptied them, the persist plugin wrote the empty version back to
    // localStorage, and registered scripts stopped firing with nothing saying why. Dropping the
    // injection leaves the live store alone: a store edit no longer applies until a reload, which
    // is what every other .ts in this app already does.
    //
    // Not import.meta.hot.invalidate() in its place: these stores import each other, every path
    // out of them ends at a self-accepting .vue, and the invalidation ping-ponged between
    // editorStore and editorUIState until the dev server drowned in it.
    "vite:extendConfig"(config) {
      const at = config.plugins?.findIndex((p: any) => p && p.name === "pinia:auto-hmr-registration") ?? -1;
      if (at >= 0) config.plugins!.splice(at, 1);
    },
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
