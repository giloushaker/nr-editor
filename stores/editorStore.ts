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
  getName,
  getNameExtra,
} from "~/assets/shared/battlescribe/bs_editor";
import {
  enumerate_zip,
  generateBattlescribeId,
  removeSuffix,
  textSearchRegex,
  zipCompress,
  forEachParent,
  addObj,
  type MaybeArray,
  isObject,
  sortByDescendingInplace,
  sortByAscendingInplace,
} from "~/assets/shared/battlescribe/bs_helpers";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import {
  Base,
  Link,
  entriesToJson,
  entryToJson,
  goodJsonKeys,
  rootToJson,
  Characteristic,
  Rule,
  getDataObject,
  getDataDbId,
  BaseChildsT,
  goodJsonArrayKeys,
  ProfileType,
} from "~/assets/shared/battlescribe/bs_main";
import { setPrototypeRecursive } from "~/assets/shared/battlescribe/bs_main_types";
import { useCataloguesStore } from "./cataloguesState";
import type {
  BSICatalogue,
  BSIConstraint,
  BSIData,
  BSIDataCatalogue,
  BSIDataSystem,
  BSIGameSystem,
  BSIProfile,
} from "~/assets/shared/battlescribe/bs_types";
import {
  createFolder,
  dirname,
  filename,
  getFolderFiles,
  getFolderRemote,
  unwatchFile,
  watchFile,
  writeFile,
} from "~/electron/node_helpers";
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
import { LeftPanelDefaults } from "~/components/catalogue/left_panel/LeftPanelDefaults";
import { EditorUIState, useEditorUIState } from "./editorUIState";
import { db } from "~/assets/shared/battlescribe/cataloguesdexie";
import { getNextRevision, parseGitHubUrl } from "~/assets/shared/battlescribe/github";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { toRaw } from "vue";
import { Router } from "vue-router";
import { useSettingsStore } from "./settingsState";
import { RouteLocationNormalizedLoaded } from "~/.nuxt/vue-router";
import { useScriptsStore } from "./scriptsStore";
type CatalogueComponentT = InstanceType<typeof CatalogueVue>;
type MaybePromise<T> = T | Promise<T>
const enableGithubIntegrationWithGitFolder = false;
export interface IEditorStore {
  selectionsParent?: Object | null;
  selections: Array<{ obj: any; onunselected: () => unknown; payload?: any }>;
  selectedEntries: Array<{ obj: EditorBase; onunselected: () => unknown; payload?: any }>;
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

