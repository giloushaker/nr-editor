import { defineStore } from "pinia";
import {
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
  siblingArray,
} from "~/assets/editor/bs_editor";
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
  isDefaultObject,
  sortByDescendingInplace,
  sortByAscendingInplace,
} from "~/assets/shared/battlescribe/bs_helpers";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import {
  Base,
  Link,
  entriesToJson,
  entryToJson,
  rootToJson,
  Characteristic,
  Rule,
  getDataObject,
  getDataDbId,
  arrayKeys,
  ProfileType,
} from "~/assets/shared/battlescribe/bs_main";
import { setPrototype } from "~/assets/shared/battlescribe/bs_main_types";
import { initializeSubtree } from "~/assets/editor/bs_initialize";
import { search, type SearchOptions } from "~/assets/editor/bs_search";

/**
 * Initializes a subtree the editor is inserting. The shared setPrototypeRecursive stops at the
 * first node that already has a prototype, which is right for freshly parsed JSON but wrong here:
 * fix_object merges defaults over caller data, so an insert can arrive part live and part plain,
 * and everything plain below the first live node used to stay that way until the system reloaded.
 */
function initializeInserted(wrapper: object): number {
  return initializeSubtree(wrapper, { initialized: (node) => !isDefaultObject(node), initialize: setPrototype });
}
// Side-effect import: grafts the editor half onto Catalogue.prototype and registers the
// per-parentKey prototype hook. Must be in place before any catalogue is loaded, and this
// store is where they all come from.
import "~/assets/editor/catalogue_editor";
import { REFERENCE_FIELDS } from "~/assets/editor/bs_references";
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
  watchFile,
  writeFile,
} from "~/electron/node_helpers";
import { hasRoot } from "~/electron/web_fs";
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
import { useEditorUIState } from "./editorUIState";
import type { EditorUIState } from "./editorUIState";
import { db } from "~/assets/shared/battlescribe/cataloguesdexie";
import { getNextRevision, parseGitHubUrl } from "~/assets/shared/battlescribe/github";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { nextTick, toRaw } from "vue";
import { continuesFieldEdit, fieldEditType, type FieldEditMark } from "./field_edit_stack";
import { planMerge } from "./merge_children";
import type { Router } from "vue-router";
import { useSettingsStore } from "./settingsState";
import { useScriptsStore } from "./scriptsStore";
import { getModifierOrConditionParent } from "~/assets/shared/battlescribe/bs_modifiers";
import { entries } from "~/assets/shared/battlescribe/entries";
type CatalogueComponentT = InstanceType<typeof CatalogueVue>;
type MaybePromise<T> = T | Promise<T>;
const enableGithubIntegrationWithGitFolder = false;
export interface IEditorStore {
  selectionsParent?: object | null;
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

  scripts: ReturnType<typeof useScriptsStore>;
}
export interface CatalogueEntryItem {
  item: ItemTypes & EditorBase;
  type: string & keyof typeof entries;
  imported?: boolean;
}
export interface CatalogueState {
  changed: boolean;
  unsaved: boolean;
  incremented?: boolean;
  savingPromise?: Promise<any>;
  isChangedOnDisk?: boolean;
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
    return vue_el;
  }
  const p1 = vue_el.$parent;
  if (p1.item) return p1.item;
  const p2 = p1.$parent;
  if (p2.item) return p2.item;
  const p3 = p2.$parent;
  return p3.item;
}

type VueComponent = any;
/**
 * Consecutive edits to the same field collapse into one undo entry while the user is still
 * typing, so ctrl+Z steps back a word at a time rather than a character at a time.
 */
