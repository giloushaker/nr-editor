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
  getTypeLabel,
  replaceAtEntryPath,
} from "~/assets/shared/battlescribe/bs_editor";
import { enumerate_zip, generateBattlescribeId, textSearchRegex } from "~/assets/shared/battlescribe/bs_helpers";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { entries } from "assets/json/entries";
import { Base, Link, entryToJson } from "~/assets/shared/battlescribe/bs_main";
import { setPrototypeRecursive } from "~/assets/shared/battlescribe/bs_main_types";
import { GameSystemFiles, saveCatalogue } from "~/assets/ts/systems/game_system";
import { useCataloguesStore } from "./cataloguesState";
import { getDataDbId, getDataObject } from "~/assets/shared/battlescribe/bs_system";
import { db } from "~/assets/ts/dexie";
import { BSIData } from "~/assets/shared/battlescribe/bs_types";
import { getFolderFiles } from "~/electron/node_helpers";
import type { Router } from "vue-router";
import { convertToJson, getExtension, isAllowedExtension } from "~/assets/shared/battlescribe/bs_convert";
export interface IEditorStore {
  selectionsParent?: Object | null;
  selections: { obj: any; onunselected: () => unknown; payload?: any }[];
  selectedElementGroup: any | null;
  selectedElement: any | null;
  selectedItem: any | null;

  filter: string;
  filterRegex: RegExp;
  filtered: EditorBase[];

  undoStack: { type: string; undo: () => unknown; redo: () => unknown }[];
  undoStackPos: number;
  clipboard: EditorBase[];

  mode: "edit" | "references";
  unsavedChanges: Record<string, CatalogueState>;
  gameSystemsLoaded: boolean;
  gameSystems: Record<string, GameSystemFiles>;

