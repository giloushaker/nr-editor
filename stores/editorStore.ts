import { defineStore } from "pinia";
import {
  ItemKeys,
  ItemTypes,
  EntryPathEntry,
  getEntryPath,
  onAddEntry,
  onRemoveEntry,
  popAtEntryPath,
  addAtEntryPath,
  scrambleIds,
  getTypeName,
  getTypeLabel,
  fixKey,
  removeEntry,
} from "~/assets/shared/battlescribe/bs_editor";
import {
  enumerate_zip,
  generateBattlescribeId,
  removeSuffix,
  textSearchRegex,
  zipCompress,
  forEachParent,
} from "~/assets/shared/battlescribe/bs_helpers";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { Base, Link, entriesToJson, entryToJson, goodJsonKeys, rootToJson } from "~/assets/shared/battlescribe/bs_main";
import { setPrototypeRecursive } from "~/assets/shared/battlescribe/bs_main_types";
import { useCataloguesStore } from "./cataloguesState";
import { getDataObject, getDataDbId } from "~/assets/shared/battlescribe/bs_main";
import type {
  BSICatalogue,
  BSIConstraint,
  BSIData,
  BSIDataCatalogue,
  BSIDataSystem,
  BSIGameSystem,
  BSIProfile,
} from "~/assets/shared/battlescribe/bs_types";
import { createFolder, filename, getFolderFiles, watchFile, writeFile } from "~/electron/node_helpers";
import {
  allowed_children,
  clean,
  convertToJson,
  convertToXml,
  getExtension,
  isAllowedExtension,
  isZipExtension,
} from "~/assets/shared/battlescribe/bs_convert";
import CatalogueVue from "~/pages/catalogue.vue";
import { LeftPanelDefaults } from "~/components/catalogue/left_panel/LeftPanel.vue";
import { EditorUIState, useEditorUIState } from "./editorUIState";
import { db } from "~/assets/shared/battlescribe/cataloguesdexie";
import { getNextRevision } from "~/assets/shared/battlescribe/github";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { toRaw } from "vue";
import { Router } from "vue-router";
type CatalogueComponentT = InstanceType<typeof CatalogueVue>;