const FIELD_COALESCE_MS = 700;
let lastFieldEdit: FieldEditMark | null = null;
// ponytail: data folders keep catalogues at the root or one folder down; deeper is where
// backups, exports and vendor copies live. Raise if someone nests legitimately.
const LOAD_FOLDER_DEPTH = 1;
const FIX_PROFILES_DEBOUNCE_MS = 800;
const fixProfilesTimers: Record<string, ReturnType<typeof setTimeout>> = {};
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
    scripts: useScriptsStore(),
  }),

  actions: {
    async create_system(name: string, path?: string, extension?: string) {
      console.log("Creating system with name:", name);
      const id = `sys-${generateBattlescribeId()}`;
      const files = this.get_system(id);
      let folder = path ? `${removeSuffix(path.replaceAll("\\", "/"), "/")}/${name}` : "";
      if (electron) {
        if (!folder) {
          throw new Error("No folder specified");
        }
        createFolder(folder);
      } else if (folder && (await hasRoot(folder))) {
        await createFolder(folder);
      } else {
        folder = "";
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
      if (electron) {
        this.saveCatalogueInFiles(obj);
      } else {
        if (obj.fullFilePath) {
          hasRoot(obj.fullFilePath).then((ok) => {
            if (ok) this.saveCatalogueInFiles(obj);
          });
        }
        this.saveCatalogueInDb(obj);
      }
      state.isChangedOnDisk = false;
    },
    async load_systems_from_folder(
      folder: string,
      progress?: (current: number, max: number, msg?: string) => MaybePromise<unknown>,
    ) {
      if (!globalThis.electron && !(await hasRoot(folder))) {
        throw new Error(`No file access for folder ${folder}`);
      }
      const files = await getFolderFiles(folder, LOAD_FOLDER_DEPTH, [".git", ".github"]);
      if (!files?.length) return;

      console.log("Loading", files.length, "files");
      const result_system_ids = [] as string[];
      const result_files = [];
      const systems = [] as GameSystemFiles[];

      const allowed = files
        .filter((o) => isAllowedExtension(o.name))
        // a backup keeps the id of the file it copied, and catalogueFiles is keyed by id, so the
        // deeper copy used to silently replace the real one. Shallowest path wins, rest are skipped.
        .sort((a, b) => a.path.split("/").length - b.path.split("/").length);
      const seen = new Set<string>();
      for (const file of allowed) {
        try {
          progress && (await progress(result_files.length, allowed.length, file.path));
          const json = await convertToJson(file.data, file.name.endsWith("json") ? "json" : "xml");
          if (!json.catalogue && !json.gameSystem) {
            continue;
          }
          const obj = getDataObject(json);
          obj.fullFilePath = file.path.replaceAll("\\", "/");
          const systemId = json?.gameSystem?.id;
          const catalogueId = json?.catalogue?.id;
          const id = systemId ?? catalogueId;
          if (id) {
            if (seen.has(id)) {
              console.warn(`Skipping ${file.path}: ${obj.name} is already loaded from a shallower file`);
              continue;
            }
            seen.add(id);
          }
          if (systemId) {
            const systemFiles = this.get_system(systemId);
            systemFiles.setSystem(shallowReactive(json) as BSIDataSystem);
            systems.push(systemFiles);
            result_system_ids.push(systemId);
          }
          if (catalogueId) {
            const systemFiles = this.get_system(json.catalogue!.gameSystemId);
            systemFiles.catalogueFiles[catalogueId] = shallowReactive(json) as BSIDataCatalogue;
            if (!globalThis.electron) {
              // cache in the browser db so refreshing the index restores the full system
              db.catalogues.put({ content: json as BSIDataCatalogue, path: obj.fullFilePath, id: getDataDbId(json) });
            }
          }
          result_files.push(json);
        } catch (e) {
          console.error(`Error loading ${file.name} from folder: ${folder}`, e);
        }
      }
      progress && (await progress(result_files.length, allowed.length));

      for (const system of systems) {
        progress && (await progress(0, 0, "Checking for github integration"));
        try {
          await this.load_system(system);
        } catch (e) {
          progress &&
            (await progress(
              0,
              0,
              `An error occured while loading ${system.gameSystem?.gameSystem?.name ?? "this system"}:\n${e}`,
            ));
          throw e;
        }
      }

      return result_system_ids;
    },
    async load_systems_from_db(force = false) {
      if (!this.gameSystemsLoaded && !force) {
        this.gameSystemsLoaded = true;
        const systems = (await db.systems.offset(0).keys()) as string[];
        for (const system of systems) {
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
      for (const { content, path } of await dbcatalogues.toArray()) {
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
      this.get_catalogue_state(file).isChangedOnDisk = true;
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
    /**
     * Coalesces "Fix profiles" runs per game system. Editing a profile type touches every
     * profile in every catalogue, so a burst of edits should produce one pass, not one each.
     */
    queue_fix_profiles(systemId: string) {
      if (fixProfilesTimers[systemId]) clearTimeout(fixProfilesTimers[systemId]);
      fixProfilesTimers[systemId] = setTimeout(async () => {
        delete fixProfilesTimers[systemId];
        try {
          const system = this.get_system(systemId);
          await system.loadAll();
          const catalogues = system.getAllLoadedCatalogues();
          catalogues.map((o) => o.processForEditor());
          console.log(await this.scripts.run_script("Fix profiles", catalogues));
        } catch (e) {
          console.error("Fix profiles failed", e);
        }
      }, FIX_PROFILES_DEBOUNCE_MS);
    },
    async changed(node: EditorBase | Catalogue) {
      function getParents<T>(node: { parent?: T }): NonNullable<T>[] {
        const result = [] as NonNullable<T>[];
        let cur = node as typeof node;
        while (cur.parent) {
          result.push(cur.parent);
          cur = cur.parent as any as typeof node;
        }
        return result;
      }

      if (
        node.editorTypeName === "profileType" ||
        getParents(node).find((o) => o.editorTypeName === "profileType")
      ) {
        // "Fix profiles" loads every catalogue in the system and walks every object in each.
        // This fires on any `change` event under a profile type (the right panel catches them
        // by bubbling), so coalesce instead of running it once per blur.
        this.queue_fix_profiles(node.getCatalogue().getSystemId());
      }

      const catalogue = node.getCatalogue();
      if (catalogue) {
        // Re-check the node here, not only in set_field. Several right-panel fields bind
        // v-model straight to the node -- Query's includeChild* checkboxes, ComplexQuery's
        // whole affects builder -- so they never pass through set_field, and this bubbled
        // `change` is the only notice a rule reading those fields ever gets. Skipped for the
        // catalogue itself, which processForEditor's pass does not validate either.
        if (node !== catalogue) catalogue.revalidate(node as EditorBase);
        this.set_catalogue_changed(catalogue);
      }
    },
    removed(node: EditorBase | Catalogue) {
      const catalogue = node.getCatalogue();
      if (catalogue) {
        this.set_catalogue_changed(catalogue);
      }
    },
    /**
     * Returns true if the revision was incremented
     */

    async save_catalogue(
      system: GameSystemFiles,
      catalogue: Catalogue,
      incrementRevision?: "github" | "yes" | "no",
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
      cataloguesStore.touchEdited(catalogue.gameSystemId || catalogue.id);
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
                }));
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
                }));
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
              }));
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
      this.selectedEntries = next_selected_entries;
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
          this.selectedEntries.push({ obj, onunselected, payload });
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
        const nodes = [
          ...(parent?.getElementsByClassName(`collapsible-box depth-${depth}`) || []),
        ] as unknown as Array<{ vnode: VueComponent }>;
        const foundEntries = nodes.map((o) => o.vnode);
        const a = foundEntries.findIndex((o) => o === toRaw(last_element));
        const b = foundEntries.findIndex((o) => o === toRaw(this.selectedElement));
        const low = Math.min(a, b);
        const high = Math.max(a, b);
        for (let i = low; i <= high; i++) {
          const entry: any = foundEntries[i];
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
      sortByAscendingInplace(result, (selection) =>
        getEntryPath(selection)
          .map((o) => `${o.key}[${o.index}]`)
          .join("/"),
      );
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
      const bases = this.get_selections();
      if (this.filter && bases.find((o) => !o.showChildsInEditor)) {
        bases.forEach((o) => this.show(o, false));
      } else {
        const boxes = this.selections.map((o) => o.obj);
        if (boxes.find((o) => o.collapsed === true)) {
          boxes.filter((o) => o.collapsed === true).forEach((o) => o.open());
        } else {
          boxes.filter((o) => o.collapsed === false).forEach((o) => o.close());
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
    async set_clipboard(data: EditorBase[], event?: ClipboardEvent | MouseEvent) {
      if (this.clipboardmode === "json") {
        //@ts-ignore
        const shallowCopies = data.map((o) => ({ parentKey: o.parentKey, ...o, sortIndex: undefined })) as EditorBase[];
        const json = entriesToJson(shallowCopies, new Set(["parentKey"]), { forceArray: false, formatted: true });
        if ((event as ClipboardEvent)?.clipboardData) {
          (event as ClipboardEvent).clipboardData!.setData("text/plain", json);
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
            return text;
          }
        } else {
          const text = await navigator.clipboard.readText();
          try {
            return JSON.parse(text);
          } catch (e) {
            return text;
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
    async cut(event?: ClipboardEvent) {
      await this.set_clipboard(this.get_selections(), event);
      this.remove();
    },
    async copy(event?: ClipboardEvent | MouseEvent, selections?: MaybeArray<EditorBase>) {
      const toCopy = selections ? (Array.isArray(selections) ? selections : [selections]) : this.get_selections();
      await this.set_clipboard(toCopy, event);
    },
    async paste(event?: ClipboardEvent) {
      const clip = await this.get_clipboard(event);
      const script_result = await this.scripts.run_hooks("paste", event, clip);
      if (script_result) {
        this.add(script_result);
      }
    },
    get_script_args() {
      const selections = this.get_selections();
      if (!selections.length) return;
      const system = selections[0].getCatalogue().getSystem();
      const catalogues = [...new Set(selections.map((o) => o.getCatalogue()))];
      return {
        selections,
        system,
        catalogues,
      };
    },
    get_context_actions() {
      return this.scripts.run_hooks_sync("context", undefined, this.get_script_args());
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
          initializeInserted({ [item.parentKey]: copy });
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
          this.removed(entry);
          onRemoveEntry(entry);
        }
      };
      await this.do_action("dupe", undo, redo);
    },
    /**
     * Remove the current selections.
     */
    async remove(entry_or_entries?: MaybeArray<Base>) {
      const foundEntries = [] as EditorBase[];
      if (entry_or_entries) {
        for (const entry of Array.isArray(entry_or_entries) ? entry_or_entries : [entry_or_entries]) {
          foundEntries.push(entry);
        }
      } else {
        const selections = this.get_selections();
        if (!selections.length) return;
        for (const selected of selections) {
          foundEntries.push(selected);
        }
      }

      const catalogue = foundEntries[0].getCatalogue();
      const sysId = catalogue.getSystemId();

      let paths = [] as EntryPathEntry[][];
      let removeds = [] as EditorBase[];
      const redo = async () => {
        const temp = foundEntries;
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
      await this.do_action("remove", undo, redo);
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
      childKey?: string & keyof typeof entries,
      parents?: EditorBase | EditorBase[],
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
      const foundEntries = Array.isArray(data) ? data : [data];
      if (!foundEntries.length) {
        console.error("Couldn't add: no data provided");
        return;
      }
      const catalogue = parentsWithPayload[0].obj.getCatalogue();
      const fixedEntries = foundEntries.map((o) =>
        this.fix_object(childKey || o.parentKey, o, catalogue, parents ? parentsWithPayload[0].obj : undefined),
      );
      const sysId = catalogue.getSystemId();

      let addeds = [] as EditorBase[];
      const redo = async () => {
        addeds = [];
        for (const selection of parentsWithPayload) {
          const item = selection.obj;
          const selectedCatalogueKey = selection.payload as keyof typeof entries;
          await this.open(item, true);
          const toAdd = [];
          for (const entry of fixedEntries) {
            // Ensure there is array to put the childs in
            const key = fixKey(item, childKey || entry.parentKey, selectedCatalogueKey);
            if (!key) {
              const text = `Couldn't create ${childKey || entry.parentKey} in ${selectedCatalogueKey}`;
              notify({ type: "error", text });
              console.warn(text);
              continue;
            }
            if (!item[key as keyof Base]) {
              (item as any)[key] = [];
            }
            const arr = item[key as keyof Base];
            if (!Array.isArray(arr)) continue;

            if (!allowed_children(item, item.parentKey)?.has(key as string)) {
              const text = `Couldn't add ${key} to a ${item.parentKey}`;
              notify({ type: "error", text });
              console.warn(text);
              continue;
            }
            // Copy to not affect existing
            const json = entry instanceof Base ? entryToJson(entry, editorFields) : JSON.stringify(entry);
            const copy = JSON.parse(json);
            clean(copy, key as string);
            delete copy.parentKey;

            // Initialize classes from the json
            initializeInserted({ [key]: copy });
            toAdd.push({ key, entry: copy });
          }

          scrambleIds(
            catalogue,
            toAdd.map((o) => o.entry),
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
            this.changed(entry);
            addeds.push(entry);
          }
        }
        return addeds[0];
      };
      const undo = () => {
        for (const entry of addeds) {
          popAtEntryPath(catalogue, getEntryPath(entry));
          this.removed(entry);
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
    get_initial_object(key: string & keyof typeof entries, parent?: EditorBase): any {
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
          if (parent && getModifierOrConditionParent(parent)?.editorTypeName === "costType") {
            return {
              type: "instanceOf",
              field: "selections",
              scope: "self",
              childId: "roster",
            };
          }

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
        case "localConditionGroups":
          return {
            type: "atLeast",
            value: 1,
            scope: "parent",
            field: "selections",
            includeChildSelections: true,
            includeChildForces: true,
            repeats: 1,
          };
        case "sharedSelectionEntries":
        case "selectionEntries":
          return {
            type: "upgrade",
            import: true,
            name: `New ${getTypeLabel(getTypeName(key))}`,
            hidden: false,
            id: generateBattlescribeId(),
          };
        case "associationLinks":
        case "entryLinks":
          return {
            import: true,
            name: `New ${getTypeLabel(getTypeName(key))}`,
            hidden: false,
            id: generateBattlescribeId(),
          };
        case "sharedAssociations":
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
            attributes: [],
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

        case "characteristicTypes":
        case "attributeTypes":
          return {
            name: `New ${getTypeLabel(getTypeName(key))}`,
            id: generateBattlescribeId(),
          };
        case "characteristics":
        case "attributes":
        case "costs":
          return {};
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
      let profileType = catalogue.findOptionById(profile.typeId) as ProfileType | null;
      if (profile.typeName && !(profileType instanceof ProfileType)) {
        const profileTypes = catalogue
          .findOptionsByText(profile.typeName, true)
          .filter((o) => o instanceof ProfileType) as ProfileType[];
        sortByDescendingInplace(profileTypes, (o) =>
          o.characteristicTypes?.length === profile.characteristics?.length ? 1 : 0,
        );
        profileType = profileTypes[0];
      }
      if (!profileType) return;
      profile.typeName = profileType.name;
      profile.typeId = profileType.id;

      for (const c of profile.characteristics || []) {
        if (!c.typeId) {
          const characteristicType = profileType?.characteristicTypes.find((o) => o.name === c.name);
          if (characteristicType) {
            c.typeId = characteristicType.id;
          }
        } else if (!c.name && c.typeId) {
          const characteristicType = profileType?.characteristicTypes.find((o) => o.id === c.typeId);
          if (characteristicType) {
            c.name = characteristicType.name;
          }
        }
      }
      const characteristicTypes = profileType.characteristicTypes;
      const missing = characteristicTypes?.filter(
        (ct) => !profile.characteristics.find((c) => c.typeId === ct.id),
      );
      const badIndex = profile.characteristics.find(
        (c, i) => i !== characteristicTypes.findIndex((ct) => ct.id === c.typeId),
      );
      if (missing?.length || badIndex) {
        const out_characteristics = [];
        const in_characteristics = [...profile.characteristics];
        for (const ct of missing) {
          in_characteristics.push({
            name: ct.name,
            typeId: ct.id,
            $text: ct.defaultValue ?? "",
          });
        }
        for (const c of in_characteristics) {
          const idx = profileType.characteristicTypes.findIndex((ct) => ct.id === c.typeId);
          if (idx >= 0) {
            out_characteristics[idx] = c;
          }
        }
        profile.characteristics = out_characteristics;
      }
    },
    // Recursively merges objects with their default created object so that they are valid.
    fix_object<T>(
      key: string & keyof typeof entries,
      data?: T,
      catalogue?: Catalogue,
      parent?: EditorBase,
    ): T extends [] ? T[] : T {
      if (Array.isArray(data)) {
        //@ts-ignore
        return data.map((o) => this.fix_object(key, o, catalogue)) as T[];
      }
      const obj = {
        ...this.get_initial_object(key, parent),
        ...data,
      };

      if (catalogue && getTypeName(key) === "profile") {
        this.fix_profile(catalogue, obj);
      }
      for (const nested_key in obj) {
        const val = obj[nested_key];
        if ((arrayKeys as Set<string>).has(nested_key) && isObject(val)) {
          if (Array.isArray(val)) {
            obj[nested_key] = obj[nested_key].map((o: any) =>
              this.fix_object(nested_key as keyof typeof entries, o, catalogue),
            );
          } else {
            obj[nested_key] = [this.fix_object(nested_key as keyof typeof entries, val, catalogue)];
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
    async create(key: string & keyof typeof entries, data?: Record<string, any>) {
      const added = await this.add(
        { select: true, ...data },
        key,
        this.get_selections_with_payload().map((o) => o.obj),
      );
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
    async create_node(key: string & keyof typeof entries, parent: EditorBase, data?: Record<string, any>) {
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
    /**
     * Creates a node under `parent` and returns it.
     *
     * Returns undefined when the key is not an allowed child or the target is not an array,
     * which callers have to handle -- the return type used to be inferred as a bare object,
     * so neither the node-ness nor the bail-out was visible to anyone calling it.
     */
    add_node(
      _key: string & keyof typeof entries,
      parent: EditorBase,
      data?: Record<string, any>,
    ): EditorBase | undefined {
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
      initializeInserted({ [key]: obj });

      // Add it to its parent
      arr.push(obj as EditorBase);
      onAddEntry(obj as EditorBase, catalogue, parent, this.get_system(sysId));
      this.changed(obj as EditorBase);
      return obj as EditorBase;
    },
    del_node(entry: Base) {
      try {
        const catalogue = entry.catalogue;
        const manager = catalogue.manager;
        const path = getEntryPath(entry);
        const removed = popAtEntryPath(catalogue, path);
        this.removed(removed);
        onRemoveEntry(removed, manager);
      } catch (e) {
        console.error("Failed to delete", entry);
      }
    },
    can_move(obj: EditorBase) {
      if (obj.isLink()) return false;
      return true;
    },
    /**
     * The single path a field edit takes.
     *
     * Right-panel inputs used to write straight to the object with v-model, so nothing
     * downstream could tell what changed: no undo entry, no revalidation, and `changed()`
     * had to walk ancestors guessing whether a profile type was involved. Everything that
     * needs to react to a field write hangs off here.
     *
     * Passing `default` deletes the key when the value matches it, which keeps the key out
     * of the saved file rather than writing a redundant value.
     */
    set_field(node: EditorBase, key: string, value: unknown, options?: { default?: unknown }) {
      // Identity for coalescing must be the raw object (the proxy is a fresh wrapper each
      // time), but the write itself has to go through the reactive one -- writing to the raw
      // target skips Vue entirely, so undo would change the model without redrawing the input.
      const raw = $toRaw(node) as Record<string, any>;
      const target = node as unknown as Record<string, any>;
      const previous = target[key];
      const next = options && "default" in options && value === options.default ? undefined : value;
      if (previous === next) return false;

      const apply = (v: unknown) => {
        if (v === undefined) delete target[key];
        else target[key] = v;
        const catalogue = node.getCatalogue();
        // Writing targetId/childId/scope/typeId/value moves an edge: reindexing revalidates
        // the target it left as well as the one it arrived at.
        if (catalogue && REFERENCE_FIELDS.has(key)) catalogue.reindexReferences(node);
        catalogue?.revalidate(node);
        this.changed(node);
      };

      // Still typing in the same box: rewrite the entry on top of the stack instead of
      // stacking a new one, but keep the value from before the burst started.
      const now = performance.now();
      const top = this.undoStack[this.undoStackPos];
      const continues = continuesFieldEdit(lastFieldEdit, {
        node: raw,
        key,
        now,
        stackPos: this.undoStackPos,
        topType: top?.type,
        coalesceMs: FIELD_COALESCE_MS,
      });

      if (continues && top) {
        const from = lastFieldEdit!.from;
        apply(next);
        top.undo = () => apply(from);
        top.redo = () => apply(next);
        lastFieldEdit!.at = now;
        return true;
      }

      apply(next);
      this.push_undo(fieldEditType(key), () => apply(previous), () => apply(next));
      lastFieldEdit = { node: raw, key, at: now, from: previous, stackPos: this.undoStackPos };
      return true;
    },

    /**
     * Records an action that has already been applied, dropping any redo branch.
     *
     * The synchronous counterpart to do_action, which runs the action itself and so has to be
     * awaited. Anything that mutates the tree must go through one of the two, or the edit is
     * invisible to undo -- see edit_node, which for a long time did not.
     */
    push_undo(type: string, undo: () => unknown, redo: () => unknown) {
      const entry = { type, undo, redo };
      if (this.undoStackPos < this.undoStack.length - 1) {
        this.undoStack.splice(this.undoStackPos + 1, this.undoStack.length - this.undoStackPos - 1, entry);
      } else {
        this.undoStack.push(entry);
      }
      this.undoStackPos += 1;
    },

    /**
     * Replaces every entry pushed since `from` with one entry that undoes/redoes all of them.
     *
     * One user gesture is one Ctrl+Z, however many nodes it touched -- which is what makes a
     * bulk action safe to offer at all. Left alone if the position moved backwards instead
     * (something called undo() in between), since then there is no run of new entries to fold.
     */
    collapse_undo(from: number, type = "batch") {
      const added = this.undoStackPos - from;
      if (added < 2) return;
      const entries = this.undoStack.slice(from + 1, this.undoStackPos + 1);
      this.undoStack.splice(from + 1, added, {
        type,
        undo: async () => {
          for (const entry of [...entries].reverse()) await entry.undo();
        },
        redo: async () => {
          for (const entry of entries) await entry.redo();
        },
      });
      this.undoStackPos = from + 1;
    },

    /** Ends the current coalescing window, so the next edit starts a fresh undo entry. */
    end_field_edit() {
      lastFieldEdit = null;
    },

    /**
     * Sets several fields at once, as one undo entry.
     *
     * Was a bare `entry[key] = val` loop: the write landed but nothing recorded it, so an
     * edit_node change could not be undone and left the reference index stale when it wrote
     * one of REFERENCE_FIELDS. It now does what set_field does, once for the whole batch,
     * which is what makes it safe to hand to a script or an agent.
     */
    edit_node(entry: EditorBase, data?: Record<string, any>) {
      const target = entry as unknown as Record<string, any>;
      const catalogue = entry.getCatalogue();
      const changes = [] as Array<{ key: string; from: unknown; to: unknown; inserted?: EditorBase }>;
      for (const key in data) {
        const val = data[key];
        if (target[key] === val) continue;
        if (isObject(val)) {
          // @ts-ignore
          const fixed_obj = this.fix_object(key, val, catalogue);
          initializeInserted({ [key]: fixed_obj });
          changes.push({ key, from: target[key], to: fixed_obj, inserted: fixed_obj });
        } else {
          changes.push({ key, from: target[key], to: val });
        }
      }
      if (!changes.length) return false;

      const sysId = catalogue.getSystemId();
      const apply = (dir: "to" | "from") => {
        for (const change of changes) {
          const value = change[dir];
          if (value === undefined) delete target[change.key];
          else target[change.key] = value;
          // An inserted object has to be registered/unregistered as well as assigned, or undo
          // leaves it in the indexes with nothing pointing at it.
          if (change.inserted) {
            if (dir === "to") onAddEntry(change.inserted, catalogue, entry, this.get_system(sysId));
            else onRemoveEntry(change.inserted);
          }
          if (REFERENCE_FIELDS.has(change.key)) catalogue.reindexReferences(entry);
        }
        catalogue.revalidate(entry);
        this.changed(entry);
      };

      apply("to");
      this.push_undo("edit", () => apply("from"), () => apply("to"));
      return true;
    },
    /**
     * Sets the same fields on several nodes, as one undo entry.
     *
     * Data first and target last-and-optional, like add(): omit `nodes` and it edits the
     * current selection. edit_node is the single-node form this is built from.
     */
    edit(data: Record<string, any>, nodes?: MaybeArray<EditorBase>) {
      const targets = nodes ? (Array.isArray(nodes) ? nodes : [nodes]) : this.get_selections();
      if (!targets.length) {
        console.error("Couldn't edit: no selection or node(s) provided");
        return false;
      }
      const from = this.undoStackPos;
      let changed = false;
      for (const node of targets) {
        if (this.edit_node(node, data)) changed = true;
      }
      this.collapse_undo(from, "edit");
      return changed;
    },

    /**
     * Applies generated data onto an existing node, in place.
     *
     * For the regenerate loop: a script builds a whole unit, you change the script and run it
     * again. Deleting the old entry and adding the new one gives every node a fresh id, so
     * every link pointing into the unit dangles. Merging keeps the id of anything that still
     * exists, so references survive. It works because generator scripts give their nodes
     * deterministic ids -- scripts/import's id() hashes a semantic path -- so the same logical
     * child comes back with the same id, and add() keeps a preferred id when it is free.
     *
     * Never deletes: anything in the catalogue that the data no longer mentions is returned in
     * `extra` for the caller to remove(), so a hand-made addition survives a regeneration.
     * Only arrays that `data` actually mentions are looked at, and only those that are real
     * child arrays for that node -- characteristics, costs and the like are set wholesale, the
     * way the right panel sets them.
     *
     * Matching is by id when every incoming child has one and by typeName/name otherwise; pass
     * `key` to decide it yourself. `id` itself is never written: it is what identifies a node,
     * and overwriting it is how references break.
     */
    async merge(target: EditorBase, data: Record<string, any>, options?: { key?: (node: any) => string }) {
      const from = this.undoStackPos;
      const stats = { updated: 0, added: 0, extra: [] as EditorBase[] };

      const merge_into = async (node: EditorBase, incoming: Record<string, any>) => {
        const allowed = allowed_children(node, node.parentKey);
        const fields = {} as Record<string, any>;
        const childArrays = [] as Array<[string, any[]]>;
        for (const [key, value] of Object.entries(incoming)) {
          if (key === "id") continue;
          if (Array.isArray(value) && allowed?.has(key)) childArrays.push([key, value]);
          else fields[key] = value;
        }
        if (this.edit_node(node, fields)) stats.updated += 1;

        for (const [key, children] of childArrays) {
          const existing = ((node as any)[key] ?? []) as EditorBase[];
          const plan = planMerge(existing.slice(), children, options?.key);
          for (const { existing: match, incoming: child } of plan.pairs) {
            await merge_into(match, child as Record<string, any>);
          }
          for (const child of plan.added) {
            await this.add(child, key as string & keyof typeof entries, node);
            stats.added += 1;
          }
          stats.extra.push(...plan.extra);
        }
      };

      await merge_into(target, data);
      this.collapse_undo(from, "merge");
      return stats;
    },

    /**
     * Repoints everything referring to `duplicates` at `keep`, then deletes them.
     *
     * Deliberately mechanical: deciding *which* entries are duplicates and which copy to keep
     * is a judgement about the game data (see the find-duplicate-* scripts), and belongs in
     * the caller. What the caller cannot be expected to get right is the repointing -- the id
     * lives in a different field per node type (targetId on a link, typeId on a profile,
     * childId/scope on a condition, value on a modifier), so the field is found from
     * REFERENCE_FIELDS rather than assumed to be targetId. Miss one and the reference dangles,
     * showing up as a validation error somewhere else entirely.
     *
     * Repointing goes through set_field and deletion through remove, so the whole merge is
     * one undo entry.
     *
     * Called with no arguments it merges the current selection into its first node, ordered by
     * position in the tree rather than by click order so the survivor does not depend on how
     * the selection was made.
     *
     * Not to be confused with merge(), which applies generated data onto one node.
     */
    async merge_duplicates(keep?: EditorBase, duplicates?: MaybeArray<EditorBase>) {
      if (!keep) {
        const selections = this.get_sorted_selections();
        if (selections.length < 2) {
          console.error("Couldn't merge: select at least two entries, or pass them in");
          return { merged: 0, repointed: 0 };
        }
        keep = selections[0];
        duplicates = selections.slice(1);
      }
      const survivor = keep;
      const dupes = (Array.isArray(duplicates) ? duplicates : duplicates ? [duplicates] : []).filter(
        (dupe) => $toRaw(dupe) !== $toRaw(survivor)
      );
      if (!dupes.length) return { merged: 0, repointed: 0 };

      // Merging across types would repoint references at something that cannot answer for
      // them; from a selection it is an easy misclick, so it is refused rather than attempted.
      const mismatch = dupes.find((dupe) => dupe.editorTypeName !== survivor.editorTypeName);
      if (mismatch) {
        throw new Error(
          `Cannot merge a ${mismatch.editorTypeName} into a ${survivor.editorTypeName} (${getName(mismatch)})`
        );
      }

      const from = this.undoStackPos;
      let repointed = 0;
      for (const dupe of dupes) {
        // Snapshot: refs/other_refs are accessors over the reference index, which set_field
        // rewrites as we go.
        for (const ref of [...dupe.refs, ...dupe.other_refs]) {
          for (const key of REFERENCE_FIELDS) {
            if ((ref as unknown as Record<string, unknown>)[key] !== dupe.id) continue;
            if (this.set_field(ref, key, survivor.id)) repointed += 1;
            // Each write starts its own undo entry rather than extending the previous one.
            this.end_field_edit();
          }
        }
      }
      await this.remove(dupes);
      this.collapse_undo(from, "merge_duplicates");
      return { merged: dupes.length, repointed };
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
        case "categoryEntry":
          return "categoryEntries";
        case "profileType":
          return "profileTypes";
        case "costType":
          return "costTypes";
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
        const catalogueKey = this.move_to_key(obj, type) as string & keyof typeof entries;
        if (!catalogueKey) {
          console.error("Could not find key for move", obj.editorTypeName, type);
          return;
        }

        // move obj to target
        const parent = obj.parent!;
        const path = getEntryPath(obj);

        removeEntry(obj);
        this.removed(obj);
        onRemoveEntry(obj);
        const copy = JSON.parse(entryToJson(obj, editorFields));

        initializeInserted({ [catalogueKey]: copy });
        // @ts-ignore
        if (!to[catalogueKey]) to[catalogueKey] = [];

        // @ts-ignore
        to[catalogueKey]!.push(copy);
        onAddEntry(copy, to, to, this.get_system(to.getSystemId()));
        this.changed(copy);
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
          initializeInserted({ [linkKey]: link });
          path[path.length - 1].key = linkKey;
          addAtEntryPath(from, path, link);
          onAddEntry(link, from, parent, this.get_system(from.getSystemId()));
          this.changed(link);
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
      if (!current) return;

      if (obj.isCatalogue()) {
        const head = current.getElementsByClassName("head");
        return head.length ? head[0].children[0] : undefined;
      }

      // These wait on the global nextTick, not the box's: all they need is for the level
      // they just opened to be in the DOM before the next one is looked up, and depending on
      // the box exposing $nextTick tied navigation to that component's API surface.
      async function open_el(el: any) {
        const context = get_ctx(el);
        get_base_from_vue_el(context).showInEditor = true;
        context.open();
        await nextTick();
      }
      async function close_el(el: any) {
        const context = get_ctx(el);
        context.close();
        await nextTick();
      }

      const path = getEntryPath(obj);
      if (!path?.length) return;

      current = current.getElementsByClassName(`depth-0 ${path[0].key}`)[0];
      if (!current) {
        if (noLog !== true) {
          console.error("Couldn't find root element for", path[0].key, "in", obj.catalogue.getName());
        }
        return;
      }
      await this.show(obj, false);
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
          child = childs[0];
        } else {
          const arr = [];
          for (let i = 0; i < childs.length; i++) {
            arr.push(childs[i]);
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
        }).then(() => {
          delete this.$nextTickResolve;
        });
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
        obj.highlightInEditor = true;
      }
      forEachParent(obj, (parent) => {
        parent.showInEditor = true;
      });
    },
    async goto(obj?: EditorBase) {
      if (!obj) return;
      const targetCatalogue = obj.getCatalogue();
      this.put_current_state_in_history();
      const uistate = useEditorUIState();
      uistate.get_data(targetCatalogue.id).selection = getEntryPath(obj);

      await this.goto_catalogue(targetCatalogue.id, targetCatalogue.gameSystemId);
      await this.show(obj, false);
      await this.scrollto(obj);
    },
    async scroll_to_el(el: Element) {
      el.scrollIntoView({ block: "center", inline: "start", behavior: "instant" as ScrollBehavior });
    },
    async scrollto(obj: EditorBase) {
      const el = await this.open(obj);
      if (el) {
        const context = get_ctx(el);
        this.do_select(null, context);
        this.scroll_to_el(el);
      } else {
        setTimeout(async () => {
          const el = await this.open(obj);
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
        await this.goto(obj.target);
      }
    },
    async move_up(obj: EditorBase) {
      if (obj.parent) {
        const arr = siblingArray(obj.parent, obj.parentKey)!;
        const index = arr.indexOf(obj);
        if (index > 0) {
          const temp = arr.splice(index, 1)[0];
          arr.splice(index - 1, 0, temp);
          this.changed(obj);
        }
      }
    },
    async move_down(obj: EditorBase) {
      if (obj.parent) {
        const arr = siblingArray(obj.parent, obj.parentKey)!;
        const index = arr.indexOf(obj);
        if (index >= 0 && index < arr.length - 1) {
          const temp = arr.splice(index, 1)[0];
          arr.splice(index + 1, 0, temp);
          this.changed(obj);
        }
      }
    },
    sortable(entry?: EditorBase) {
      const settings = useSettingsStore();
      if (settings.sort === "none") return false;
      return entry?.editorTypeName !== "forceEntry";
    },
    get_leftpanel_open_collapsible_boxes() {
      const id = this.catalogueComponent?.cat?.id;
      if (!id) return {};
      // Copied, not aliased: this goes into the history stack, and the live tree keeps
      // changing as the user expands things. Values are plain {}, so JSON round-trips.
      return JSON.parse(JSON.stringify(useEditorUIState().get_data(id).open ?? {}));
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
        const state = this.get_current_state();
        this.put_state_in_history(state);
        history.replaceState({ data: state, index: this.historyStackPos }, "", location.href);
        history.pushState({ index: this.historyStackPos + 1 }, "", null);
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
    /**
     * The query language, over whatever is loaded. Defaults to every catalogue of every open
     * system, so a query can follow a link out of one file and into another; pass `where` to
     * pin it to one.
     *
     * Separate from update_catalogue_search below, which is the tree's plain-substring filter
     * and owns the showInEditor flags. This one just answers.
     */
    query(query: string, where?: Catalogue | Catalogue[], options?: SearchOptions): EditorBase[] {
      const scope = where ?? Object.values(this.gameSystems).flatMap((s) => [...s.getAllLoadedCatalogues()]);
      return search(scope, query, options);
    },
    async update_catalogue_search(catalogue: Catalogue, data: { filter: string; ignoreProfilesRules: boolean }) {
      const { filter, ignoreProfilesRules } = data;
      const prev = this.filtered as EditorBase[];
      for (const p of prev) {
        delete p.showInEditor;
        delete p.showChildsInEditor;
        delete p.highlightInEditor;
        forEachParent(p, (parent) => {
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
        await (globalThis.$nextTick && globalThis.$nextTick());

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
      return this.filtered;
    },
    async system_search(system: GameSystemFiles, query: { filter: string }, max = 1000) {
      const result = [] as Base[];

      const { filter } = query;
      if (!filter) return null;
      const regx = textSearchRegex(filter);
      let more = false;

      await system.loadAll();
      function search(val: Base, parent?: Base) {
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
      }

      for (const file of system.getAllLoadedCatalogues()) {
        search(file);
        file.forEachObjectWhitelist(search);
        if (result.length >= max) {
          more = true;
          break;
        }
      }
      console.log("Search for", `"${filter}"`, "found", result.length, "results");
      const grouped = {} as Record<string, Base[]>;
      for (const found of result) {
        const catalogueName = found.getCatalogue().name;
        addObj(grouped, catalogueName, found);
      }
      return { grouped, all: result, more };
    },
    /**
     * `progress_cb` is awaited, so a caller that yields in it lets the loading screen paint:
     * processForEditor is synchronous and blocks for as long as it runs, and there is one call
     * per import, so without a yield in between the whole open is a single frozen frame.
     */
    async open_catalogue(
      systemId: string,
      catalogueId?: string,
      progress_cb?: (current: number, max: number, msg?: string) => void | Promise<void>
    ) {
      const system = await this.get_or_load_system(systemId);
      let loaded = system.getLoadedCatalogue({ targetId: catalogueId || systemId });
      if (!loaded) {
        await progress_cb?.(0, 0, "Reading files");
        loaded = await system.loadCatalogue({
          targetId: catalogueId || systemId,
        });
      }
      globalThis.$catalogue = loaded as any;
      // Order matters: processForEditor is what populates `imports` (init -> generateImports),
      // so the root has to be processed before its imports can be listed at all.
      //
      // Messages only, no counter: loadAll runs straight after this over the whole system, and
      // two counters on different scales drive the one progress bar backwards when the second
      // starts. This phase is a prelude to that count, not a count of its own.
      await progress_cb?.(0, 0, `Processing ${loaded.name ?? ""}`);
      loaded.processForEditor();
      const imports = loaded.imports ?? [];
      for (const imported of imports) {
        await progress_cb?.(0, 0, `Processing ${imported.name ?? ""}`);
        imported.processForEditor();
      }

      return { system, catalogue: loaded };
    },
    // Backwards dependency

    add_child(...args: any[]) {
      // @ts-ignore
      return this.add_node(...args);
    },

    del_child(...args: any[]) {
      // @ts-ignore
      return this.del_node(...args);
    },

    edit_child(...args: any[]) {
      // @ts-ignore
      return this.edit_node(...args);
    },

    create_child(...args: any[]) {
      // @ts-ignore
      return this.create_node(...args);
    },
    label(node: EditorBase, extra = false) {
      return extra ? [getName(node), getNameExtra(node)].filter((o) => o).join(" ") : getName(node);
    },
  },
});
