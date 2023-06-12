// @ts-ignore
import vClickOutside from "click-outside-vue3";
import Notifications from "@kyvg/vue3-notification";
import { Router } from "vue-router";
import { Pinia } from "pinia";
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(vClickOutside);
  nuxtApp.vueApp.use(Notifications);
  console.log(nuxtApp);
  (nuxtApp.$pinia as Pinia).use(({ store }) => {
    store.$router = markRaw(nuxtApp.$router as Router);
  });
});
