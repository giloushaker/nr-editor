import { VueElement } from "nuxt/dist/app/compat/capi";
import { defineStore } from "pinia";
import {
  ItemKeys,
  ItemTypes,
  EntryPathEntry,
  getEntryPath,
  onAddEntry,
  onRemoveEntry,
  popAtEntryPath,
  setAtEntryPath,
  scrambleIds,
  getTypeName,
  forEachParent,
} from "~/assets/shared/battlescribe/bs_editor";
import { enumerate_zip, generateBattlescribeId, textSearchRegex } from "~/assets/shared/battlescribe/bs_helpers";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { entries } from "assets/json/entries";
import { Base, Link, entryToJson } from "~/assets/shared/battlescribe/bs_main";
import { setPrototypeRecursive } from "~/assets/shared/battlescribe/bs_main_types";
import { GameSystemFiles, saveCatalogue } from "~/assets/ts/systems/game_system";
import { useCataloguesStore } from "./cataloguesState";
import { getDataDbId } from "~/assets/shared/battlescribe/bs_system";
import { db } from "~/assets/ts/dexie";
import { BSIData } from "~/assets/shared/battlescribe/bs_types";

export interface IEditorState {
  selectionsParent?: Object | null;
  selections: { obj: any; onunselected: () => unknown; payload?: any }[];
  selectedElementGroup: any | null;
  selectedElement: any | null;
  selectedItem: any | null;
  filter: string;
  filterRegex: RegExp;
  undoStack: { type: string; undo: () => unknown; redo: () => unknown }[];
  undoStackPos: number;
  clipboard: EditorBase[];
  mode: "edit" | "references";
  gameSystemsLoaded: boolean;
  gameSystems: Record<string, GameSystemFiles>;
  unsavedChanges: Record<string, CatalogueState>;
}

