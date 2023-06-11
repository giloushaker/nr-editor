import vClickOutside from "click-outside-vue3";
import Notifications from "@kyvg/vue3-notification";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(vClickOutside);
  nuxtApp.vueApp.use(Notifications);
});
