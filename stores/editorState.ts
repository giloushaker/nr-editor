import { VueElement } from "nuxt/dist/app/compat/capi";
import { defineStore } from "pinia";
export interface IEditorState {
  selectionsParent?: Object | null;
  selections: { obj: any; onunselected: () => unknown }[];
  selectedElementGroup: any | null;
  selectedElement: any | null;
  selectedItem: any | null;
}

export const useEditorStore = defineStore("editor", {
  state: (): IEditorState => ({
    selections: [],
    selectedElementGroup: null,
    selectedElement: null,
    selectedItem: null,
  }),
  actions: {
    unselect(obj?: any) {
      const next_selected = [];
      const next_unselected = [];
      for (const selection of this.selections) {
        if (obj === undefined || toRaw(selection.obj) === toRaw(obj)) {
          next_unselected.push(selection);
        } else {
          next_selected.push(selection);
        }
      }
      this.selections = next_selected;
      for (const unselected of next_unselected) {
        if (unselected.onunselected) {
          unselected.onunselected();
        }
      }
    },
    select(obj: any, onunselected: () => unknown) {
      if (!this.selections.includes(obj)) {
        this.selections.push({ obj, onunselected });
      }
    },
    is_selected(obj: any) {
      return this.selections.findIndex((o) => o.obj === obj) !== -1;
    },
    do_select(e: MouseEvent, el: VueElement, group: VueElement | VueElement[]) {
      const entries = Array.isArray(group) ? group : [group];
      const last = toRaw(this.selectedElementGroup);
      const last_element = toRaw(this.selectedElement);
      this.selectedElement = toRaw(el);
      this.selectedElementGroup = toRaw(group);

      if (e.shiftKey && toRaw(group) === toRaw(last)) {
        const a = entries.findIndex((o) => o === last_element);
        const b = entries.findIndex((o) => o === this.selectedElement);
        const low = Math.min(a, b);
        const high = Math.max(a, b);
        for (let i = low; i <= high; i++) {
          const entry = entries[i];
          entry.select();
        }
        return;
      }
      if (!e.ctrlKey && !e.metaKey) {
        this.unselect();
      }
      if (e.ctrlKey && this.is_selected(el)) {
        this.unselect(el);
      } else {
        el.select();
        this.selectedItem = el;
      }
    },
  },
});
