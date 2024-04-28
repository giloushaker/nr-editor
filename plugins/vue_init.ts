// @ts-ignore
import vClickOutside from "click-outside-vue3";
import Notifications from "@kyvg/vue3-notification";
import type { Router } from "vue-router";
import type { Pinia } from "pinia";
import { useSettingsStore } from "~/stores/settingsState";
import * as helpers from "~/assets/shared/battlescribe/bs_helpers";
import * as node from "~/electron/node_helpers";
import { notify } from "@kyvg/vue3-notification";


export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(vClickOutside);
  nuxtApp.vueApp.use(Notifications);
  (nuxtApp.$pinia as Pinia).use(({ store }) => {
    store.$router = nuxtApp.$router as Router;
  });
  const oldLog = globalThis.console.log
  globalThis.$toRaw = toRaw;
  globalThis.console.log = (...args: any[]) => oldLog(...args.map((arg) => toRaw(arg)))
  globalThis.$markRaw = markRaw;
  globalThis.$helpers = helpers;
  globalThis.$node = node;
  globalThis.notify = notify;
  globalThis.isEditor = true;
  globalThis.$nextTick = nextTick
  if (typeof globalThis.electron === "undefined") {
    (globalThis as any).electron = null
  }
  const settings = useSettingsStore()
  settings.init()

});
