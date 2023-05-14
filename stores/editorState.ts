import { VueElement } from "nuxt/dist/app/compat/capi";
import { defineStore } from "pinia";
import {
  ItemTypeNames,
  ItemKeys,
  ItemTypes,
  CategoryEntry,
  possibleChildren,
  categories,
  EntryPathEntry,
  getEntryPath,
  onAddEntry,
  onRemoveEntry,
  popAtEntryPath,
  setAtEntryPath,
} from "~/assets/shared/battlescribe/bs_editor";
import { enumerate_zip } from "~/assets/shared/battlescribe/bs_helpers";
import {
  Catalogue,
  EditorBase,
} from "~/assets/shared/battlescribe/bs_main_catalogue";
import entries from "assets/json/entries.json";
import { Base, entryToJson } from "~/assets/shared/battlescribe/bs_main";
import { setPrototypeRecursive } from "~/assets/shared/battlescribe/bs_main_types";

export interface IEditorState {
  selectionsParent?: Object | null;
  selections: { obj: any; onunselected: () => unknown }[];
  selectedElementGroup: any | null;
  selectedElement: any | null;
  selectedItem: any | null;
  categories: Array<CategoryEntry>;
  possibleChildren: Array<ItemKeys>;
  filter: string;
  undoStack: { type: string; undo: () => unknown; redo: () => unknown }[];
  undoStackPos: number;
  clipboard: EditorBase[];
}

export interface CatalogueEntryItem {
  item: ItemTypes;
  type: ItemKeys;
}

export const useEditorStore = defineStore("editor", {
  state: (): IEditorState => ({
    selections: [],
    selectedElementGroup: null,
    selectedElement: null,
    selectedItem: null,
    filter: "",
    possibleChildren,
    categories: categories,
    undoStack: [],
    undoStackPos: -1,
    clipboard: [],
  }),

  actions: {
    init() {
      (globalThis as any).undo = () => this.undo();
      (globalThis as any).redo = () => this.redo();
      (globalThis as any).remove = () => this.remove();
    },
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
          const entry: any = entries[i];
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
        (el as any).select();
        this.selectedItem = el;
      }
    },
    do_rightclick_select(
      e: MouseEvent,
      el: VueElement,
      group: VueElement | VueElement[]
    ) {
      if (this.is_selected(el)) return;
      this.do_select(e, el, group);
    },
    get_selections(): EditorBase[] {
      return this.selections.map((o) => o.obj.$parent.item);
    },
    do_action(type: string, undo: () => void, redo: () => void) {
      redo();

      if (this.undoStackPos < this.undoStack.length) {
        this.undoStack.splice(this.undoStackPos + 1, 1, { type, undo, redo });
      } else {
        this.undoStack.push({ type, undo, redo });
      }
      this.undoStackPos += 1;
    },
    set_clipboard(data: any[]) {
      this.clipboard = data;
    },
    get_clipboard() {
      return this.clipboard as EditorBase[];
    },
    clear_clipboard() {
      this.clipboard = [];
    },
    undo() {
      const action = this.undoStack[this.undoStackPos];
      if (action) {
        action.undo();
        this.undoStackPos--;
      }
    },
    redo() {
      const action = this.undoStack[this.undoStackPos + 1];
      if (action) {
        action.redo();
        this.undoStackPos++;
      }
    },
    cut() {
      this.set_clipboard(this.get_selections());
      this.remove();
    },
    copy() {
      this.set_clipboard(this.get_selections());
    },
    paste() {
      this.add(this.get_clipboard());
    },
    remove() {
      const paths = [] as EntryPathEntry[][];
      const selections = this.get_selections();
      if (!selections.length) return;
      const first = selections[0];
      const catalogue = first instanceof Catalogue ? first : first.catalogue;
      for (const selected of selections) {
        if (selected.catalogue !== catalogue) continue;
        const path = getEntryPath(selected);
        if (path.length) {
          paths.push(path);
        }
      }
      let removeds = [] as EditorBase[][];
      function redo() {
        removeds = [];
        for (const path of paths) {
          const removed = popAtEntryPath(catalogue, path);
          removeds.push(removed);
          onRemoveEntry(removed);
        }
      }
      function undo() {
        for (const [path, entry] of enumerate_zip(paths, removeds)) {
          const parent = setAtEntryPath(catalogue, path, entry);
          onAddEntry(entry, catalogue, parent);
        }
      }
      this.do_action("remove", undo, redo);
      this.unselect();
    },
    add(data: EditorBase[], childKey?: string) {
      const selections = this.get_selections();
      if (!selections.length) return;

      const first = selections[0];
      const catalogue = first instanceof Catalogue ? first : first.catalogue;

      let paths = [];
      let addeds = [] as EditorBase[];

      function redo() {
        addeds = [];
        for (const item of selections) {
          for (const entry of data) {
            // Create array to put the childs in
            const key = childKey || entry.parentKey;
            if (!(item as any)[key]) (item as any)[key] = [];
            const arr = item[key as keyof Base];

            // Copy to not affect existing
            if (!Array.isArray(arr)) continue;
            const copy = JSON.parse(entryToJson(entry));

            // Initialize classes from the json
            setPrototypeRecursive({ [key]: copy });

            onAddEntry(copy, catalogue, item);
            arr.push(copy);
            addeds.push(copy);
          }
        }
      }
      function undo() {
        for (const entry of addeds) {
          popAtEntryPath(catalogue, getEntryPath(entry));
        }
      }
      this.do_action("add", undo, redo);
    },
  },
});
