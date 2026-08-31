import type { RouteLocationNormalizedLoaded, Router } from "vue-router";
import type { NotificationsOptions } from "@kyvg/vue3-notification";
import type { Base } from "~/assets/shared/battlescribe/bs_main";
import type { BSIData, BSIDataCatalogue, BSIDataSystem } from "~/assets/shared/battlescribe/bs_types";
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
  /** Console handle for the WebMCP tools; see plugins/webmcp.client.ts. */
  var $mcp: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
  var $node: typeof nodeHelpers;
  var $helpers: typeof bsHelpers;
  function $toRaw<T extends Object>(o: T): T;
  function $markRaw<T extends Object>(o: T): T;
  function $nextTick(): Promise<unknown>;
  /** Resolves true for accept, false for the cancel button, null when dismissed (veil/Esc). */
  var customPrompt: (
    data: string | { html: string; accept?: string; cancel?: string; id?: string; danger?: boolean }
  ) => Promise<boolean | null>;
  var electron:
    | undefined
    | {
        send: (channel: string, ...args: any) => unknown;
        receive: (channel: string, listener: any) => unknown;
        invoke: (channel: string, ...args: any) => unknown;
        on: (channel: string, ...args: any) => unknown;
      };
  var cataloguesdexie: CatDexie;
  /**
   * Provided by nuxt-nr, which shares assets/shared with this repo. Neither is reachable
   * from nr-editor at runtime ($t only from util.ts's time formatters, showMessage only
   * from GithubGameSystemFiles), so these are declarations, not shims.
   */
  var $t: (key: string, ...args: any[]) => string;
  var showMessage: (text: string) => unknown;
}

/**
 * `this.$route` / `this.$router` in Options API components.
 *
 * vue-router ships this augmentation itself, but it targets `declare module "vue"`, and vue
 * 3.5 only re-exports ComponentCustomProperties from @vue/runtime-core through `export *` --
 * which augmentation does not merge across, so it silently declared a second, unused interface.
 * Augmenting the package that actually owns the interface is what reaches the instance type.
 */
declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $route: RouteLocationNormalizedLoaded;
    $router: Router;
  }
}

/**
 * Keep the BattleScribe graph out of Vue's type-level ref unwrapping.
 *
 * A node reached through `data()` or a store was rewritten by UnwrapNestedRefs into a
 * structural copy of itself, and TypeScript then gave up comparing that copy to the class it
 * came from -- the graph is recursive and enormous, so it hit the depth limit and every use
 * of a search result read as a type error. This is the extension point Vue documents for it;
 * it is types-only, runtime reactivity is untouched.
 */
declare module "@vue/reactivity" {
  export interface RefUnwrapBailTypes {
    battlescribeBailTypes: Base | Catalogue | GameSystemFiles;
    // The file-shaped data objects too: plain JSON that never holds a ref, and the rewrite
    // turned nested fields into `unknown` where a component prop still wanted the real type.
    battlescribeDataBailTypes: BSIData | BSIDataCatalogue | BSIDataSystem;
  }
}
