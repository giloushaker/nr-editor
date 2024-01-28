import type { VueElement } from "vue";
import { NotificationsOptions } from "@kyvg/vue3-notification";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { useEditorStore } from "~/stores/editorStore";
import type * as nodeHelpers from "~/electron/node_helpers";
declare global {
  var isEditor: boolean | undefined;
  var _closeWindow: boolean | undefined;
  var notify: (arg: NotificationsOptions | string) => unknown;
  var $set: (o, k, v) => unknown;
  var $delete: (o, k) => unknown;
  var $catalogue: Catalogue & {manager: GameSystemFiles, fullFilePath: string};
  var $store: ReturnType<typeof useEditorStore>;
  var $node: typeof nodeHelpers;
  var $toRaw: (o: T) => T;
  var customPrompt: (data: string | {html: string, accept?: string, cancel?: string, id?: string}) => boolean;
  var electron:
    | undefined
    | {
        send: (channel, ...args) => unknown;
        receive: (channel, listener) => unknown;
        invoke: (channel, ...args) => unknown;
        on: (channel, ...args) => unknown;
      };
}


