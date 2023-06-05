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
  fixKey,
} from "~/assets/shared/battlescribe/bs_editor";
import {
  enumerate_zip,
  generateBattlescribeId,
  removeSuffix,
  textSearchRegex,
} from "~/assets/shared/battlescribe/bs_helpers";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { entries } from "assets/json/entries";
import { Base, Link, entriesToJson, entryToJson, goodJsonKeys } from "~/assets/shared/battlescribe/bs_main";
import { setPrototypeRecursive } from "~/assets/shared/battlescribe/bs_main_types";
import { GameSystemFiles, saveCatalogue } from "~/assets/ts/systems/game_system";
import { useCataloguesStore } from "./cataloguesState";
import { getDataDbId, getDataObject } from "~/assets/shared/battlescribe/bs_system";
import { db } from "~/assets/ts/dexie";
import type { BSIData, BSIDataSystem } from "~/assets/shared/battlescribe/bs_types";
import type { Router } from "vue-router";
import { createFolder, getFolderFiles } from "~/electron/node_helpers";
import { convertToJson, getExtension, isAllowedExtension } from "~/assets/shared/battlescribe/bs_convert";
import CatalogueVue from "~/pages/catalogue.vue";
import { LeftPanelDefaults } from "~/components/catalogue/left_panel/LeftPanel.vue";
import { EditorUIState, useEditorUIState } from "./editorUIState";
import { useUIState } from "./uiState";

type CatalogueComponentT = InstanceType<typeof CatalogueVue>;

export interface IEditorStore {
  selectionsParent?: Object | null;
  selections: { obj: any; onunselected: () => unknown; payload?: any }[];
  selectedElementGroup: VueComponent[] | null;
  selectedElement: VueComponent | null;
  selectedItem: any | null;

  filter: string;
  filterRegex: RegExp;
  filtered: EditorBase[];

  historyStack: Array<EditorUIState | null>;
  historyStackPos: number;

  undoStack: { type: string; undo: () => unknown; redo: () => unknown }[];
  undoStackPos: number;
  clipboard: Array<EditorBase | Record<string, any> | string>;

  mode: "edit" | "references";
  clipboardmode: "json" | "none";
  gameSystemsLoaded: boolean;
  gameSystems: Record<string, GameSystemFiles>;

  unsavedCount: number;
  unsavedChanges: Record<string, CatalogueState>;

