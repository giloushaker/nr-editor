// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  modules: ["@sidebase/nuxt-session", "nuxt-windicss"],
  ssr: false,
  typescript: {
    strict: true,
  },
  css: [
    "~/shared_components/css/vars.scss",
    "~/shared_components/css/style.scss",
  ],

  vite: {
    plugins: [require("vite-plugin-commonjs")()],
  },
  components: [{ path: "~/shared_components" }, { path: "~/components" }],
});
