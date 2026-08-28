import { defineStore } from "pinia";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";

import fixLinkNames from "~/default-scripts/fix-link-names.js";
import fixProfiles from "~/default-scripts/fix-profiles";
import listRefs from "~/default-scripts/list-refs";
import select from "~/default-scripts/select";
import listAutomaticRefs from "~/default-scripts/list-automatic-profile-rule-text-refs";
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import { dirname, listFolder, watchFile } from "~/electron/node_helpers";
import findDuplicateIds from "~/default-scripts/find-duplicate-ids";
import findDuplicatesProfiles from "~/default-scripts/find-duplicates-profiles";
import towMatchedPlay from "~/default-scripts/tow/matched-play-constraints";

/** What a script's `context` hook may hand back for one menu entry. */
export interface HookResult {
  label?: string;
  /** Which group of the asking menu to sit in; unknown names fall back to the Scripts submenu. */
  group?: string;
  /** Path under /assets, without a leading slash. */
  icon?: string;
  run?: () => unknown;
}
export type HookAction = HookResult & { label: string; run: () => unknown };

let count = 0;
export const useScriptsStore = defineStore("scripts", {
  state: () => ({
    hooks: {} as Record<string, Record<string, Function>>,
  }),

  actions: {
    async get_scripts(system?: GameSystemFiles) {
      if (!system?.gameSystem) return [];
      const result = [];
      try {
        const path = getDataObject(system.gameSystem).fullFilePath;
        if (!path) return [];
        const dir = `${dirname(path)}/scripts`;

        for (const file of await listFolder(dir)) {
          try {
            if (!file.path.endsWith(".js")) continue;
            const obj = reactive({
              path: file.path,
            }) as Record<string, any>;
            const loadScript = async () => {
              try {
                const module = await import(/* @vite-ignore */ file.path + `?v=${count++}`);
                for (const key in module.default) {
                  obj[key] = module.default[key];
                }
                delete obj.error;
              } catch (e) {
                console.error(e);
                obj.error = e;
              }
            };
            loadScript();
            watchFile(file.path, loadScript);
            result.push(obj);
          } catch (e) {
            console.error(e);
            continue;
          }
        }
        return result;
      } catch (e) {
        return [];
      }
    },
    get_default_scripts(system?: GameSystemFiles) {
      // const testScripts = [] as Record<string, any>[];
      // testScripts.push(pasteSpecialRule);
      // testScripts.push(pasteWeapons);
      // testScripts.push(pasteEquipment);
      const scripts = [
        fixLinkNames,
        fixProfiles,
        listRefs,
        select,
        findDuplicateIds,
        findDuplicatesProfiles,
        listAutomaticRefs,
        //  ...(electron ? [] : testScripts),
      ] as Record<string, any>[];

      // Scripts spécifiques à Warhammer: The Old World (filtré par nom de système,
      // comme les scripts T9A l'étaient dans get_scripts). Nécessaire ici car ce script
      // est en .ts : get_scripts ne charge que les .js du dossier de données, donc il le skip.
      if ((system?.gameSystem?.name ?? "").includes("Old World")) {
        scripts.push(towMatchedPlay);
      }

      return scripts;
    },
    async emit(key: string, ...args: any[]) {
      for (const cb of Object.values(this.hooks[key] || {})) {
        try {
          await cb(...args);
        } catch (e) {
          continue;
        }
      }
    },
    async run_hooks(key: string, event?: Event, arg?: any) {
      for (const cb of Object.values(this.hooks[key] || {})) {
        try {
          const returned = await cb(event, arg);
          if (returned) {
            return returned;
          } else if (returned === null) {
            return null;
          }
        } catch (e) {
          continue;
        }
      }
      return arg;
    },
    /**
     * Collects menu entries contributed by scripts.
     *
     * A script's `context` hook is handed the current selection and returns what it wants to
     * offer: a label, an object, an array of either, or nothing to stay hidden. It used to
     * return bare script names with no way to invoke them, so the menu rendered items that
     * did nothing when clicked.
     */
    run_hooks_sync(key: string, event?: Event, arg?: any): HookAction[] {
      const result: HookAction[] = [];
      for (const [name, cb] of Object.entries(this.hooks[key] || {})) {
        try {
          const returned = cb(event, arg) as string | HookResult | HookResult[] | undefined;
          if (!returned) continue;
          for (const one of Array.isArray(returned) ? returned : [returned]) {
            if (!one) continue;
            if (typeof one === "object") {
              // `group` names a group in whatever menu is asking; an unknown one just means
              // "wherever you put things you don't have a place for".
              result.push({ ...one, label: one.label ?? name, run: () => one.run?.() });
            } else {
              // A bare label means "offer me, then run the script itself".
              result.push({ label: String(one) || name, run: () => this.run_script(name, arg) });
            }
          }
        } catch (e) {
          console.error(`Script "${name}" failed contributing a "${key}" action`, e);
        }
      }
      return result;
    },
    async run_script(script: string, ...args: any[]) {
      console.log("Running script", script, "with args", args);
      return await this.get_default_scripts()
        .find((s) => s.name === script)
        ?.run?.(...args);
    },
    add_hook(hook_key: string, func_key: string, func: Function) {
      if (!this.hooks[hook_key]) {
        this.hooks[hook_key] = {};
      }
      this.hooks[hook_key][func_key] = func;
    },
    add_script_hooks(script: { name: string; hooks?: Record<string, Function> }) {
      for (const [key, func] of Object.entries(script.hooks || {})) {
        if (typeof func === "function") {
          this.add_hook(key, script.name, func);
        }
      }
    },
  },
});