  scripts: ReturnType<typeof useScriptsStore>
}
export interface CatalogueEntryItem {
  item: ItemTypes & EditorBase;
  type: ItemKeys;
  imported?: boolean;
}
export interface CatalogueState {
  changed: boolean;
  unsaved: boolean;
  incremented?: boolean;
  savingPromise?: Promise<any>;
  isChangedOnDisk?: boolean;
  isSaving?: boolean;
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
export function get_base_from_vue_el(vue_el: VueComponent | EditorBase): EditorBase {
  if (vue_el instanceof Base) {
    return vue_el as EditorBase;
  }
  const p1 = vue_el.$parent;
  if (p1.item) return p1.item;
  const p2 = p1.$parent;
  if (p2.item) return p2.item;
  const p3 = p2.$parent;
  return p3.item;
}

function markSaving(file: CatalogueState) {
  file.isSaving = true;
}
function markChangedOnDisk(file: CatalogueState) {
  if (file.isSaving) {
    file.isSaving = false;
    return;
  }
  file.isChangedOnDisk = true;
}
function unmarkChangedOnDisk(file: CatalogueState) {
  if (file.isChangedOnDisk) {
    file.isChangedOnDisk = false;
  }
  if (file.isSaving === undefined) {
    file.isSaving = false;
  }
}
type VueComponent = any;
const editorFields = new Set<string>(["select", "showInEditor", "showChildsInEditor"]);
export const useEditorStore = defineStore("editor", {
  state: (): IEditorStore => ({
    selections: [],
    selectedEntries: [],
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
    scripts: useScriptsStore()
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
      this.get_catalogue_state(data).incremented = true;
      this.saveCatalogue(data);
      return files;
    },
    saveCatalogueInDb(data: Catalogue | BSICatalogue | BSIGameSystem) {
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
    },

    async saveCatalogueInFiles(data: Catalogue | BSICatalogue | BSIGameSystem) {
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
    },

    saveCatalogue(data: Catalogue | BSIData) {
      const state = this.get_catalogue_state(data);
      const obj = getDataObject(data);
      markSaving(state);
      if (electron) {
        this.saveCatalogueInFiles(obj);
      } else {
        this.saveCatalogueInDb(obj);
      }
      unmarkChangedOnDisk(state);
    },
    async load_systems_from_folder(
      folder: string,
      progress?: (current: number, max: number, msg?: string) => MaybePromise<unknown>
    ) {
      if (!globalThis.electron) {
        throw new Error("Not running in electron");
      }
      const files = await getFolderFiles(folder);
      if (!files?.length) return;

      console.log("Loading", files.length, "files");
      const result_system_ids = [] as string[];
      const result_files = [];
      const systems = [] as GameSystemFiles[];

      const allowed = files.filter((o) => isAllowedExtension(o.name));
      for (const file of allowed) {
        try {
          progress && (await progress(result_files.length, allowed.length, file.path));
          const json = await convertToJson(file.data, file.name.endsWith("json") ? "json" : "xml");
          if (!json.catalogue && !json.gameSystem) {
            continue;
          };
          const obj = getDataObject(json);
          obj.fullFilePath = file.path.replaceAll("\\", "/");
          const systemId = json?.gameSystem?.id;
          const catalogueId = json?.catalogue?.id;
          if (systemId) {
            const systemFiles = this.get_system(systemId);
            systemFiles.setSystem(shallowReactive(json));
            systems.push(systemFiles);
            result_system_ids.push(systemId);
          }
          if (catalogueId) {
            const systemFiles = this.get_system(json.catalogue.gameSystemId);
            systemFiles.catalogueFiles[catalogueId] = shallowReactive(json);
          }
          result_files.push(json);
        } catch (e) {
          console.error(`Error loading ${file.name}`, e)
        }
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
      if (!system.gameSystem.fullFilePath) {
        system.gameSystem.fullFilePath = dbsystem.path;
      }

      const dbcatalogues = await db.catalogues.where({ "content.catalogue.gameSystemId": id });
      const systemFiles = this.get_system(system.gameSystem.id);
      systemFiles.setSystem(system);
      for (let { content, path } of await dbcatalogues.toArray()) {
        const catalogueId = content.catalogue.id;
        if (!content.catalogue.fullFilePath) {
          content.catalogue.fullFilePath = path;
        }
        systemFiles.catalogueFiles[catalogueId] = shallowReactive(content);
      }
      this.load_system(systemFiles, true);
    },
    async load_system(system: GameSystemFiles, keepState = false) {
      if (system.gameSystem) {
        const cataloguesStore = useCataloguesStore();
        await system.unloadAll();
        if (!keepState) {
          for (const catalogue of system.getAllCatalogueFiles()) {
            const state = this.get_catalogue_state(catalogue);
            if (state) {
              state.changed = false;
              state.unsaved = false;
              state.isChangedOnDisk = false;
            }
            cataloguesStore.updateCatalogue(getDataObject(catalogue));
            cataloguesStore.setEdited(getDataObject(catalogue).id, false);
          }
        }
        const publications = system.gameSystem.gameSystem.publications;
        const github = publications?.find((o) => o.name?.trim().toLowerCase() === "github");
        const path = system.gameSystem.gameSystem.fullFilePath;

        if (path && enableGithubIntegrationWithGitFolder) {
          try {
            const remote = await getFolderRemote(dirname(path));
            if (remote && remote !== "origin") {
              console.log("remote:", remote);
              system.github = { ...parseGitHubUrl(remote), discovered: true };
            }
          } catch (e) {
            console.error(e);
          }
        }
        if (github && github.publisherUrl) {
          system.github = {
            githubUrl: github.publisherUrl,
          };
          if (github.shortName && github.shortName.includes("/")) {
            system.github.githubRepo = github.shortName;
            system.github.githubOwner = github.shortName?.split("/")[0];
            system.github.githubName = github.shortName?.split("/")[1];
          }
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
      markChangedOnDisk(this.get_catalogue_state(file));
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
        const system = new GameSystemFiles();
        system.settings = useSettingsStore() as Record<string, any>;
        this.gameSystems[id] = system;
      }
      return this.gameSystems[id];
    },
    delete_system(id: string) {
      delete this.gameSystems[id];
    },
    get_catalogue_state(catalogue: BSIData | Catalogue) {
      const id = getDataDbId(catalogue);
      if (!this.unsavedChanges[id]) {
        this.unsavedChanges[id] = {
          changed: false,
          unsaved: false,
        };
      }
      return this.unsavedChanges[id];
    },
    set_catalogue_changed(catalogue: Catalogue | BSIDataCatalogue | BSIDataSystem, changedState: boolean = true) {
      const state = this.get_catalogue_state(catalogue);
      if (changedState) {
        state.changed = true;
        if (!state.unsaved) {
          this.unsavedCount += 1;
          state.unsaved = changedState;
        }
      } else {
        state.unsaved = changedState;
      }
    },
    changed(node: EditorBase | Catalogue) {
      const catalogue = node.getCatalogue()
      if (catalogue) {
        this.set_catalogue_changed(catalogue)
      }
    },
    removed(node: EditorBase | Catalogue) {
      const catalogue = node.getCatalogue()
      if (catalogue) {
        this.set_catalogue_changed(catalogue)
      }
    },
    /**
     * Returns true if the revision was incremented
     */

    async save_catalogue(
      system: GameSystemFiles,
      catalogue: Catalogue,
      incrementRevision?: "github" | "yes" | "no"
    ): Promise<boolean> {
      const state = this.get_catalogue_state(catalogue);
      const revision = catalogue.revision;
      if (incrementRevision === "github" && system.github) {
        catalogue.revision = await getNextRevision(system.github, catalogue);
      }
      if (incrementRevision === "yes" && !state?.incremented) {
        catalogue.revision = catalogue.revision ? catalogue.revision + 1 : 1;
        state.incremented = true;
      }
      if (incrementRevision === "no") {
        state.incremented = true;
      }
      this.saveCatalogue(catalogue);
      const cataloguesStore = useCataloguesStore();
      const id = getDataDbId(catalogue);
      cataloguesStore.updateCatalogue(catalogue);
      cataloguesStore.setEdited(id, true);
      if (state?.unsaved) {
        this.unsavedCount--;
        state.unsaved = false;
      }
      return catalogue.revision !== revision;
    },
    async prompt_revision(catalogue: Catalogue | GameSystemFiles) {
      const settings = useSettingsStore();

      const sys = (catalogue instanceof Catalogue ? catalogue.manager : catalogue) as GameSystemFiles;
      for (const cat of catalogue instanceof Catalogue ? [catalogue] : sys.getAllLoadedCatalogues()) {
        const state = this.get_catalogue_state(cat);
        if (state?.unsaved && !state.incremented) {
          if (sys.github) {
            if (settings.githubAutoIncrement && !navigator.onLine) {
              const promptResult = await (globalThis.customPrompt &&
                globalThis.customPrompt({
                  html: `<span>Would you like to increase the revision of this catalogue?<span><br/>
  <span class="gray">Note: This is shown because Github cannot be accessed as your are offline</span>`,
                  cancel: "No",
                  accept: "Yes",
                  id: "revision",
                }))
              return promptResult ? "yes" : "no";
            } else if (settings.githubAutoIncrement) {
              return "github";
            } else {
              const promptResult = await (globalThis.customPrompt &&
                globalThis.customPrompt({
                  html: `<span>Would you like to increase the revision of this catalogue?<span><br/>`,
                  cancel: "No",
                  accept: "Yes",
                  id: "revision",
                }))
              return promptResult ? "yes" : "no";
            }
          } else {
            const promptResult = await (globalThis.customPrompt &&
              globalThis.customPrompt({
                html: `<span>Would you like to increase the revision of this catalogue?<span><br/>
  <span class="gray">Note: You can enable automatic revision increments by integrating with GitHub.<br/>This can be achieved by adding a publication in the GameSystem named "GitHub" with the repository's GitHub URL as the Publication URL.`,
                cancel: "No",
                accept: "Yes",
                id: "revision",
              }))
            return promptResult ? "yes" : "no";
          }
        }
      }
    },
    async save_all(system?: string) {
      let failed = false;
      let incremented = 0;

      const settings = useSettingsStore();
      try {
        for (const sys of Object.values(this.gameSystems)) {
          if (system && sys.gameSystem?.gameSystem?.id !== system) {
            continue;
          }
          const increment = await this.prompt_revision(sys);
          for (const cat of sys.getAllLoadedCatalogues()) {
            if (this.get_catalogue_state(cat)?.unsaved) {
              if (await this.save_catalogue(sys, cat, increment)) {
                incremented += 1;
              }
            }
          }
        }
      } catch (e) {
        notify({ text: `Failed to save: ${(e as Error).name}: ${(e as Error).message}`, type: "error" });
        failed = true;
      }
      if (incremented) {
        notify(`Incremented ${incremented} catalogue's revision`);
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
      globalThis.$store = this;
    },
    /**
     * Force the left panel to re-render, used for setting its state by having it reload the saved state
     */
    rerender_catalogue() {
      if (this.catalogueComponent) {
        this.catalogueComponent.key += 1;
      }
    },
    unselect(obj?: VueComponent | Base) {
      const next_selected = [];
      const next_unselected = [];
      for (const selection of this.selections) {
        if (obj === undefined || toRaw(selection.obj) === toRaw(obj)) {
          next_unselected.push(selection);
        } else {
          next_selected.push(selection);
        }
      }

      const next_selected_entries = [];
      const next_unselected_entries = [];
      for (const selection of this.selectedEntries) {
        if (obj === undefined || toRaw(selection.obj) === toRaw(obj)) {
          next_unselected_entries.push(selection);
        } else {
          next_selected_entries.push(selection);
        }
      }
      this.selections = next_selected;
      this.selectedEntries = next_selected_entries
      for (const unselected of [...next_unselected, ...next_unselected_entries]) {
        if (unselected.onunselected) {
          unselected.onunselected();
        }
        if (unselected.obj === this.selectedItem) {
          this.selectedItem = null;
        }
      }
    },
    is_selected(obj: VueComponent) {
      if (obj instanceof Base) {
        return this.selectedEntries.find((o) => o.obj === obj) !== undefined;
      } else {
        return this.selections.find((o) => o.obj === obj) !== undefined;
      }
    },
    select(obj: VueComponent | EditorBase, onunselected: () => unknown, payload?: any) {
      if (!this.is_selected(obj)) {
        if (obj instanceof Base) {
          this.selectedEntries.push({ obj: obj as EditorBase, onunselected, payload });
        } else {
          this.selections.push({ obj, onunselected, payload });
        }
      }
    },
    do_select(e: MouseEvent | null, el: VueComponent) {
      const last = this.selectedElementGroup;
      const last_element = this.selectedElement;
      this.selectedElement = el;

      if (e?.shiftKey) {
        const depth = el.depth;
        const parent = (el.$el as HTMLElement).closest(`.collapsible-box.depth-${depth - 1}`);
        const nodes = [...parent?.getElementsByClassName(`collapsible-box depth-${depth}`) || []] as unknown as Array<{ vnode: VueComponent }>;
        const entries = nodes.map(o => o.vnode)
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
    do_rightclick_select(e: MouseEvent, el: VueComponent) {
      if (this.is_selected(el)) return;
      this.do_select(e, el);
    },
    clear_selections() {
      this.unselect();
    },
    get_selections(): EditorBase[] {
      const result = this.selections.map((o) => get_base_from_vue_el(o.obj));
      this.selectedEntries.forEach((o) => result.push(o.obj as EditorBase));
      return result;
    },
    get_sorted_selections() {
      const result = this.selections.map((o) => get_base_from_vue_el(o.obj));
      this.selectedEntries.forEach((o) => result.push(o.obj as EditorBase));
      sortByAscendingInplace(result, selection => getEntryPath(selection).map(o => `${o.key}[${o.index}]`).join('/'))
      return result;
    },
    get_selections_with_payload(): Array<{ obj: EditorBase; payload: any }> {
      const result = this.selections.map((o) => ({ obj: get_base_from_vue_el(o.obj), payload: o.payload }));
      this.selectedEntries.forEach((o) => result.push({ obj: o.obj as EditorBase, payload: o.payload }));
      return result;
    },
    get_selected(): EditorBase | undefined {
      return this.selectedItem && get_base_from_vue_el(this.selectedItem);
    },
    set_selections(entry_or_entries: MaybeArray<EditorBase>) {
      this.clear_selections();
      const arr = Array.isArray(entry_or_entries) ? entry_or_entries : [entry_or_entries];
      this.selectedEntries = arr.map((o) => ({ obj: o, onunselected: () => null }));
    },
    toggle_selections() {
      const bases = this.get_selections()
      if (this.filter && bases.find(o => !o.showChildsInEditor)) {
        bases.forEach(o => this.show(o, false));
      } else {
        const boxes = this.selections.map(o => o.obj)
        if (boxes.find(o => o.collapsed === true)) {
          boxes.filter(o => o.collapsed === true).forEach(o => o.open())
        } else {
          boxes.filter(o => o.collapsed === false).forEach(o => o.close())
        }
      }
    },
    async do_action(type: string, undo: () => void | Promise<void>, redo: () => any | Promise<any>) {
      let result;
      try {
        result = await redo();
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
      return result;
    },
    /**
     * Set the content of the clipboard, accepts an event to better conform with browser security/permissions stuff
     * @param data the entries to set in the clipboard, do not use for copying text
     * @param event the event to use, if not provided a valid ClipboardEvent, will use the navigator.clipboard.writeText()
     */
    async set_clipboard(data: EditorBase[], event?: ClipboardEvent) {
      if (this.clipboardmode === "json") {
        //@ts-ignore
        const shallowCopies = data.map((o) => ({ parentKey: o.parentKey, ...o, sortIndex: undefined })) as EditorBase[];
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
          try {
            return JSON.parse(text);
          } catch (e) {
            return text
          }
        } else {
          const text = await navigator.clipboard.readText();
          try {
            return JSON.parse(text);
          } catch (e) {
            return text
          }
        }
      }
      return this.clipboard;
    },
    can_undo() {
      return Boolean(this.undoStack[this.undoStackPos]);
    },
    async undo() {
      if (!this.can_undo()) return;
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
      if (!this.can_redo()) return;
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
    async copy(event: ClipboardEvent, selections?: MaybeArray<EditorBase>) {
      const toCopy = selections ? (Array.isArray(selections) ? selections : [selections]) : this.get_selections()
      await this.set_clipboard(toCopy, event);
    },
    async paste(event: ClipboardEvent) {
      const clip = await this.get_clipboard(event);
      const script_result = await this.scripts.run_hooks("paste", {}, clip)
      if (script_result) {
        this.add(script_result);
      }
    },
    async pasteLink() {
      const obj = await this.get_clipboard();
      if (!obj || !obj.parentKey || Array.isArray(obj)) {
        return;
      }
      const selections = this.get_selections();
      const first = selections[0];
      if (!first) {
        return;
      }
      const actual = first.getCatalogue().findOptionById(obj.id) as EditorBase | undefined;
      if (actual) {
        const link = {
          parentKey: actual.isGroup() || actual.isEntry() ? "entryLinks" : "infoLinks",
          targetId: actual.id,
          id: generateBattlescribeId(),
          type: actual.editorTypeName,
          name: actual.getName(),
          hidden: actual.hidden,
          select: true,
        };
        this.add(link);
      }
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

      const redo = () => {
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
          onAddEntry(copy, catalogue, item.parent, this.get_system(sysId));
          addeds.push(copy);
          this.changed(copy);
        }
      };
      const undo = () => {
        for (const entry of addeds) {
          popAtEntryPath(catalogue, getEntryPath(entry));
          this.removed(entry)
          onRemoveEntry(entry);
        }
      };
      await this.do_action("dupe", undo, redo);
    },
    /**
     * Remove the current selections.
     */
    remove(entry_or_entries?: MaybeArray<Base>) {
      let entries = [] as EditorBase[];
      if (entry_or_entries) {
        for (const entry of Array.isArray(entry_or_entries) ? entry_or_entries : [entry_or_entries]) {
          entries.push(entry as EditorBase);
        }
      } else {
        const selections = this.get_selections();
        if (!selections.length) return;
        for (const selected of selections) {
          entries.push(selected);
        }
      }

      const catalogue = entries[0].getCatalogue();
      const sysId = catalogue.getSystemId();

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
          this.removed(removed);
          onRemoveEntry(removed, manager);
        }
        removeds.reverse();
        paths.reverse();
      };
      const undo = async () => {
        for (const [path, entry] of enumerate_zip(paths, removeds)) {
          const parent = addAtEntryPath(catalogue, path, entry);
          onAddEntry(entry, catalogue, parent, this.get_system(sysId));
          this.changed(entry);
        }
      };
      this.do_action("remove", undo, redo);
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
      childKey?: string & BaseChildsT,
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
      const entries = (Array.isArray(data) ? data : [data])
      if (!entries.length) {
        console.error("Couldn't add: no data provided");
        return;
      }
      const catalogue = parentsWithPayload[0].obj.getCatalogue();
      const fixedEntries = entries.map(o => this.fix_object(childKey || o.parentKey, o, catalogue, parents ? parents[0] : undefined))
      const sysId = catalogue.getSystemId();

      let addeds = [] as EditorBase[];
      const redo = async () => {
        addeds = [];
        for (const selection of parentsWithPayload) {
          const item = selection.obj;
          const selectedCatalogueKey = selection.payload as BaseChildsT | "";
          await this.open(item, true);
          const toAdd = [];
          for (const entry of fixedEntries) {
            // Ensure there is array to put the childs in
            const key = fixKey(item, childKey || entry.parentKey, selectedCatalogueKey);
            if (!key) {
              const text = `Couldn't create ${childKey || entry.parentKey} in ${selectedCatalogueKey}`
              notify({ type: "error", text })
              console.warn(text);
              continue;
            }
            if (!item[key as keyof Base]) {
              (item as any)[key] = [];
            }
            const arr = item[key as keyof Base];
            if (!Array.isArray(arr)) continue;

            if (!allowed_children(item, item.parentKey)?.has(key as string)) {
              const text = `Couldn't add ${key} to a ${item.parentKey}`
              notify({ type: "error", text })
              console.warn(text);
              continue;
            }
            // Copy to not affect existing
            const json = entry instanceof Base ? entryToJson(entry, editorFields) : JSON.stringify(entry);
            const copy = JSON.parse(json);
            clean(copy, key as string);
            delete copy.parentKey;

            // Initialize classes from the json
            setPrototypeRecursive({ [key]: copy });
            toAdd.push({ key, entry: copy });
          }

          scrambleIds(
            catalogue,
            toAdd.map((o) => o.entry)
          );

          for (const { key, entry } of toAdd) {
            if (!item[key as keyof Base]) (item as any)[key] = [];
            const arr = item[key as keyof Base];
            if (!Array.isArray(arr)) continue;

            // Show added entry even if there is a search
            this.filtered.push(entry);
            entry.showChildsInEditor = true;
            let cur = entry;
            while (cur) {
              cur.showInEditor = true;
              cur = cur.parent;
            }

            // Add it to its parent
            arr.push(entry);
            onAddEntry(entry, catalogue, item, this.get_system(sysId));
            this.changed(entry)
            addeds.push(entry);
          }
        }
        return addeds[0];
      };
      const undo = () => {
        for (const entry of addeds) {
          popAtEntryPath(catalogue, getEntryPath(entry));
          this.removed(entry)
          onRemoveEntry(entry);
        }
      };
      const initial = await this.do_action("add", undo, redo);
      return initial;
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
            id: generateBattlescribeId(),
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
            id: generateBattlescribeId(),
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
            id: generateBattlescribeId(),
          };
        case "entryLinks":
          return {
            import: true,
            name: `New ${getTypeLabel(getTypeName(key))}`,
            hidden: false,
            id: generateBattlescribeId(),
          };
        case "associations":
          return {
            min: 1,
            max: 1,
            scope: "parent",
            childId: "any",
            ids: [],
            name: "New Association",
            id: generateBattlescribeId(),
          };
        case "sharedProfiles":
        case "profiles":
          const profileType = parent?.getCatalogue().iterateProfileTypes().next().value;
          const name = !parent || parent?.isCatalogue() ? undefined : parent?.getName();
          return {
            name: name || "New Profile",
            typeId: profileType?.id,
            typeName: profileType?.name,
            hidden: false,
            id: generateBattlescribeId(),
            characteristics: [],
          } as BSIProfile;
        case "catalogueLinks":
          return {
            type: "catalogue",
            name: `New ${getTypeLabel(getTypeName(key))}`,
            id: generateBattlescribeId(),
          };

        case "categoryLinks":
          return {
            type: "category",
            name: `New ${getTypeLabel(getTypeName(key))}`,
            hidden: false,
            id: generateBattlescribeId(),
          };

        case "characteristics":
        case "costs":
          return {

          }
        default:
          return {
            name: `New ${getTypeLabel(getTypeName(key))}`,
            id: generateBattlescribeId(),
            hidden: false,
          };
      }
    },
    // Resolves ids from profile/characteristic names so they dont need to be known by scripts
    fix_profile(catalogue: Catalogue, profile: BSIProfile) {
      let profileType = catalogue.findOptionById(profile.typeId) as ProfileType | null
      if (profile.typeName && !(profileType instanceof ProfileType)) {
        const profileTypes = catalogue.findOptionsByText(profile.typeName, true).filter(o => o instanceof ProfileType) as ProfileType[]
        sortByDescendingInplace(profileTypes, o => o.characteristicTypes?.length === profile.characteristics?.length ? 1 : 0)
        profileType = profileTypes[0]
      }
      if (!profileType) return;
      profile.typeName = profileType.name
      profile.typeId = profileType.id

      for (const c of profile.characteristics || []) {
        if (!c.typeId) {
          const characteristicType = profileType?.characteristicTypes.find(o => o.name === c.name)
          if (characteristicType) {
            c.typeId = characteristicType.id
          }
        } else if (!c.name && c.typeId) {
          const characteristicType = profileType?.characteristicTypes.find(o => o.id === c.typeId)
          if (characteristicType) {
            c.name = characteristicType.name
          }
        }
      }
      const missing = profileType.characteristicTypes?.filter(ct => !profile.characteristics.find(c => c.typeId === ct.id))
      const badIndex = profile.characteristics.find((c, i) => i !== profileType.characteristicTypes.findIndex(ct => ct.id === c.typeId))
      if (missing.length || badIndex) {
        const out_characteristics = []
        const in_characteristics = [...profile.characteristics]
        for (const ct of missing) {
          in_characteristics.push({
            name: ct.name,
            typeId: ct.id,
            $text: "",
          })
        }
        for (const c of in_characteristics) {
          const idx = profileType.characteristicTypes.findIndex(ct => ct.id === c.typeId)
          if (idx >= 0) {
            out_characteristics[idx] = c
          }
        }
        profile.characteristics = out_characteristics
      }
    },
    // Recursively merges objects with their default created object so that they are valid.
    fix_object<T>(key: string & BaseChildsT, data?: T, catalogue?: Catalogue, parent?: EditorBase): T extends [] ? T[] : T {
      if (Array.isArray(data)) {
        //@ts-ignore
        return data.map(o => this.fix_object(key, o, catalogue)) as T[];
      }
      const obj = {
        ...this.get_initial_object(key, parent),
        ...data,
      }

      if (catalogue && getTypeName(key) === "profile") {
        this.fix_profile(catalogue, obj);
      }
      for (const nested_key in obj) {
        const val = obj[nested_key]
        if ((goodJsonArrayKeys as Set<string>).has(nested_key) && isObject(val)) {
          if (Array.isArray(val)) {
            obj[nested_key] = obj[nested_key].map((o: any) => this.fix_object(nested_key as BaseChildsT, o, catalogue))
          } else {
            obj[nested_key] = [this.fix_object(nested_key as BaseChildsT, val, catalogue)]
          }
        }
      }
      return obj;
    },
    /**
     * Creates child entries in the current selection
     * Will select the added child if possible.
     * Supports undo & redo
     * May cause problems if used in scripts
     * @param key the key of the child (eg: `selectionEntries`)
     * @param data data to use when creating the child entry
     */
    async create(key: string & BaseChildsT, data?: Record<string, any>) {
      const added = await this.add({ select: true, ...data }, key);
      this.open_selected();
      return added;
    },
    /**
     * Creates child entries in the provided parent after a user action
     * Will select the added child if possible.
     * Supports undo & redo
     * May cause problems if used in scripts
     * @param key the key of the child (eg: `selectionEntries`)
     * @param parent the parent to add the child in
     * @param data data to use when creating the child entry
     */
    async create_child(key: string & BaseChildsT, parent: EditorBase, data?: Record<string, any>) {
      const result = await this.add({ select: true, ...data }, key, parent);
      this.open_selected();
      return result;
    },
    /**
     * Synchronous version of create_child for use by scripts
     * Adds a child (specified by `_key` to a specified parent)
     * Will not select the added child
     * Does not Support undo & redo
     *
     * @param key The parent's key to add the child in, will affect the fields generated by default.
     * @param parent The entry to add the child in
     * @param data The fields to add on to the generated object, overwrites default fields
     * @returns The added object
     */
    add_node(_key: string & BaseChildsT, parent: EditorBase, data?: Record<string, any>) {
      const key = fixKey(parent, _key);
      if (!key) {
        throw new Error(`Invalid key: ${_key} in ${parent.editorTypeName}`);
      }
      const catalogue = parent.getCatalogue();
      const sysId = catalogue.getSystemId();

      const obj = {
        ...this.fix_object(key, data, catalogue),
        ...data,
      };

      if (!allowed_children(parent, parent.parentKey)?.has(key as string)) {
        console.warn("Couldn't add", key, "to a", parent.parentKey, "because it is not allowed");
        return;
      }

      // Ensure there is array to put the childs in
      if (!parent[key as keyof Base]) (parent as any)[key] = [];
      const arr = parent[key as keyof Base] as EditorBase[];
      if (!Array.isArray(arr)) return;

      clean(obj, key as string);
      delete obj.parentKey;

      // Initialize classes from the json
      setPrototypeRecursive({ [key]: obj });

      // Add it to its parent
      arr.push(obj as EditorBase);
      onAddEntry(obj as EditorBase, catalogue, parent, this.get_system(sysId));
      this.changed(obj as EditorBase);
      return obj;
    },
    del_node(entry: Base) {
      try {
        const catalogue = entry.catalogue;
        const manager = catalogue.manager;
        const path = getEntryPath(entry as EditorBase);
        const removed = popAtEntryPath(catalogue, path);
        this.removed(removed)
        onRemoveEntry(removed, manager);
      } catch (e) {
        console.error("Failed to delete", entry);
      }
    },
    can_move(obj: EditorBase) {
      if (obj.isLink()) return false;
      return true;
    },
    edit_node(entry: EditorBase, data?: Record<string, any>) {
      let changed = false;
      for (const key in data) {
        const val = data[key]
        // @ts-ignore
        if (entry[key] !== val) {
          if (isObject(val)) {
            const catalogue = entry.getCatalogue()
            const sysId = catalogue.getSystemId();

            // @ts-ignore
            const fixed_obj = this.fix_object(key, val, catalogue);
            setPrototypeRecursive({ [key]: fixed_obj })

            // @ts-ignore
            entry[key] = fixed_obj
            onAddEntry(fixed_obj, catalogue, entry, this.get_system(sysId));
          } else {
            // @ts-ignore
            entry[key] = val
          }
          changed = true;
        }
      }
      if (changed) {
        this.changed(entry);
      }
      return changed
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
          result.push({ target: imported, type: "shared" });
        }
      }
      if (this.move_to_key(obj, "root")) {
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
          return "";
        case "category":
          return "categoryEntries"
        case "profileType":
          return "profileTypes"
        case "costType":
          return "costTypes"
        case "selectionEntry":
          return "selectionEntries";
        case "selectionEntryGroup":
          return "";
        default:
          return obj.parentKey;
      }
    },
    move(obj: EditorBase, from: Catalogue, to: Catalogue, type: "root" | "shared") {
      const redo = () => {
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
        this.removed(obj)
        onRemoveEntry(obj);
        const copy = JSON.parse(entryToJson(obj, editorFields));

        setPrototypeRecursive({ [catalogueKey]: copy });
        if (!to[catalogueKey]) to[catalogueKey] = [];

        to[catalogueKey]!.push(copy);
        onAddEntry(copy, to, to, this.get_system(to.getSystemId()));
        this.changed(copy)
        const linkableTypes = ["rule", "infoGroup", "profile", "selectionEntry", "selectionEntryGroup"];
        const canBeLinked = linkableTypes.includes(obj.editorTypeName);
        const shouldMakeLink = !obj.parentKey.startsWith("shared");

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
          const linkKey = obj.isGroup() || obj.isEntry() ? "entryLinks" : "infoLinks";
          setPrototypeRecursive({ [linkKey]: link });
          path[path.length - 1].key = linkKey;
          addAtEntryPath(from, path, link);
          onAddEntry(link, from, parent, this.get_system(from.getSystemId()));
          this.changed(link)
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
      redo();
    },
    async open(obj: EditorBase, last?: boolean, noLog?: boolean) {
      let current = document.getElementById("editor-entries") as Element;
      if (!current) {
        return;
      }

      async function open_el(el: any) {
        const context = get_ctx(el);
        get_base_from_vue_el(context).showInEditor = true;
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
      if (!current) {
        if (noLog !== true) {
          console.error("Couldn't find root element for", path[0].key, "in", obj.catalogue.getName());
        }
        return;
      }
      await this.show(obj, false)
      await open_el(current);
      const nodes = [] as EditorBase[];
      forEachParent(obj, (parent) => {
        nodes.push(parent);
      });
      nodes.pop(); // pop catalogue
      nodes.reverse();
      nodes.push(obj);

      // hack so that the correct label for sharedProfiles is opened
      if (nodes[0].parentKey === "sharedProfiles") {
        nodes.unshift({
          parentKey: `label-${nodes[0].typeName ?? "Untyped"}`,
        } as any);
      }
      const lastNode = nodes[nodes.length - 1];
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const childs = current.getElementsByClassName(`depth-${i + 1} ${node.parentKey}`);
        let child: Element | undefined;
        if (node.parentKey.startsWith("label-")) {
          child = childs[0]
        }
        else {
          const arr = []
          for (let i = 0; i < childs.length; i++) {
            arr.push(childs[i])
          }
          child = arr.find((o) => $toRaw(get_base_from_vue_el(get_ctx(o))) === $toRaw(node));
        }

        if (!child) {
          if (noLog !== true) {
            console.error("Couldn't find path to", obj.getName(), obj, "parent:", obj.parent?.getName());
          }
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
      const rawQuery = ($router.currentRoute as any as RouteLocationNormalizedLoaded)?.query;
      const query = rawQuery ?? $router.currentRoute?.value?.query;
      const curId = query?.id || query?.systemId;
      if (id !== curId) {
        $router.push({
          name: "catalogue",
          query: { systemId: systemId || id, id: id },
        });

        this.$nextTick = new Promise((resolve, reject) => {
          this.$nextTickResolve = resolve;
        }).then(() => { delete this.$nextTickResolve });
        return this.$nextTick;
      }
      return false;
    },

    async show(obj: EditorBase, highlight = true) {
      if (!this.filtered.includes(obj)) {
        this.filtered.push(obj);
      }
      obj.showInEditor = true;
      obj.showChildsInEditor = true;
      if (highlight) {
        obj.highlight = true;
      }
      forEachParent(obj as EditorBase, (parent) => {
        parent.showInEditor = true;
      });
    },
    async goto(obj: EditorBase) {
      const targetCatalogue = obj.getCatalogue();
      this.put_current_state_in_history();
      const uistate = useEditorUIState();
      uistate.get_data(targetCatalogue.id).selection = getEntryPath(obj);

      await this.goto_catalogue(targetCatalogue.id, targetCatalogue.gameSystemId);
      await this.show(obj, false);
      await this.scrollto(obj);
    },
    async scroll_to_el(el: Element) {
      el.scrollIntoView({ block: "center", "inline": "start", behavior: "instant" })

    },
    async scrollto(obj: EditorBase) {
      const el = await this.open(obj as EditorBase);
      if (el) {
        const context = get_ctx(el);
        this.do_select(null, context);
        this.scroll_to_el(el);
      } else {
        setTimeout(async () => {
          const el = await this.open(obj as EditorBase);
          if (el) {
            const context = get_ctx(el);
            this.do_select(null, context);
            this.scroll_to_el(el);
          }
        }, 50);
      }
    },
    can_goto(obj?: EditorBase | string): boolean {
      if (!obj) return false;
      return typeof obj === "object" && obj instanceof Base;
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
          this.changed(obj)
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
          this.changed(obj)
        }
      }
    },
    sortable(entry?: EditorBase) {
      const settings = useSettingsStore()
      if (settings.sort === "none") return false;
      return entry?.editorTypeName !== "force"
    },
    get_leftpanel_open_collapsible_boxes() {
      function find_open_recursive(elt: Element, obj: Record<string, any>, depth = 0) {
        const cls = `depth-${depth} collapsible-box opened`;
        const results = elt.getElementsByClassName(cls);
        if (!results?.length) return;
        for (var i = 0; i < results.length; i++) {
          const cur = results[i];
          const item = get_base_from_vue_el(get_ctx(cur));
          const key = item.parentKey;
          const parent = item.parent;

          if (parent) {
            const val = parent[key];
            if (!val || !Array.isArray(val)) continue;
            const index = val.indexOf(item as any);
            if (!(key in obj)) obj[key] = {};
            if (!(index in obj[key])) obj[key][index] = {};
            find_open_recursive(cur, obj[key][index], depth + 1);
          } else {
            const arr = []
            for (var i = 0; i < cur.classList.length; i++) {
              const cur_class = cur.classList[i];
              arr.push(cur_class)
            }
            const keys = arr.filter((o) => goodJsonKeys.has(o) || o.startsWith("label-"));
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
        const state = this.get_current_state()
        this.put_state_in_history(state);
        history.replaceState({ data: state, index: this.historyStackPos }, "", location.href)
        history.pushState({ index: this.historyStackPos + 1 }, "", null)
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
    async update_catalogue_search(catalogue: Catalogue, data: { filter: string; ignoreProfilesRules: boolean }) {
      const { filter, ignoreProfilesRules } = data;
      const prev = this.filtered as EditorBase[];
      for (const p of prev) {
        delete p.showInEditor;
        delete p.showChildsInEditor;
        delete p.highlight;
        forEachParent(p as EditorBase, (parent) => {
          delete parent.showInEditor;
          delete p.showChildsInEditor;
        });
      }
      if (filter.length > 1) {
        this.set_filter(filter);
        this.filtered = catalogue.findOptionsByText(filter) as EditorBase[];
        if (ignoreProfilesRules) {
          this.filtered = this.filtered.filter((o) => !o.isProfile() && !o.isRule() && !o.isInfoGroup());
        }
        for (const p of this.filtered) {
          this.show(p as EditorBase);
        }
        await (globalThis.$nextTick && globalThis.$nextTick())

        if (this.filtered.length < 300) {
          for (const p of this.filtered) {
            if (!p.parent) continue;
            try {
              await this.open(p as EditorBase, false, true);
            } catch (e) {
              continue;
            }
          }
        }
      } else {
        this.set_filter("");
        this.filtered = [];
      }
      return this.filtered
    },
    async system_search(system: GameSystemFiles, query: { filter: string }, max = 1000) {
      const result = [] as Base[];

      const { filter } = query;
      if (!filter) return null;
      const regx = textSearchRegex(filter);
      let more = false;

      await system.loadAll();
      for (const file of system.getAllLoadedCatalogues()) {
        file.forEachObjectWhitelist((val: Base, parent) => {
          try {
            if (result.length >= max) return;
            if ((val as unknown as Link).targetId) {
              if (val.target && val.target.isCategory() && !parent?.isForce()) {
                return;
              }
            }

            const name = val.getName?.call(val);
            const text = (val as any as Characteristic).$text;
            const desc = (val as any as Rule).description;
            const id = val.id;
            if (id === filter) {
              result.push(val);
            } else if ((name && String(name).match(regx)) || id === filter) {
              result.push(val);
            } else if (text && String(text).match(regx)) {
              result.push(val);
            } else if (desc && String(desc).match(regx)) {
              result.push(val);
            }
          } catch (e) {
            console.error("Error while searching:", e);
          }
        });
        if (result.length >= max) {
          more = true;
          break;
        }
      }
      console.log("Search for", `"${filter}"`, "found", result.length, "results");
      const grouped = {} as Record<string, Base[]>;
      for (const found of result) {
        addObj(grouped, found.catalogue.name, found);
      }
      return { grouped, all: result, more };
    },
    async open_catalogue(systemId: string, catalogueId?: string) {
      const system = await this.get_or_load_system(systemId);
      let loaded = system.getLoadedCatalogue({ targetId: catalogueId || systemId });
      if (!loaded) {
        loaded = await system.loadCatalogue({
          targetId: catalogueId || systemId,
        });
      }
      globalThis.$catalogue = loaded as any;
      loaded.processForEditor();
      for (const imported of loaded.imports) {
        imported.processForEditor();
      }

      return { system, catalogue: loaded };
    },
    // Backwards dependency
    //@ts-ignore
    add_child(...args: any[]) { return this.add_node(...args) },
    //@ts-ignore
    del_child(...args: any[]) { return this.del_node(...args) },
    //@ts-ignore
    edit_child(...args: any[]) { return this.edit_node(...args) },
    label(node: EditorBase, extra = false) {
      return extra ? [getName(node), getNameExtra(node)].filter(o => o).join(' ') : getName(node)
    }
  },
});