  catalogueComponent?: CatalogueComponentT;
  $router?: Router;
  $nextTick?: Promise<any>;
  $nextTickResolve?: (...args: any[]) => unknown;
}
export type MaybeArray<T> = T | Array<T>;
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

    historyStack: [],
    historyStackPos: -1,

    clipboard: [],

    mode: "edit",
    clipboardmode: "json",

    gameSystems: {},
    gameSystemsLoaded: false,
    unsavedChanges: {} as Record<string, CatalogueState>,

    unsavedCount: 0,
  }),

  actions: {
    async create_system(name: string, path?: string) {
      console.log("Creating system with name:", name);
      const id = `sys-${generateBattlescribeId()}`;
      const files = this.get_system(id);
      const folder = path ? `${removeSuffix(path.replaceAll("\\", "/"), "/")}/${name}` : "";

      if (electron) {
        if (!folder) {
          throw new Error("No folder specified");
        }
        createFolder(folder);
      }
      const data = {
        gameSystem: {
          id: id,
          name: name,
          battleScribeVersion: "2.03",
          revision: 1,
        },
      } as BSIDataSystem;

      if (folder) {
        data.gameSystem.fullFilePath = `${folder}/${name}.gst`;
      }
      files.setSystem(data);

      saveCatalogue(data.gameSystem);
      return files;
    },
    async load_systems_from_folder(
      folder: string,
      progress?: (current: number, max: number, msg?: string) => Promise<unknown>
    ) {
      if (!globalThis.electron) {
        throw new Error("Not running in electron");
      }
      const cataloguesStore = useCataloguesStore();
      const files = await getFolderFiles(folder);
      const result = [] as string[];
      const systems = [] as GameSystemFiles[];
      if (files) {
        const result_files = [];
        console.log("Loading", files.length, "files", files);
        const allowed = files.filter((o) => isAllowedExtension(o.name));
        for (const file of allowed) {
          const json = await convertToJson(file.data, file.name.endsWith("json") ? "json" : "xml");

          const systemId = json?.gameSystem?.id;
          const catalogueId = json?.catalogue?.id;
          const obj = getDataObject(json);
          const state = this.get_catalogue_state(json);
          if (state) {
            state.changed = false;
            state.unsaved = false;
          }
          const id = getDataDbId(json);
          cataloguesStore.updateCatalogue(json);
          cataloguesStore.setEdited(id, false);

          obj.fullFilePath = file.path.replaceAll("\\", "/");
          if (systemId) {
            result.push(systemId);
            const systemFiles = this.get_system(systemId);
            systems.push(systemFiles);
            systemFiles.setSystem(json);
            systemFiles.unloadAll();
          }
          if (catalogueId) {
            const systemFiles = this.get_system(json.catalogue.gameSystemId);
            systemFiles.catalogueFiles[catalogueId] = json;
          }
          result_files.push(json);
          progress && (await progress(result_files.length, allowed.length, file.path));
        }
        progress && (await progress(result_files.length, allowed.length));
      }
      for (const system of systems) {
        // await system.loadAll();
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
      if (state) {
        this.unsavedChanges[id].changed = true;
        if (!this.unsavedChanges[id].unsaved) {
          this.unsavedCount += 1;
          this.unsavedChanges[id].unsaved = state;
        }
      } else {
        this.unsavedChanges[id].unsaved = state;
      }
    },
    save_catalogue(catalogue: Catalogue) {
      saveCatalogue(catalogue);
      const cataloguesStore = useCataloguesStore();
      const id = getDataDbId(catalogue);
      cataloguesStore.updateCatalogue(catalogue);
      cataloguesStore.setEdited(id, true);
      const state = this.get_catalogue_state(catalogue);
      if (state.unsaved) {
        this.unsavedCount--;
        state.unsaved = false;
      }
    },
    set_filter(filter: string) {
      this.$state.filter = filter;
      this.filterRegex = textSearchRegex(filter);
    },
    init(component: any) {
      const casted = component as CatalogueComponentT;
      if (casted.$router) {
        this.$router = casted.$router as any;
      }
      this.catalogueComponent = casted;
      (globalThis as any).$store = this;
    },
    rerender_catalogue() {
      if (this.catalogueComponent) {
        this.catalogueComponent.key += 1;
      }
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
    do_select(e: MouseEvent | null, el: VueComponent, group: VueComponent | VueComponent[]) {
      const entries = Array.isArray(group) ? group : [group];
      const last = this.selectedElementGroup;
      const last_element = this.selectedElement;
      this.selectedElement = el;
      this.selectedElementGroup = group;

      if (e?.shiftKey && toRaw(group) === toRaw(last)) {
        const a = entries.findIndex((o) => o === toRaw(last_element));
        const b = entries.findIndex((o) => o === toRaw(this.selectedElement));
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
    do_rightclick_select(e: MouseEvent, el: VueComponent, group: VueComponent | VueComponent[]) {
      if (this.is_selected(el)) return;
      this.do_select(e, el, group);
    },

    get_selections(): EditorBase[] {
      return this.selections.map((o) => get_base_from_vue_el(o.obj));
    },
    get_selections_with_payload(): Array<{ obj: EditorBase; payload: any }> {
      return this.selections.map((o) => ({ obj: get_base_from_vue_el(o.obj), payload: o.payload }));
    },
    get_selected(): EditorBase | undefined {
      return this.selectedItem && get_base_from_vue_el(this.selectedItem);
    },
    async do_action(type: string, undo: () => void | Promise<void>, redo: () => void | Promise<void>) {
      await redo();

      if (this.undoStackPos < this.undoStack.length) {
        const n_to_remove = this.undoStack.length - this.undoStackPos - 1;
        this.undoStack.splice(this.undoStackPos + 1, n_to_remove, { type, undo, redo });
      } else {
        this.undoStack.push({ type, undo, redo });
      }
      this.undoStackPos += 1;
    },
    async set_clipboard(data: EditorBase[], event?: ClipboardEvent) {
      if (this.clipboardmode === "json") {
        //@ts-ignore
        const shallowCopies = data.map((o) => ({ parentKey: o.parentKey, ...o })) as EditorBase[];
        const json = entriesToJson(shallowCopies, new Set(["parentKey"]), { forceArray: false });
        if (event) {
          event.clipboardData?.setData("text/plain", json);
        } else {
          await navigator.clipboard.writeText(json);
        }
      } else {
        this.clipboard = data;
      }
    },
    async get_clipboard(event?: ClipboardEvent) {
      if (this.clipboardmode === "json") {
        if (event) {
          const text = event.clipboardData?.getData("text/plain");
          if (!text) return [];
          return JSON.parse(text);
        } else {
          const text = await navigator.clipboard.readText();
          return JSON.parse(text);
        }
      }
      return this.clipboard;
    },
    clear_clipboard() {
      this.clipboard = [];
    },
    async undo() {
      const action = this.undoStack[this.undoStackPos];
      if (action) {
        await action.undo();
        this.undoStackPos--;
      }
    },
    async redo() {
      const action = this.undoStack[this.undoStackPos + 1];
      if (action) {
        await action.redo();
        this.undoStackPos++;
      }
    },
    async cut(event: ClipboardEvent) {
      await this.set_clipboard(this.get_selections(), event);
      this.remove();
    },
    async copy(event: ClipboardEvent) {
      await this.set_clipboard(this.get_selections(), event);
    },
    async paste(event: ClipboardEvent) {
      this.add(await this.get_clipboard(event));
    },
    async duplicate() {
      const selections = this.get_selections();
      if (!selections.length) return;
      const catalogue = selections[0].getCatalogue();
      const sysId = catalogue.getSystemId();

      let addeds = [] as EditorBase[];

      const redo = async () => {
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
          await onAddEntry(copy, catalogue, item.parent, this.get_system(sysId));
          arr.push(copy);
          addeds.push(copy);
        }
      };
      const undo = () => {
        for (const entry of addeds) {
          popAtEntryPath(catalogue, getEntryPath(entry));
        }
      };
      await this.do_action("dupe", undo, redo);
      this.set_catalogue_changed(catalogue, true);
    },
    async remove() {
      const selections = this.get_selections();
      if (!selections.length) return;
      const catalogue = selections[0].getCatalogue();
      const sysId = catalogue.getSystemId();
      let entries = [] as EditorBase[];
      for (const selected of selections) {
        if (selected.catalogue !== catalogue) continue;
        entries.push(selected);
      }

      let paths = [] as EntryPathEntry[][];
      let removeds = [] as EditorBase[];
      const redo = async () => {
        const temp = entries;
        const manager = this.get_system(sysId);
        removeds = [];
        paths = [];
        for (const entry of temp) {
          const path = getEntryPath(entry);
          const removed = popAtEntryPath(catalogue, path);
          removeds.push(removed);
          paths.push(path);
          await onRemoveEntry(removed, manager);
        }
        removeds.reverse();
        paths.reverse();
      };
      const undo = async () => {
        for (const [path, entry] of enumerate_zip(paths, removeds)) {
          const parent = setAtEntryPath(catalogue, path, entry);
          await onAddEntry(entry, catalogue, parent, this.get_system(sysId));
        }
      };
      await this.do_action("remove", undo, redo);
      this.set_catalogue_changed(catalogue, true);
      this.unselect();
    },
    async add(data: MaybeArray<EditorBase | Record<string, any>>, childKey?: keyof Base) {
      const selections = this.get_selections_with_payload();
      if (!selections.length) return;

      const entries = (Array.isArray(data) ? data : [data]) as Array<EditorBase | Record<string, any> | string>;
      if (!entries.length) return;

      const catalogue = selections[0].obj.getCatalogue();
      const sysId = catalogue.getSystemId();

      let addeds = [] as EditorBase[];
      const redo = async () => {
        addeds = [];
        for (const selection of selections) {
          const item = selection.obj;
          const selectedCatalogueKey = selection.payload;
          await this.open(item, true);
          for (const entry of entries as Record<string, any>[]) {
            // Ensure there is array to put the childs in
            const key = fixKey(item, childKey || entry.parentKey, selectedCatalogueKey);
            if (!key) continue;
            if (!item[key as keyof Base]) (item as any)[key] = [];
            const arr = item[key as keyof Base];
            if (!Array.isArray(arr)) continue;

            // Copy to not affect existing
            const json = entry instanceof Base ? entryToJson(entry, editorFields) : JSON.stringify(entry);
            const copy = JSON.parse(json);
            delete copy.parentKey;

            // Initialize classes from the json
            setPrototypeRecursive({ [key]: copy });
            scrambleIds(catalogue, copy);
            await onAddEntry(copy, catalogue, item, this.get_system(sysId));

            // Show the newly added entries even if there is a search filter
            copy.showChildsInEditor = true;
            let cur = copy;
            while (cur) {
              cur.showInEditor = true;
              cur = cur.parent;
            }
            this.filtered.push(copy);

            arr.push(copy);
            addeds.push(copy);
          }
        }
      };
      const undo = () => {
        for (const entry of addeds) {
          popAtEntryPath(catalogue, getEntryPath(entry));
        }
      };
      await this.do_action("add", undo, redo);
      this.set_catalogue_changed(catalogue, true);
    },
    open_selected() {
      for (const el of this.selections as any[]) {
        el.obj.open();
      }
    },
    get_initial_object(key: string & keyof Base) {
      switch (key) {
        case "repeats":
          return {
            value: 1,
            repeats: 1,
            field: "selections",
            scope: "parent",
            id: generateBattlescribeId(),
            childId: "any",
          };
        case "constraints":
          return {
            type: "min",
            value: 1,
            field: "selections",
            scope: "parent",
            id: generateBattlescribeId(),
          };
        case "conditions":
          return {
            type: "atLeast",
            value: 1,
            field: "selections",
            scope: "parent",
            childId: "any",
            id: generateBattlescribeId(),
          };
        case "modifiers":
          return {
            type: "set",
            value: true,
            field: "hidden",
          };
        case "modifierGroups":
        case "conditionGroups":
          return { type: "and" };
        case "sharedSelectionEntries":
        case "selectionEntries":
          return {
            type: "upgrade",
            import: true,
            name: `New ${getTypeLabel(getTypeName(key))}`,
          };
        case "entryLinks":
          return {
            import: true,
            name: `New ${getTypeLabel(getTypeName(key))}`,
          };
        default:
          return {
            name: `New ${getTypeLabel(getTypeName(key))}`,
          };
      }
    },
    async create(key: string & keyof Base, data?: any) {
      const obj = {
        ...this.get_initial_object(key),
        id: generateBattlescribeId(),
        select: true,
        ...data,
      };
      await this.add(obj, key);
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
    async move(obj: EditorBase, from: Catalogue, to: Catalogue) {
      const redo = async () => {
        // Get key the object will end up in
        const catalogueKey = this.move_to_key(obj);
        if (!catalogueKey) return;

        // move obj to target
        from.removeFromIndex(obj);
        const copy = JSON.parse(entryToJson(obj, editorFields));

        setPrototypeRecursive({ [catalogueKey]: copy });
        await onAddEntry(copy, to, to, this.get_system(to.getSystemId()));
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
          const path = getEntryPath(obj);
          path[path.length - 1].key = "entryLinks";
          replaceAtEntryPath(from, path, link);
          await onAddEntry(link, from, from, this.get_system(from.getSystemId()));
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
      await this.do_action("move", undo, redo);
      this.set_catalogue_changed(from, true);
      this.set_catalogue_changed(to, true);
    },
    allowed_children(obj: EditorBase, key: string): Array<string> {
      let result = (entries as any)[key]?.allowedChildrens;
      while (typeof result === "string") {
        const new_key = (obj as any)[result];
        if (typeof new_key !== "string" || new_key === result) {
          return [];
        }
        result = (entries as any)[new_key].allowedChildrens;
      }
      return result;
    },
    async open(obj: EditorBase, last?: boolean) {
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
      const lastNode = nodes[nodes.length - 1];
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const childs = current.getElementsByClassName(`depth-${i + 1} ${node.parentKey}`);
        const child = [...childs].find((o) => get_base_from_vue_el(get_ctx(o)) === node);
        if (!child) {
          // console.error("Invalid path", path);
          throw new Error("Invalid path");
        }
        current = child;
        if (node !== lastNode) {
          await open_el(current);
        }
        if (node === lastNode && last === false) {
          await close_el(current);
        } else if (node === lastNode && last === true) {
          await open_el(current);
        }
      }

      return current;
    },
    /**
     *  Changes the current route to be the catalogue provided
     *  Returns true if the route changed
     */
    async goto_catalogue(id: string, systemId?: string) {
      if (!this.$router) {
        throw new Error("Cannot follow link to another catalogue without $router set");
      }
      const curId = this.$router.currentRoute.query?.id || this.$router.currentRoute.query?.systemId;
      if (id !== curId) {
        this.$router.push({
          name: "catalogue",
          query: { systemId: systemId || id, id: id },
        });

        this.$nextTick = new Promise((resolve, reject) => {
          this.$nextTickResolve = resolve;
        });
        await this.$nextTick;
        return true;
      }
      return false;
    },
    async goto(obj: EditorBase) {
      const targetCatalogue = obj.getCatalogue();
      this.put_current_state_in_history();
      const uistate = useEditorUIState();
      uistate.get_data(targetCatalogue.id).selection = getEntryPath(obj);
      await this.goto_catalogue(targetCatalogue.id, targetCatalogue.gameSystemId);

      const el = await this.open(obj as EditorBase);
      if (el) {
        const context = get_ctx(el);
        this.do_select(null, context, context);
        el.scrollIntoView({
          behavior: "instant",
          block: "center",
          inline: "center",
        });
      } else {
        setTimeout(async () => {
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
        }, 50);
      }
    },
    async follow(obj?: EditorBase & Link) {
      if (obj?.target) {
        await this.goto(obj.target as EditorBase);
      }
    },
    async move_up(obj: EditorBase) {
      if (obj.parent) {
        const arr = obj.parent[obj.parentKey] as EditorBase[];
        const index = arr.indexOf(obj);
        if (index > 0) {
          const temp = arr.splice(index, 1)[0];
          arr.splice(index - 1, 0, temp);
        }
      }
    },
    async move_down(obj: EditorBase) {
      if (obj.parent) {
        const arr = obj.parent[obj.parentKey] as EditorBase[];
        const index = arr.indexOf(obj);
        if (index >= 0 && index < arr.length - 1) {
          const temp = arr.splice(index, 1)[0];
          arr.splice(index + 1, 0, temp);
        }
      }
    },
    get_leftpanel_open_collapsible_boxes() {
      function find_open_recursive(elt: Element, obj: Record<string, any>, depth = 0) {
        const cls = `depth-${depth} collapsible-box opened`;
        const results = elt.getElementsByClassName(cls);
        if (!results?.length) return;
        for (const cur of results) {
          const item = get_base_from_vue_el(get_ctx(cur));
          const key = item.parentKey;
          const parent = item.parent;

          if (parent) {
            if (!parent[key]) continue;
            const index = parent[key].indexOf(item);
            if (!(key in obj)) obj[key] = {};
            if (!(index in obj[key])) obj[key][index] = {};
            find_open_recursive(cur, obj[key][index], depth + 1);
          } else {
            const keys = [...cur.classList].filter((o) => goodJsonKeys.has(o));
            for (const key of keys) {
              obj[key] = {};
              obj[key][0] = {};
            }
            find_open_recursive(cur, obj[keys[0]][0], depth + 1);
          }
        }
      }
      const result = {};
      find_open_recursive(document.documentElement, result);
      return result;
    },
    get_leftpanel_state() {
      if (!this.catalogueComponent) return {};
      const leftpanelstate = {} as Record<string, any>;
      const leftpanel = this.catalogueComponent.$refs.leftpanel as typeof LeftPanelDefaults;
      for (const key of Object.keys(LeftPanelDefaults) as (keyof typeof LeftPanelDefaults)[]) {
        leftpanelstate[key] = leftpanel[key];
      }
      return leftpanelstate as typeof LeftPanelDefaults;
    },
    get_current_state(): EditorUIState {
      const selected = this.get_selected();
      const catalogue = this.catalogueComponent?.cat;
      return {
        ...this.get_leftpanel_state(),
        open: this.get_leftpanel_open_collapsible_boxes(),
        selection: selected ? getEntryPath(selected) : undefined,
        catalogueId: catalogue?.id,
        systemId: catalogue?.gameSystemId,
      };
    },
    save_state() {
      if (this.catalogueComponent && this.catalogueComponent.cat) {
        const id = this.catalogueComponent.cat.id;
        const uistate = useEditorUIState();
        const state = this.get_current_state();
        uistate.set_state(id, state);
      }
    },
    async load_state(state: EditorUIState) {
      if (this.catalogueComponent) {
        useEditorUIState().set_state(state.catalogueId!, state);
        if (await this.goto_catalogue(state.catalogueId!, state.systemId)) {
        } else {
          this.catalogueComponent.load_state(state);
          this.rerender_catalogue();
        }
      }
    },
    put_state_in_history(state: EditorUIState) {
      if (this.historyStackPos < this.historyStack.length) {
        const n_to_remove = this.historyStack.length - this.historyStackPos - 1;
        this.historyStack.splice(this.historyStackPos + 1, n_to_remove, state, null);
      } else {
        this.historyStack.push(state);
      }
      this.historyStackPos = this.historyStack.length - 1;
    },
    put_current_state_in_history() {
      if (this.catalogueComponent && this.catalogueComponent.cat) {
        this.put_state_in_history(this.get_current_state());
      }
    },
    can_back() {
      return this.historyStackPos > 0;
    },
    async back() {
      if (this.can_back()) {
        this.historyStack[this.historyStackPos] = this.get_current_state();
        this.historyStackPos -= 1;
        this.load_state(this.historyStack[this.historyStackPos]!);
      }
    },
    can_forward() {
      if (this.historyStack[this.historyStack.length - 1]) {
        return this.historyStackPos < this.historyStack.length - 1;
      }
      return this.historyStackPos < this.historyStack.length - 2;
    },
    async forward() {
      if (this.can_forward()) {
        this.historyStackPos += 1;
        this.load_state(this.historyStack[this.historyStackPos]!);
      }
    },
  },
});
