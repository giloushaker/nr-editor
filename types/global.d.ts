import type { NotificationsOptions } from "@kyvg/vue3-notification";
import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import type { useEditorStore } from "~/stores/editorStore";
import type * as nodeHelpers from "~/electron/node_helpers";
import type * as bsHelpers from "~/assets/shared/battlescribe/bs_helpers";
import type { MySubClassedDexie as CatDexie } from "~/assets/shared/battlescribe/cataloguesdexie";
declare global {
  var isEditor: true;
  var _closeWindow: boolean | undefined;
  var notify: (arg: NotificationsOptions | string) => unknown;
  var $set: (o: any, k: any, v: any) => unknown;
  var $delete: (o: any, k: any) => unknown;
  var $catalogue: Catalogue & { manager: GameSystemFiles; fullFilePath: string };
  var $store: ReturnType<typeof useEditorStore>;
  var $node: typeof nodeHelpers;
  var $helpers: typeof bsHelpers;
  function $toRaw<T extends Object>(o: T): T;
  function $markRaw<T extends Object>(o: T): T;
  function $nextTick(): Promise<unknown>;
  var customPrompt: (
    data: string | { html: string; accept?: string; cancel?: string; id?: string }
  ) => Promise<boolean>;
  var electron:
    | undefined
    | {
        send: (channel: string, ...args: any) => unknown;
        receive: (channel: string, listener: any) => unknown;
        invoke: (channel: string, ...args: any) => unknown;
        on: (channel: string, ...args: any) => unknown;
      };
  var cataloguesdexie: CatDexie;
}

console.log($store);
