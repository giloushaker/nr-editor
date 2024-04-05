import { defineStore } from "pinia";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";

import fixlinknames from "~/default-scripts/fix-link-names.js";
import fixprofiles from "~/default-scripts/fix-profiles";
import listrefs from "~/default-scripts/list-refs";
import select from "~/default-scripts/select";
import edit from "~/default-scripts/edit";
import listautomaticrefs from "~/default-scripts/list-automatic-profile-rule-text-refs";
import fixnewlines from "~/default-scripts/fix-newlines";
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import { dirname, getFolderFiles, readFile, watchFile } from "~/electron/node_helpers";

function doimport(str: string) {
  //@ts-ignore
  if (globalThis.URL.createObjectURL) {
    const blob = new Blob([str], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    const module = import(url)
    URL.revokeObjectURL(url) // GC objectURLs
    return module
  }

  const url = "data:text/javascript;base64," + btoa(str)
  return import(url)
}
let count = 0;
export const useScriptsStore = defineStore("scripts", {
  state: () => ({

  }),

  actions: {
    async get_scripts(system?: GameSystemFiles) {
      if (!system?.gameSystem) return []
      try {
        const path = getDataObject(system.gameSystem).fullFilePath
        if (!path) return []
        const result = []
        const dir = `${dirname(path)}/scripts`

        for (const file of await getFolderFiles(dir)) {
          try {
            if (!file.path.endsWith('.js')) continue;
            const obj = reactive({
              path: file.path,
            }) as Record<string, any>
            const loadScript = async (path: string) => {
              try {
                const updated_file = await readFile(path)
                if (!updated_file) return
                const module = await import(file.path + `?v=${count++}`)
                for (const key in module.default) {
                  obj[key] = module.default[key]
                }
                delete obj.error
              } catch (e) {
                console.error(e)
                obj.error = e
              }
            }
            loadScript(file.path)
            watchFile(file.path, loadScript)
            result.push(obj)
          } catch (e) {
            console.error(e)
            continue;
          }
        }
        return result
      } catch (e) {
        return []
      }
    },
    get_default_scripts() {
      return [
        fixlinknames, fixprofiles, listrefs, select, listautomaticrefs
      ] as Record<string, any>[]
    }
  }

});
