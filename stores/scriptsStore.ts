import { defineStore } from "pinia";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";

import fixlinknames from "~/default-scripts/fix-link-names.js";
import fixprofiles from "~/default-scripts/fix-profiles";
import listrefs from "~/default-scripts/list-refs";
import select from "~/default-scripts/select";
import listautomaticrefs from "~/default-scripts/list-automatic-profile-rule-text-refs";
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import { dirname, getFolderFiles, readFile, watchFile } from "~/electron/node_helpers";
import pasteSpecialRule from "~/default-scripts/tow/paste-special-rule";
import pasteWeapons from "~/default-scripts/tow/paste-weapons";
import pasteEquipment from "~/default-scripts/tow/paste-equipment";
import t9a_import from "~/default-scripts/nrt9a/import_json";
import t9a_rarity from "~/default-scripts/nrt9a/rarity_script";

let count = 0;
export const useScriptsStore = defineStore("scripts", {
  state: () => ({
    hooks: {} as Record<string, Record<string, Function>>,
  }),

  actions: {
    async get_scripts(system?: GameSystemFiles) {
      if (!system?.gameSystem) return [];
      try {
        const path = getDataObject(system.gameSystem).fullFilePath;
        if (!path) return [];
        const result = [];
        const dir = `${dirname(path)}/scripts`;

        for (const file of await getFolderFiles(dir)) {
          try {
            if (!file.path.endsWith(".js")) continue;
            const obj = reactive({
              path: file.path,
            }) as Record<string, any>;
            const loadScript = async (path: string) => {
              try {
                const updated_file = await readFile(path);
                if (!updated_file) return;
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
            loadScript(file.path);
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
    get_default_scripts() {
      const testScripts = [] as Record<string, any>[];
      testScripts.push(pasteSpecialRule);
      testScripts.push(pasteWeapons);
      testScripts.push(pasteEquipment);
      return [
        t9a_import,
        t9a_rarity,
        fixlinknames,
        fixprofiles,
        listrefs,
        select,
        listautomaticrefs,
        ...(electron ? [] : testScripts),
      ] as Record<string, any>[];
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
    async run_hooks(key: string, event: any, arg: any[]) {
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
