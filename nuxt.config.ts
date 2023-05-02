// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  modules: ["nuxt-windicss", "@sidebase/nuxt-session"],
  ssr: false,
  typescript: {
    strict: true,
  },
});
