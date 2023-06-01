import { VueElement } from "nuxt/dist/app/compat/capi";

declare global {
  var isEditor: boolean | undefined;
  var _closeWindow: boolean | undefined;
  var $set: (o, k, v) => unknown;
  var $delete: (o, k) => unknown;
  var electron:
    | undefined
    | {
        send: (channel, ...args) => unknown;
        receive: (channel, listener) => unknown;
        invoke: (channel, ...args) => unknown;
      };
}
