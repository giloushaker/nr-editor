import { defineStore } from "pinia";
import { getEntryPath, type EntryPathEntry, getAtEntryPath } from "~/assets/shared/battlescribe/bs_editor";
import { goodJsonKeys } from "~/assets/shared/battlescribe/bs_main";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { get_base_from_vue_el, get_ctx } from "./editorStore";

/**
 * This class represents a snapsnot of the editor's current state, in order to reload it for navigating around
 */
export interface EditorUIState {
  selection?: EntryPathEntry[];
  scroll?: number;
  open: Record<string, any>;
  catalogueId?: string;
  systemId?: string;
  mode?: "edit" | "references";
}

export const useEditorUIState = defineStore("editor-ui", {
  state: () => ({
    catalogues: {} as Record<string, EditorUIState>,
  }),

  persist: {
    storage: globalThis.localStorage,
  },
  actions: {
    collapse_level(depth: number) {
      if (depth >= 0) {
        const deepestCls = `depth-${depth} collapsible-box opened`;
        const results = document.documentElement.getElementsByClassName(deepestCls);
        if (results?.length) {
          for (var i = 0; i < results.length; i++) {
            const cur = results[i];
            get_ctx(cur)?.close();
          }
        }
      }
    },
    collapse_all() {
      this.collapse_level(1);
      this.collapse_level(0);
    },
    collapse_deepest() {
      const cls = `collapsible-box opened`;
      const results = document.documentElement.getElementsByClassName(cls);
      let maxDepth = -1;
      if (results?.length) {
        for (var i = 0; i < results.length; i++) {
          const cur = results[i];
          cur.classList.forEach((val) => {
            if (val.startsWith("depth-")) {
              maxDepth = Math.max(maxDepth, parseInt(val.split("-")[1]));
            }
          });
        }
      }
      this.collapse_level(maxDepth);
    },
    set_state(id: string, data: Partial<EditorUIState>) {
      // Get all open collapsible boxes and save their state
      function find_open_recursive(elt: Element, obj: Record<string, any>, depth = 0) {
        const cls = `depth-${depth} collapsible-box opened`;
        const results = elt.getElementsByClassName(cls);
        if (results?.length) {
          for (var i = 0; i < results.length; i++) {
            const cur = results[i];
            const item = get_base_from_vue_el(get_ctx(cur));
            const key = item.parentKey;
            const parent = item.parent;

            let next = obj;
            if (parent) {
              const arr = parent[key] as EditorBase[];
              if (!arr || !Array.isArray(arr)) continue;
              const index = arr.indexOf(item);
              if (!(key in obj)) obj[key] = {};
              const obj_arr = obj[key];
              if (!(index in obj_arr)) obj_arr[index] = {};
              next = obj_arr[index];
            } else {
              const arr = []
              for (let i = 0; i < cur.classList.length; i++) {
                arr.push(cur.classList[i])
              }
              const keys = arr.filter((o) => goodJsonKeys.has(o));
              for (const key of keys) {
                obj[key] = {};
                obj[key][0] = {};
                next = obj[key][0];
              }
            }

            find_open_recursive(cur, next, depth + 1);
          }
        }
      }
      const open = {};
      find_open_recursive(document.documentElement, open);
      const result = { ...data, open: open };
      this.$state.catalogues[id] = result;
      return open;
    },

    get_data(id: string): Record<string, any> {
      const current = this.$state.catalogues[id];
      if (!current) return {};
      return current;
    },
    get_root(id: string, key: string): boolean {
      let current = this.$state.catalogues[id];
      if (!current) return false;
      current = current.open[key];
      if (!current) return false;
      return true;
    },
    get(id: string, path: EntryPathEntry[]): boolean {
      if (!path.length) return false;
      let current = this.$state.catalogues[id];
      if (!current) return false;
      let current_node = current.open[path[0].key];
      if (!current_node) return false;
      current_node = current_node[0];
      if (!current_node) return false;
      for (const node of path) {
        const arr = current_node[node.key];
        if (!arr) return false;
        const entry = arr[node.index];
        if (!entry) return false;
        current_node = entry;
      }
      return true;
    },
  },
});