export interface IEditorStore {
  selectionsParent?: Object | null;
  selections: { obj: any; onunselected: () => unknown; payload?: any }[];
  selectedElementGroup: VueComponent[] | null;
  selectedElement: VueComponent | null;
  selectedItem: VueComponent | null;

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
/**
 * Get the {@link EditorBase} (from bs_main.ts) out of a Vue component instance (assumed to be an EditorCollapsibleBox.vue).
 *
 * @param {Vue} vue_el - The Vue component instance.
 * @returns {EditorBase}
 */
export function get_base_from_vue_el(vue_el: VueComponent): EditorBase {
  const p1 = vue_el.$parent;
  if (p1.item) return p1.item;
  const p2 = p1.$parent;
  if (p2.item) return p2.item;
  const p3 = p2.$parent;
  return p3.item;
}

function saveCatalogueInDb(data: Catalogue | BSICatalogue | BSIGameSystem) {
  const stringed = rootToJson(data);
  const isCatalogue = Boolean(data.gameSystemId);
  const isSystem = !isCatalogue;
  if (isSystem) {
    db.systems.put({
      content: JSON.parse(stringed),
      path: data.fullFilePath,
      id: data.id,
    });
  } else {
    db.catalogues.put({
      content: JSON.parse(stringed),
      path: data.fullFilePath,
      id: `${data.gameSystemId}-${data.id}`,
    });
  }
}

async function saveCatalogueInFiles(data: Catalogue | BSICatalogue | BSIGameSystem) {
  const path = data.fullFilePath;
  if (!path) {
    console.error(`No path included in the catalogue ${data.name} to save at`);
    return;
  }
  const extension = getExtension(path);
  if (path.endsWith(".json")) {
    const content = rootToJson(data);
    await writeFile(path, content);
  } else {
    const xml = convertToXml(data);
    const shouldZip = isZipExtension(extension);
    const name = filename(path);
    const nameInZip = name.replace(".gstz", ".gst").replace(".catz", ".cat");
    const content = shouldZip ? await zipCompress(nameInZip, xml, "uint8array") : xml;
    await writeFile(path, content);
  }
}

function saveCatalogue(data: Catalogue | BSICatalogue | BSIGameSystem) {
  if (electron) {
    saveCatalogueInFiles(data);
  } else {
    saveCatalogueInDb(data);
  }
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
    historyStackPos: 0,

    clipboard: [],

    mode: "edit",
    clipboardmode: "json",

    gameSystems: {},
    gameSystemsLoaded: false,
    unsavedChanges: {} as Record<string, CatalogueState>,

    unsavedCount: 0,
  }),

  actions: {
    async create_system(name: string, path?: string, extension?: string) {
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
      const data: BSIDataSystem = {
        gameSystem: {
          id: id,
          name: name,
          battleScribeVersion: "2.03",
          revision: 1,
          categoryEntries: [
            {
              name: "Default Category",
              id: "default-category",
            },
          ],
          forceEntries: [
            {
              name: "Default Force",
              hidden: false,
              id: "default-force",
              categoryLinks: [
                {
                  name: "Default Category",
                  hidden: false,
                  id: "default-force-category-link",
                  targetId: "default-category",
                },
              ],
            },
          ],
          selectionEntries: [
            {
              type: "upgrade",
              import: true,
              name: "Default Root Entry",
              hidden: false,
              id: "default-entry",
              categoryLinks: [
                {
                  targetId: "default-category",
                  id: "default-category-link",
                  primary: true,
                  name: "Default Category",
                  hidden: false,
                },
              ],
            },
          ],
        },
      };

      if (folder) {
        data.gameSystem.fullFilePath = `${folder}/${name}.${extension || "gst"}`;
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
      const files = await getFolderFiles(folder);
      if (!files?.length) return;

      console.log("Loading", files.length, "files", files);
      const result_system_ids = [] as string[];
      const result_files = [];
      const systems = [] as GameSystemFiles[];

      const allowed = files.filter((o) => isAllowedExtension(o.name));
      for (const file of allowed) {
        progress && (await progress(result_files.length, allowed.length, file.path));
        const json = await convertToJson(file.data, file.name.endsWith("json") ? "json" : "xml");

        const systemId = json?.gameSystem?.id;
        const catalogueId = json?.catalogue?.id;

        getDataObject(json).fullFilePath = file.path.replaceAll("\\", "/");
        if (systemId) {
          const systemFiles = this.get_system(systemId);
          systemFiles.setSystem(json);
          systems.push(systemFiles);
          result_system_ids.push(systemId);
        }
        if (catalogueId) {
          const systemFiles = this.get_system(json.catalogue.gameSystemId);
          systemFiles.catalogueFiles[catalogueId] = markRaw(json);
        }
        result_files.push(json);
      }
      progress && (await progress(result_files.length, allowed.length));

      for (const system of systems) {
        progress && (await progress(0, 0, "Checking for github integration"));
        await this.load_system(system);
      }

      return result_system_ids;
    },
    async load_systems_from_db(force = false) {
      if (!this.gameSystemsLoaded && !force) {
        this.gameSystemsLoaded = true;
        let systems = (await db.systems.offset(0).keys()) as string[];
        for (let system of systems) {
          if (system in this.gameSystems) continue;
          this.load_system_from_db(system);
        }
      }
    },
    async load_system_from_db(id: string) {
      const dbsystem = await db.systems.get(id);
      const system = dbsystem?.content;
      if (!system) {
        throw new Error("System not found " + id);
      }
      system.gameSystem.fullFilePath = dbsystem.path;

      const dbcatalogues = await db.catalogues.where({ "content.catalogue.gameSystemId": id });
      const systemFiles = this.get_system(system.gameSystem.id);
      systemFiles.setSystem(system);
      for (let { content, path } of await dbcatalogues.toArray()) {
        const catalogueId = content.catalogue.id;
        content.catalogue.fullFilePath = path;
        systemFiles.catalogueFiles[catalogueId] = markRaw(content);
      }
      this.load_system(systemFiles, true);
    },
    async load_system(system: GameSystemFiles, keepState = false) {
      if (system.gameSystem) {
        const cataloguesStore = useCataloguesStore();
        system.unloadAll();
        if (!keepState) {
          for (const catalogue of system.getAllCatalogueFiles()) {
            const state = this.get_catalogue_state(catalogue);
            if (state) {
              state.changed = false;
              state.unsaved = false;
            }
            cataloguesStore.updateCatalogue(getDataObject(catalogue));
            cataloguesStore.setEdited(getDataObject(catalogue).id, false);
          }
        }
        const publications = system.gameSystem.gameSystem.publications;
        const github = publications?.find((o) => o.name?.trim().toLowerCase() === "github");
        if (github && github.shortName?.includes("/") && github.publisherUrl) {
          system.github = {
            githubUrl: github.publisherUrl,
            githubRepo: github.shortName,
            githubOwner: github.shortName?.split("/")[0],
            githubName: github.shortName?.split("/")[1],
          };
        }
      }
      for (const catalogue of system.getAllCatalogueFiles()) {
        const obj = getDataObject(catalogue);
        if (!obj.fullFilePath) {
          continue;
        }
        watchFile(obj.fullFilePath, () => {
          this.on_file_changed(catalogue);
        });
      }
    },
    on_file_changed(file: BSIDataCatalogue | BSIDataSystem) {
      console.log(getDataObject(file).name, "changed");
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
    delete_system(id: string) {
      delete this.gameSystems[id];
    },
    get_catalogue_state(catalogue: BSIData | Catalogue) {
      const id = getDataDbId(catalogue);
      return this.unsavedChanges[id];
    },
    set_catalogue_changed(catalogue: Catalogue | BSIDataCatalogue | BSIDataSystem, state: boolean = true) {
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
    /**
     * Returns true if the revision was incremented
     */
    async save_catalogue(system: GameSystemFiles, catalogue: Catalogue): Promise<boolean> {
      const revision = catalogue.revision;
      if (system.github) {
        catalogue.revision = await getNextRevision(system.github, catalogue);
      }
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
      return catalogue.revision !== revision;
    },

    async save_all(system?: string) {
      let failed = false;
      let incremented = 0;
      try {
        for (const sys of Object.values(this.gameSystems)) {
          if (system && sys.gameSystem?.gameSystem?.id !== system) {
            continue;
          }
          for (const cat of sys.getAllLoadedCatalogues()) {
            if (this.get_catalogue_state(cat)?.unsaved) {
              if (await this.save_catalogue(sys, cat)) {
                incremented += 1;
              }
            }
          }
        }
      } catch (e) {
        failed = true;
      }
      if (incremented) {
        notify(`Incremented ${incremented} catalogue's revision"`);
      }
      return failed;
    },
    set_filter(filter: string) {
      this.$state.filter = filter;
      this.filterRegex = textSearchRegex(filter);
    },
    /**
     * Sets the active `catalogueComponent` so it can be used by functions in the store
     * Its typed as `any` to prevent recursive type
     */
    init(component: any) {
      this.catalogueComponent = component as CatalogueComponentT;
      (globalThis as any).$store = this;
    },
    /**
     * Force the left panel to re-render, used for setting its state by having it reload the saved state
     */
    rerender_catalogue() {
      if (this.catalogueComponent) {
        this.catalogueComponent.key += 1;
      }
    },
    unselect(obj?: VueComponent) {
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
    is_selected(obj: VueComponent) {
      return this.selections.find((o) => o.obj === obj) !== undefined;
    },
    select(obj: VueComponent, onunselected: () => unknown, payload?: any) {
      if (!this.is_selected(obj)) {
        this.selections.push({ obj, onunselected, payload });
      }
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
        el.select();
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
      try {
        await redo();
      } catch (e) {
        console.error(e);
        return;
      }

      if (this.undoStackPos < this.undoStack.length) {
        const n_to_remove = this.undoStack.length - this.undoStackPos - 1;
        this.undoStack.splice(this.undoStackPos + 1, n_to_remove, { type, undo, redo });
      } else {
        this.undoStack.push({ type, undo, redo });
      }
      this.undoStackPos += 1;
    },
    /**
     * Set the content of the clipboard, accepts an event to better conform with browser security/permissions stuff
     * @param data the entries to set in the clipboard, do not use for copying text
     * @param event the event to use, if not provided a valid ClipboardEvent, will use the navigator.clipboard.writeText()
     */
    async set_clipboard(data: EditorBase[], event?: ClipboardEvent) {
      if (this.clipboardmode === "json") {
        //@ts-ignore
        const shallowCopies = data.map((o) => ({ parentKey: o.parentKey, ...o })) as EditorBase[];
        const json = entriesToJson(shallowCopies, new Set(["parentKey"]), { forceArray: false, formatted: true });
        if (event?.clipboardData) {
          event.clipboardData.setData("text/plain", json);
        } else {
          await navigator.clipboard.writeText(json);
        }
      } else {
        this.clipboard = data;
      }
    },
    /**
     * Get the content of the clipboard, accepts an event to better conform with browser security/permissions stuff
     * @param event the event to use, if not provided a valid ClipboardEvent, will use the navigator.clipboard.readText()
     */
    async get_clipboard(event?: ClipboardEvent) {
      if (this.clipboardmode === "json") {
        if (event?.clipboardData) {
          const text = event.clipboardData.getData("text/plain");
          if (!text) return [];
          return JSON.parse(text);
        } else {
          const text = await navigator.clipboard.readText();
          return JSON.parse(text);
        }
      }
      return this.clipboard;
    },
    can_undo() {
      return Boolean(this.undoStack[this.undoStackPos]);
    },
    async undo() {
      const action = this.undoStack[this.undoStackPos];
      if (action) {
        await action.undo();
        this.undoStackPos--;
      }
    },
    can_redo() {
      return Boolean(this.undoStack[this.undoStackPos + 1]);
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
    /**
     * Duplicate the current selections
     */
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
          arr.push(copy);
          await onAddEntry(copy, catalogue, item.parent, this.get_system(sysId));
          addeds.push(copy);
        }
      };
      const undo = () => {
        for (const entry of addeds) {
          popAtEntryPath(catalogue, getEntryPath(entry));
          onRemoveEntry(entry);
        }
      };
      await this.do_action("dupe", undo, redo);
      this.set_catalogue_changed(catalogue, true);
    },
    /**
     * Remove the current selections.
     */
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
          const parent = addAtEntryPath(catalogue, path, entry);
          await onAddEntry(entry, catalogue, parent, this.get_system(sysId));
        }
      };
      await this.do_action("remove", undo, redo);
      this.set_catalogue_changed(catalogue, true);
      this.unselect();
    },
    /**
     *  Adds entries to the current selections, or provided parents.
     * @param data the entries to add. Can be an array of entries, or a single entry.
     * @param childKey the key to use when adding the childs. If not provided, the entries will be added to the parentKey of the first entry.
     * @param parents the parents to use instead of the current selections. If not provided, the current selections will be used.
     */
    async add(
      data: MaybeArray<EditorBase | Record<string, any>>,
      childKey?: keyof Base,
      parents?: EditorBase | EditorBase[]
    ) {
      let parentsWithPayload = [] as Array<{ obj: EditorBase; payload?: string }>;
      if (!parents) {
        parentsWithPayload = this.get_selections_with_payload();
      } else {
        parents = Array.isArray(parents) ? parents : [parents];
        parentsWithPayload = parents.map((o) => ({ obj: o }));
      }
      if (!parentsWithPayload.length) {
        console.error("Couldn't add: no selection or parent(s) provided");
        return;
      }
      const entries = (Array.isArray(data) ? data : [data]) as Array<EditorBase | Record<string, any> | string>;
      if (!entries.length) {
        console.error("Couldn't add: no data provided");
        return;
      }

      const catalogue = parentsWithPayload[0].obj.getCatalogue();
      const sysId = catalogue.getSystemId();

      let addeds = [] as EditorBase[];
      const redo = async () => {
        addeds = [];
        for (const selection of parentsWithPayload) {
          const item = selection.obj;
          const selectedCatalogueKey = selection.payload;
          await this.open(item, true);
          for (const entry of entries as Record<string, any>[]) {
            // Ensure there is array to put the childs in
            const key = fixKey(item, childKey || entry.parentKey, selectedCatalogueKey);
            if (!key) {
              console.warn("Couldn't create", childKey || entry.parentKey, "in", selectedCatalogueKey);
              continue;
            }
            if (!item[key as keyof Base]) (item as any)[key] = [];
            const arr = item[key as keyof Base];
            if (!Array.isArray(arr)) continue;

            if (!allowed_children(item, item.parentKey)?.has(key as string)) {
              console.warn("Couldn't add", key, "to a", item.parentKey, "because it is not allowed");
              continue;
            }
            // Copy to not affect existing
            const json = entry instanceof Base ? entryToJson(entry, editorFields) : JSON.stringify(entry);
            const copy = JSON.parse(json);
            clean(copy, key as string);
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
          onRemoveEntry(entry);
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
    /**
     * Returns the default object when creating a given type
     * @param key the key of the given type (eg: `selectionEntries`)
     * @param parent (optional) the parent, used to modify the initial object conditionally
     */
    get_initial_object(key: string, parent?: EditorBase): any {
      switch (key) {
        case "costTypes":
          return {
            name: `New ${getTypeLabel(getTypeName(key))}`,
            defaultCostLimit: -1,
          };
        case "repeats":
          return {
            value: 1,
            repeats: 1,
            field: "selections",
            scope: "parent",
            childId: "any",
            shared: true,
            roundUp: false,
          };
        case "constraints": {
          const isAssociation = parent?.parentKey === "associations";
          const result = {
            type: "min",
            value: 1,
            field: parent?.isForce() ? "forces" : "selections",
            scope: "parent",
            shared: true,
          } as BSIConstraint;
          if (isAssociation) {
            result.childId = "any";
          }
          return result;
        }
        case "conditions":
          return {
            type: "atLeast",
            value: 1,
            field: "selections",
            scope: "parent",
            childId: "any",
            shared: true,
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
            hidden: false,
          };
        case "entryLinks":
          return {
            import: true,
            name: `New ${getTypeLabel(getTypeName(key))}`,
            hidden: false,
          };
        case "associations":
          return {
            min: 1,
            max: 1,
            scope: "roster",
            includeChildSelections: false,
            of: "any",
            ids: [],
            label: "Association",
            labelMembers: "Unit",
            hidden: false,
          };
        case "sharedProfiles":
        case "profiles":
          const profileType = parent?.catalogue.iterateProfileTypes().next().value;
          const name = !parent || parent?.isCatalogue() ? undefined : parent?.getName();
          return {
            name: name || "New Profile",
            typeId: profileType?.id,
            typeName: profileType?.name,
            hidden: false,
          } as BSIProfile;
        case "catalogueLinks":
          return {
            type: "catalogue",
            name: `New ${getTypeLabel(getTypeName(key))}`,
          };

        case "categoryLinks":
          return {
            type: "category",
            name: `New ${getTypeLabel(getTypeName(key))}`,
            hidden: false,
          };

        default:
          return {
            name: `New ${getTypeLabel(getTypeName(key))}`,
            hidden: false,
          };
      }
    },
    /**
     * Creates child entries in the current selection
     * @param key the key of the child (eg: `selectionEntries`)
     * @param data data to use when creating the child entry
     */
    async create(key: string & keyof Base, data?: any) {
      const obj = {
        ...this.get_initial_object(key),
        select: true,
        ...data,
      };
      if (!["modifiers", "conditions", "modifierGroups", "conditionGroups"].includes(key)) {
        obj.id = generateBattlescribeId();
      }
      await this.add(obj, key);
      this.open_selected();
    },
    /**
     * Creates child entries in the provided parent
     * @param key the key of the child (eg: `selectionEntries`)
     * @param parent the parent to add the child in
     * @param data data to use when creating the child entry
     */
    async create_child(key: string & keyof Base, parent: EditorBase, data?: any) {
      const obj = {
        ...this.get_initial_object(key, parent),
        id: generateBattlescribeId(),
        select: true,
        ...data,
      };
      await this.add(obj, key, parent);
      this.open_selected();
    },
    can_move(obj: EditorBase) {
      if (obj.isLink()) return false;
      return true;
    },
    get_move_targets(obj: EditorBase): Array<{ target: Catalogue; type: "root" | "shared" }> | undefined {
      const catalogue = obj.catalogue;
      if (!catalogue) return;
      if (obj.isLink()) return;
      const result = [] as Array<{ target: Catalogue; type: "root" | "shared" }>;
      if (!obj.parentKey.startsWith("shared") && this.move_to_key(obj, "shared")) {
        result.push({ target: catalogue, type: "shared" });
      } else if (obj.parentKey.startsWith("shared") && this.move_to_key(obj, "root")) {
        result.push({ target: catalogue, type: "root" });
      }
      if (this.move_to_key(obj, "shared")) {
        for (const imported of catalogue.imports) {
          result.push({ target: imported, type: "root" });
          result.push({ target: imported, type: "shared" });
        }
      } else {
        for (const imported of catalogue.imports) {
          result.push({ target: imported, type: "root" });
        }
      }
      return result;
    },
    move_to_key(obj: EditorBase, type: string) {
      if (type === "shared") {
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
      }
      switch (obj.editorTypeName) {
        case "infoGroup":
          return "infoGroups";
        case "rule":
          return "rules";
        case "profile":
          return "profiles";
        case "selectionEntry":
          return "selectionEntries";
        case "selectionEntryGroup":
          return "selectionEntryGroups";
        default:
          return obj.parentKey;
      }
    },
    async move(obj: EditorBase, from: Catalogue, to: Catalogue, type: "root" | "shared") {
      const redo = async () => {
        // Get key the object will end up in
        const catalogueKey = this.move_to_key(obj, type) as ItemKeys;
        if (!catalogueKey) {
          console.error("Could not find key for move", obj.editorTypeName, type);

          return;
        }

        // move obj to target
        const parent = obj.parent!;
        const path = getEntryPath(obj);

        removeEntry(obj);
        onRemoveEntry(obj);
        const copy = JSON.parse(entryToJson(obj, editorFields));

        setPrototypeRecursive({ [catalogueKey]: copy });
        await onAddEntry(copy, to, to, this.get_system(to.getSystemId()));
        if (!to[catalogueKey]) {
          to[catalogueKey] = [];
        }
        to[catalogueKey]!.push(copy);

        const linkableTypes = ["rule", "infoGroup", "profile", "selectionEntry", "selectionEntryGroup"];
        const canBeLinked = linkableTypes.includes(obj.editorTypeName);
        const shouldMakeLink = canBeLinked && !obj.parentKey.startsWith("shared");

        // replace previous obj with link to moved obj
        if (canBeLinked && shouldMakeLink) {
          const link = {
            targetId: copy.id,
            id: from.generateNonConflictingId(),
            type: obj.editorTypeName,
            name: obj.getName(),
            hidden: obj.hidden,
            select: true,
          } as any;
          if (obj.isEntry()) {
            link.collective = obj.collective;
          }
          const linkKey = obj.isEntry() || obj.isGroup() ? "entryLinks" : "infoLinks";
          setPrototypeRecursive({ [linkKey]: link });
          path[path.length - 1].key = linkKey;
          await onAddEntry(link, from, parent, this.get_system(from.getSystemId()));
          addAtEntryPath(from, path, link);
        }
      };
      function undo() {
        // undo
        // replace obj path with obj
        // delete obj from target
        // update obj
      }

      // Undo is not done at this feature stills needs some iteration
      // await this.do_action("move", undo, redo);
      await redo();

      this.set_catalogue_changed(from, true);
      this.set_catalogue_changed(to, true);
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
          console.error("Couldn't find path to", obj.getName(), obj, "parent:", obj.parent?.getName());
          // throw new Error("Invalid path");
        }
        if (child) {
          current = child;
        }
        if (node !== lastNode) {
          await open_el(current);
        }
        if (node === lastNode) {
          if (last === false) {
            await close_el(current);
          } else if (last === true) {
            await open_el(current);
          }
        }
      }

      return current;
    },
    /**
     *  Changes the current route to be the catalogue provided
     *  Returns true if the route changed
     */
    async goto_catalogue(id: string, systemId?: string) {
      const $router = (this as any as { $router: Router }).$router;
      if (!$router) {
        throw new Error("Cannot follow link to another catalogue without $router set");
      }
      const curId = $router.currentRoute.query?.id || $router.currentRoute.query?.systemId;
      if (id !== curId) {
        $router.push({
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
    can_follow(obj?: EditorBase): boolean {
      return Boolean(obj?.target);
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
        mode: this.mode,
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
        this.mode = state.mode || "edit";
        const changedCatalogue = await this.goto_catalogue(state.catalogueId!, state.systemId);
        if (!changedCatalogue) {
          this.catalogueComponent.load_state(state);
          this.rerender_catalogue();
        }
      }
    },
    put_state_in_history(state: EditorUIState) {
      if (this.historyStackPos < this.historyStack.length) {
        const n_to_remove = this.historyStack.length - this.historyStackPos;
        this.historyStack.splice(this.historyStackPos, n_to_remove, state);
      } else {
        this.historyStack.push(state);
      }
      this.historyStackPos = this.historyStack.length;
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
    },
    async forward() {
      if (this.can_forward()) {
        this.historyStackPos += 1;
        this.load_state(this.historyStack[this.historyStackPos]!);
      }
    },
  },
});
