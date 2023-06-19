import type { VueElement } from "vue";
import { NotificationsOptions } from "@kyvg/vue3-notification";

declare global {
  var isEditor: boolean | undefined;
  var _closeWindow: boolean | undefined;
  var notify: (arg: NotificationsOptions | string) => unknown;
  var $set: (o, k, v) => unknown;
  var $delete: (o, k) => unknown;
  var electron:
    | undefined
    | {
        send: (channel, ...args) => unknown;
        receive: (channel, listener) => unknown;
        invoke: (channel, ...args) => unknown;
        on: (channel, ...args) => unknown;
      };
}