  $router?: Router;
  $nextTick?: Promise<any>;
  $nextTickResolve?: (...args: any[]) => unknown;
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
export function get_ctx(el: any): any {
  return el.vnode;
}
export function get_base_from_vue_el(vue_el: any) {
  const p1 = vue_el.$parent;
  if (p1.item) return p1.item;
  const p2 = p1.$parent;
  if (p2.item) return p2.item;
  const p3 = p2.$parent;
  return p3.item;
}
type VueComponent = any;
const editorFields = new Set<string>(["select", "showInEditor", "showChildsInEditor"]);
export const useEditorStore = defineStore("editor", {
  state: (): IEditorStore => ({
    selections: [],
    selectedElementGroup: null,
    selectedElement: null,
    selectedItem: null,

    filter: "",
    filterRegex: RegExp(""),
    filtered: [],

    undoStack: [],
    undoStackPos: -1,

    clipboard: [],

    mode: "edit",

    gameSystems: {},
    gameSystemsLoaded: false,
    unsavedChanges: {} as Record<string, CatalogueState>,
  }),

  actions: {
    async load_systems_from_folder(
      folder: string,
      progress?: (current: number, max: number, msg?: string) => Promise<unknown>
    ) {
      if (!globalThis.electron) {
        throw new Error("Not running in electron");
      }
      const files = await getFolderFiles(folder);
      const result = [] as string[];
      if (files) {
        const result_files = [];
        console.log("Loading", files.length, "files", files);
        const allowed = files.filter((o) => isAllowedExtension(o.name));
        for (const file of allowed) {
          progress && (await progress(result_files.length, allowed.length, file.path));
          const asJson = await convertToJson(file.data, getExtension(file.name));
          const systemId = asJson?.gameSystem?.id;
          const catalogueId = asJson?.catalogue?.id;
          getDataObject(asJson).fullFilePath = file.path;
          if (systemId) {
            result.push(systemId);
            const systemFiles = this.get_system(systemId);
            systemFiles.setSystem(asJson);
          }
          if (catalogueId) {
            const systemFiles = this.get_system(asJson.catalogue.gameSystemId);
            systemFiles.catalogueFiles[catalogueId] = asJson;
          }
          result_files.push(asJson);
        }
        progress && (await progress(result_files.length, allowed.length));
      }
      return result;
    },
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
    set_catalogue_changed(catalogue: Catalogue, state: boolean) {
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
    },
    save_catalogue(catalogue: Catalogue) {
      saveCatalogue(catalogue);
      const cataloguesStore = useCataloguesStore();
      const id = getDataDbId(catalogue);
      cataloguesStore.updateCatalogue(catalogue);
      cataloguesStore.setEdited(id, true);
      const state = this.get_catalogue_state(catalogue);
      state.unsaved = false;
    },
    set_filter(filter: string) {
      this.$state.filter = filter;
      this.filterRegex = textSearchRegex(filter);
    },
    init(vueRouter: Router) {
      (globalThis as any).undo = () => this.undo();
      (globalThis as any).redo = () => this.redo();
      (globalThis as any).remove = () => this.remove();
      this.$router = vueRouter as any;
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
        if (unselected.obj === this.selectedItem) {
          this.selectedItem = null;
        }
      }
    },
    is_el_selected(obj: any) {
      return this.selections.find((o) => o.obj === obj) !== undefined;
    },
    select(obj: VueComponent, onunselected: () => unknown, payload?: any) {
      if (!this.is_el_selected(obj)) {
        this.selections.push({ obj, onunselected, payload });
      }
    },
    is_selected(obj: VueComponent) {
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

    get_selections(): EditorBase[] {
      return this.selections.map((o) => get_base_from_vue_el(o.obj));
    },
    get_selected(): EditorBase | undefined {
      return this.selectedItem && get_base_from_vue_el(this.selectedItem);
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
    duplicate() {
      const selections = this.get_selections();
      if (!selections.length) return;
      const first = selections[0];
      const catalogue = first instanceof Catalogue ? first : first.catalogue;
      let addeds = [] as EditorBase[];

      function redo() {
        addeds = [];
        for (const item of selections) {
          const copy = JSON.parse(entryToJson(item, editorFields));
          if (!item.parent) continue;
          const arr = item.parent[item.parentKey as keyof EditorBase];
          if (!Array.isArray(arr)) {
            throw new Error(`Couldn't duplicate: parent[${item.parentKey}] is not an array`);
          }
          setPrototypeRecursive({ [item.parentKey]: copy });
          scrambleIds(catalogue, copy);
          onAddEntry(copy, catalogue, item.parent);
          arr.push(copy);
          addeds.push(copy);
        }
      }
      function undo() {
        for (const entry of addeds) {
          popAtEntryPath(catalogue, getEntryPath(entry));
        }
      }
      this.do_action("dupe", undo, redo);
      this.set_catalogue_changed(catalogue, true);
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
      this.set_catalogue_changed(catalogue, true);
      this.unselect();
    },
    add(data: (EditorBase | Record<string, any>) | (EditorBase | Record<string, any>)[], childKey?: string) {
      const selections = this.get_selections();
      if (!selections.length) return;
      if (!Array.isArray(data)) data = [data];
      const first = selections[0];
      const catalogue = first.isCatalogue() ? first : first.catalogue;
      let addeds = [] as EditorBase[];
      const redo = () => {
        addeds = [];
        for (const item of selections) {
          for (const entry of data as (EditorBase | Record<string, any>)[]) {
            // Create array to put the childs in
            const key = childKey || entry.parentKey;
            if (!(item as any)[key]) (item as any)[key] = [];
            const arr = item[key as keyof Base];

            // Copy to not affect existing
            if (!Array.isArray(arr)) continue;
            const copy = JSON.parse(entryToJson(entry, editorFields));

            // Initialize classes from the json
            setPrototypeRecursive({ [key]: copy });
            scrambleIds(catalogue, copy);
            onAddEntry(copy, catalogue, item);
            copy.showChildsInEditor = true;
            let parent = copy;
            while (parent) {
              parent.showInEditor = true;
              parent = parent.parent;
            }
            this.filtered.push(copy);
            arr.push(copy);
            addeds.push(copy);
          }
        }
      };
      function undo() {
        for (const entry of addeds) {
          popAtEntryPath(catalogue, getEntryPath(entry));
        }
      }
      this.do_action("add", undo, redo);
      this.set_catalogue_changed(catalogue, true);
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
              ...data,
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
              name: `New ${getTypeLabel(getTypeName(key))}`,
              ...data,
            },
            key
          );
          break;
      }
      this.open_selected();
    },
    can_move(obj: EditorBase) {
      if (obj.isLink()) return false;
      if (!this.move_to_key(obj)) return false;
      return true;
    },
    get_move_targets(obj: EditorBase) {
      const catalogue = obj.catalogue;
      if (!catalogue) return;
      if (obj.isLink()) return;
      if (!this.move_to_key(obj)) return;
      const result = [];
      if (!obj.parentKey.startsWith("shared")) {
        result.push(catalogue);
      }
      result.push(...catalogue.imports);
      return result;
    },
    move_to_key(obj: EditorBase) {
      switch (obj.editorTypeName) {
        case "infoGroup":
          return "sharedInfoGroups";
        case "rule":
          return "sharedRules";
        case "profile":
          return "sharedProfiles";
        case "selectionEntry":
          return "sharedSelectionEntries";
        case "selectionEntryGroup":
          return "sharedSelectionEntryGroups";
        default:
          return "";
      }
    },
    move(obj: EditorBase, from: Catalogue, to: Catalogue) {
      const redo = () => {
        // Get key the object will end up in
        const catalogueKey = this.move_to_key(obj);
        if (!catalogueKey) return;

        // move obj to target
        from.removeFromIndex(obj);
        const copy = JSON.parse(entryToJson(obj, editorFields));
        setPrototypeRecursive({ [catalogueKey]: copy });
        onAddEntry(copy, to, to);
        if (!to[catalogueKey]) {
          to[catalogueKey] = [];
        }
        to[catalogueKey]!.push(copy);

        // replace previous obj with link to moved obj
        if (obj.parentKey === "selectionEntries" || obj.parentKey == "selectionEntryGroups") {
          const link: any = {
            targetId: copy.id,
            id: from.generateNonConflictingId(),
            type: obj.editorTypeName,
            name: obj.getName(),
            hidden: obj.hidden,
            collective: obj.collective,
            select: true,
          };

          setPrototypeRecursive({ ["entryLinks"]: link });
          replaceAtEntryPath(from, getEntryPath(obj), link);
          onAddEntry(link, from, from);
        } else {
          popAtEntryPath(from, getEntryPath(obj));
        }
      };
      function undo() {
        // undo
        // replace obj path with obj
        // delete obj from target
        // update obj
      }
      this.do_action("move", undo, redo);
      this.set_catalogue_changed(from, true);
      this.set_catalogue_changed(to, true);
    },
    allowed_children(obj: EditorBase, key: string): Set<string> {
      let result = (entries as any)[key]?.allowedChildrens;
      while (typeof result === "string") {
        const new_key = (obj as any)[result];
        if (typeof new_key !== "string" || new_key === result) {
          return new Set();
        }
        result = (entries as any)[new_key].allowedChildrens;
      }
      return new Set(result);
    },
    async open(obj: EditorBase, closeLast?: boolean) {
      let current = document.getElementById("editor-entries") as Element;
      if (!current) {
        return;
      }

      async function open_el(el: any) {
        const context = get_ctx(el);
        context.open();
        await context.$nextTick();
      }
      async function close_el(el: any) {
        const context = get_ctx(el);
        context.close();
        await context.$nextTick();
      }

      const path = getEntryPath(obj);
      if (!path?.length) {
        return;
      }
      current = current.getElementsByClassName(`depth-0 ${path[0].key}`)[0];
      await open_el(current);
      const nodes = [] as EditorBase[];
      forEachParent(obj, (parent) => {
        nodes.push(parent);
      });
      nodes.pop(); // pop catalogue
      nodes.reverse();
      nodes.push(obj);
      const last = nodes[nodes.length - 1];
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const childs = current.getElementsByClassName(`depth-${i + 1} ${node.parentKey}`);
        const child = [...childs].find((o) => get_base_from_vue_el(get_ctx(o)) === node);
        if (!child) {
          // console.error("Invalid path", path);
          throw new Error("Invalid path");
        }
        current = child;
        if (node !== last) {
          await open_el(current);
        }
        if (node === last && closeLast) {
          await close_el(current);
        }
      }

      return current;
    },
    async goto(obj: EditorBase) {
      const targetCatalogue = obj.isCatalogue() ? obj : obj.catalogue;
      if (!this.$router) {
        console.warn("Cannot follow link to another catalogue without $router set");
        return;
      }
      const curId = this.$router.currentRoute.query?.id || this.$router.currentRoute.query?.systemId;
      if (targetCatalogue.id !== curId) {
        const id = targetCatalogue.id;
        const systemId = targetCatalogue.gameSystemId || id;
        this.$router.push({
          name: "catalogue",
          query: { systemId, id },
        });

        this.$nextTick = new Promise((resolve, reject) => {
          this.$nextTickResolve = resolve;
        });
        await this.$nextTick;
      }

      const el = await this.open(obj as EditorBase);
      if (el) {
        const context = get_ctx(el);
        this.do_select(null, context, context);
        el.scrollIntoView({
          behavior: "instant",
          block: "center",
          inline: "center",
        });
      }
    },
    async follow(obj?: EditorBase & Link) {
      if (obj?.target) {
        await this.goto(obj.target as EditorBase);
      }
    },
  },
});
