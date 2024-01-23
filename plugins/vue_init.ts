// @ts-ignore
import vClickOutside from "click-outside-vue3";
import Notifications from "@kyvg/vue3-notification";
import type { Router } from "vue-router";
import type { Pinia } from "pinia";
import { useSettingsStore } from "~/stores/settingsState";
import * as helpers from "~/assets/shared/battlescribe/bs_helpers";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(vClickOutside);
  nuxtApp.vueApp.use(Notifications);
  (nuxtApp.$pinia as Pinia).use(({ store }) => {
    store.$router = nuxtApp.$router as Router;
  });
  const settings = useSettingsStore()
  settings.init()
  globalThis.$toRaw = toRaw;
  (globalThis as any).$helpers = helpers
});
