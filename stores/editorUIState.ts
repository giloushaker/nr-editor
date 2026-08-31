import { defineStore } from "pinia";
import { type EntryPathEntry } from "~/assets/editor/bs_editor";
import { get_ctx } from "./editorStore";
import { isOpen, setOpen, type OpenTree } from "./open_state";

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
          for (let i = 0; i < results.length; i++) {
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
        for (let i = 0; i < results.length; i++) {
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
    /** The live `open` tree for a catalogue, created on first write. */
    open_tree(id: string): OpenTree {
      const existing = this.$state.catalogues[id];
      if (existing) return (existing.open ??= {});
      this.$state.catalogues[id] = { open: {} };
      return this.$state.catalogues[id].open;
    },
    /** Records a category box (a direct child of the catalogue) as open or closed. */
    set_root_open(id: string, key: string, open: boolean) {
      const tree = this.open_tree(id);
      if (open) tree[key] ??= { 0: {} };
      else delete tree[key];
    },
    /** Records an entry box as open or closed. */
    set_open(id: string, path: EntryPathEntry[], open: boolean) {
      if (!path.length) return;
      setOpen(this.open_tree(id), path, open);
    },
    set_state(id: string, data: Partial<EditorUIState>) {
      const current = this.$state.catalogues[id];
      const result = { ...current, ...data } as EditorUIState;
      result.open ??= {};
      this.$state.catalogues[id] = result;
      return result.open;
    },

    get_data(id: string): Record<string, any> {
      const current = this.$state.catalogues[id];
      if (!current) return {};
      return current;
    },
    get_root(id: string, key: string): boolean {
      const current = this.$state.catalogues[id];
      if (!current?.open) return false;
      return Boolean(current.open[key]);
    },
    get(id: string, path: EntryPathEntry[]): boolean {
      return isOpen(this.$state.catalogues[id]?.open, path);
    },
  },
});