export interface CatalogueEntryItem {
  item: ItemTypes & EditorBase;
  type: ItemKeys;
  imported?: boolean;
}
export interface CatalogueState {
  changed: boolean;
  unsaved: boolean;
  savingPromise?: Promise<any>;
}
export const useEditorStore = defineStore("editor", {
  state: (): IEditorState => ({
    selections: [],
    selectedElementGroup: null,
    selectedElement: null,
    selectedItem: null,

    filter: "",
    filterRegex: RegExp(""),

    undoStack: [],
    undoStackPos: -1,

    clipboard: [],

    mode: "edit",

    gameSystems: {},
    gameSystemsLoaded: false,
    unsavedChanges: {} as Record<string, CatalogueState>,
  }),

  actions: {
    async load_system_from_db(id: string) {
      const dbsystem = await db.systems.get(id);
      const system = dbsystem?.content;
      if (!system) {
        throw new Error("System not found " + id);
      }
      const dbcatalogues = await db.catalogues.where({ "content.catalogue.gameSystemId": id });
      const dbcataloguesarr = await dbcatalogues.toArray();
      const catalogues = dbcataloguesarr.map((o) => o.content);

      const systemFiles = this.get_system(system.gameSystem.id);
      systemFiles.setSystem(system);
      for (let catalogue of catalogues) {
        const catalogueId = catalogue.catalogue.id;
        systemFiles.catalogueFiles[catalogueId] = catalogue;
      }
    },
    async load_systems_from_db(force = false) {
      if (!this.gameSystemsLoaded && !force) {
        this.gameSystemsLoaded = true;
        let systems = await db.systems.offset(0).keys();
        for (let system of systems) {
          this.load_system_from_db(system as string);
        }
      }
    },
    async get_or_load_system(id: string) {
      if (!(id in this.gameSystems)) {
        this.gameSystems[id] = new GameSystemFiles();
        await this.load_system_from_db(id);
      }
      return this.gameSystems[id];
    },
    get_system(id: string) {
      if (!(id in this.gameSystems)) {
        this.gameSystems[id] = new GameSystemFiles();
      }
      return this.gameSystems[id];
    },
    get_catalogue_state(catalogue: BSIData | Catalogue) {
      const id = getDataDbId(catalogue);
      return this.unsavedChanges[id];
    },
    set_catalogue_state(catalogue: Catalogue, state: boolean) {
      const id = getDataDbId(catalogue);
      if (!(id in this.unsavedChanges)) {
        this.unsavedChanges[id] = {
          changed: false,
          unsaved: false,
        };
      }
      this.unsavedChanges[id].unsaved = state;
      if (state) {
        this.unsavedChanges[id].changed = true;
      }

      const obj = this.unsavedChanges[id];
    },
    save_catalogue(catalogue: Catalogue) {
      saveCatalogue(catalogue, catalogue as any);
      const cataloguesStore = useCataloguesStore();
      const id = getDataDbId(catalogue);
      cataloguesStore.setEdited(id, true);
      const state = this.get_catalogue_state(catalogue);
      state.unsaved = false;
    },
    set_filter(filter: string) {
      this.$state.filter = filter;
      this.filterRegex = textSearchRegex(filter);
    },
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
    is_el_selected(obj: any) {
      return this.selections.find((o) => o.obj === obj) !== undefined;
    },
    select(obj: any, onunselected: () => unknown, payload?: any) {
      if (!this.is_el_selected(obj)) {
        this.selections.push({ obj, onunselected, payload });
      }
    },
    is_selected(obj: any) {
      return this.selections.findIndex((o) => o.obj === obj) !== -1;
    },
    do_select(e: MouseEvent | null, el: VueElement, group: VueElement | VueElement[]) {
      const entries = Array.isArray(group) ? group : [group];
      const last = toRaw(this.selectedElementGroup);
      const last_element = toRaw(this.selectedElement);
      this.selectedElement = toRaw(el);
      this.selectedElementGroup = toRaw(group);

      if (e?.shiftKey && toRaw(group) === toRaw(last)) {
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
      if (!e?.ctrlKey && !e?.metaKey) {
        this.unselect();
      }
      if (e?.ctrlKey && this.is_selected(el)) {
        this.unselect(el);
      } else {
        (el as any).select();
        this.selectedItem = el;
        this.mode = "edit";
      }
    },
    do_rightclick_select(e: MouseEvent, el: VueElement, group: VueElement | VueElement[]) {
      if (this.is_selected(el)) return;
      this.do_select(e, el, group);
    },
    get_base_from_vue_el(vue_el: any) {
      return vue_el.$parent.item;
    },
    get_selections(): EditorBase[] {
      return this.selections.map((o) => this.get_base_from_vue_el(o.obj));
    },
    get_selected(): EditorBase | undefined {
      return this.selectedItem?.$parent?.item;
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
    set_clipboard(data: EditorBase[]) {
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
      const selections = this.get_selections();
      if (!selections.length) return;
      const first = selections[0];
      const catalogue = first instanceof Catalogue ? first : first.catalogue;

      let entries = [] as EditorBase[];
      for (const selected of selections) {
        if (selected.catalogue !== catalogue) continue;
        entries.push(selected);
      }
      let paths = [] as EntryPathEntry[][];
      let removeds = [] as EditorBase[];
      function redo() {
        const temp = entries;
        removeds = [];
        paths = [];
        for (const entry of temp) {
          const path = getEntryPath(entry);
          const removed = popAtEntryPath(catalogue, path);
          removeds.push(removed);
          paths.push(path);
          onRemoveEntry(removed);
        }
        removeds.reverse();
        paths.reverse();
      }
      function undo() {
        for (const [path, entry] of enumerate_zip(paths, removeds)) {
          const parent = setAtEntryPath(catalogue, path, entry);
          onAddEntry(entry, catalogue, parent);
        }
      }
      this.do_action("remove", undo, redo);
      this.set_catalogue_state(catalogue, true);
      this.unselect();
    },
    add(data: (EditorBase | Record<string, any>) | (EditorBase | Record<string, any>)[], childKey?: string) {
      const selections = this.get_selections();
      if (!selections.length) return;

      if (!Array.isArray(data)) {
        data = [data];
      }

      const first = selections[0];
      const catalogue = first instanceof Catalogue ? first : first.catalogue;

      let addeds = [] as EditorBase[];

      function redo() {
        addeds = [];
        for (const item of selections) {
          for (const entry of data as (EditorBase | Record<string, any>)[]) {
            // Create array to put the childs in
            const key = childKey || entry.parentKey;
            if (!(item as any)[key]) (item as any)[key] = [];
            const arr = item[key as keyof Base];

            // Copy to not affect existing
            if (!Array.isArray(arr)) continue;
            const copy = JSON.parse(entryToJson(entry));

            // Initialize classes from the json
            setPrototypeRecursive({ [key]: copy });
            scrambleIds(catalogue, copy);
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
      this.set_catalogue_state(catalogue, true);
    },
    open_selected() {
      for (const el of this.selections as any[]) {
        el.obj.open();
      }
    },
    create(key: string, data?: any) {
      switch (key) {
        case "constraints":
        case "conditions":
          this.add(
            {
              type: "min",
              value: 1,
              field: "selections",
              scope: "parent",
              id: generateBattlescribeId(),
              select: true,
              ...data,
            },
            key
          );
          break;
        case "modifiers":
          this.add(
            {
              type: "set",
              value: true,
              field: "hidden",
              id: generateBattlescribeId(),
              select: true,
            },
            key
          );
          break;

        case "modifierGroups":
        case "conditionGroups":
          this.add({ id: generateBattlescribeId(), select: true }, key);
          break;

        default:
          this.add(
            {
              id: generateBattlescribeId(),
              select: true,
              name: `New ${getTypeName(key)}`,
            },
            key
          );
          break;
      }
      this.open_selected();
    },
    allowed_children(obj: EditorBase, key: string): Set<string> {
      let result = (entries as any)[key]?.allowedChildrens;
      while (typeof result === "string") {
        const new_key = (obj as any)[result];
        if (typeof new_key !== "string" || new_key === result) {
          throw new Error("Invalid children key");
        }
        result = (entries as any)[new_key].allowedChildrens;
      }
      return new Set(result);
    },
    async get_el_from_base(obj: EditorBase) {
      let current = document.getElementById("editor-entries") as Element;
      if (!current) {
        return;
      }
      function get_ctx(el: any): any {
        return el.__vnode.ctx.ctx;
      }
      async function open_el(el: any) {
        const context = get_ctx(el);
        context.open();
        await context.$nextTick();
      }

      const path = getEntryPath(obj);
      current = current.getElementsByClassName(`EditorCollapsibleBox ${path[0].key}`)[0];
      await open_el(current);
      const nodes = [] as EditorBase[];
      forEachParent(obj, (parent) => {
        nodes.push(parent);
      });
      const catalogue = nodes.pop();
      nodes.reverse();
      nodes.push(obj);
      const last = nodes[nodes.length - 1];
      for (const node of nodes) {
        const childs = current.getElementsByClassName(`EditorCollapsibleBox ${node.parentKey}`);
        const child = [...childs].find((o) => this.get_base_from_vue_el(get_ctx(o)) === node);
        if (!child) {
          throw new Error("Invalid path");
        }
        current = child;
        if (node !== last) {
          await open_el(current);
        }
      }

      const context = get_ctx(current);
      this.do_select(null, context, context);
      current.scrollIntoView({
        behavior: "instant",
        block: "center",
        inline: "center",
      });
    },
    open(obj: EditorBase) {
      obj.openInEditor = true;
      forEachParent(obj, (parent) => {
        parent.openInEditor = true;
      });
    },
    goto(obj: EditorBase) {
      this.open(obj as EditorBase);
      this.get_el_from_base(obj as EditorBase);
    },
    follow(obj?: EditorBase & Link) {
      if (obj?.target) {
        if (obj.target.catalogue !== obj.catalogue) {
          console.warn("Cannot follow link to another catalogue");
          return;
        }
        this.goto(obj.target as EditorBase);
      }
    },
  },
});
