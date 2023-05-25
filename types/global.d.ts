import { VueElement } from "nuxt/dist/app/compat/capi";

declare global {
  var isEditor: boolean | undefined;
  var electron:
    | undefined
    | {
        send: (channel, ...args) => unknown;
        receive: (channel, listener) => unknown;
        invoke: (channel, ...args) => unknown;
      };
}
