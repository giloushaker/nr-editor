import { defineStore } from "pinia";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";

import fixLinkNames from "~/default-scripts/fix-link-names.js";
import fixProfiles from "~/default-scripts/fix-profiles";
import listRefs from "~/default-scripts/list-refs";
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import { dirname, filename, listFolder, readFile, watchFile, writeFile } from "~/electron/node_helpers";
import findDuplicatesProfiles from "~/default-scripts/find-duplicates-profiles";
import towMatchedPlay from "~/default-scripts/tow/matched-play-constraints";
import { registerDiagnostic, unregisterDiagnostic } from "~/assets/editor/bs_diagnostics";
import { clearDiagnostics, type Diagnostic } from "~/assets/editor/bs_diagnostics_engine";
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

/** One input a script asks the Run panel for. */
export interface ScriptArg {
  name?: string;
  /** See ScriptArgument.vue for the list. An array offers the same value under several editors. */
  type: string | string[];
  optional?: boolean;
  description?: string;
  default?: any;
  /** For `select`: the choices. A bare string is both label and value. */
  options?: Array<string | number | { label: string; value: any }> | (() => Array<any>);
  /** For `number`. */
  min?: number;
  max?: number;
  step?: number;
  /** For `string`/`text`: shown when empty. */
  placeholder?: string;
}

/** A hook callback. Both arguments depend on the hook; see HOOKS. */
export type ScriptHook = (event?: any, arg?: any) => unknown;

/** What a script module's `default` export may declare. */
export interface ScriptDef {
  name: string;
  description?: string;
  arguments?: ScriptArg[];
  run?: (...args: any[]) => unknown;
  /** Keyed by hook name; see HOOKS below for the ones the editor calls. */
  hooks?: Record<string, ScriptHook>;
  /** Catalogue checks, registered for as long as the script is loaded. */
  diagnostics?: Diagnostic[];
  /** Set by the loader. */
  path?: string;
  error?: unknown;
}

/**
 * The hooks the editor calls, and what each one gets and may return.
 *
 * Listed here rather than only at the call sites so a script author has one place to read.
 */
export const HOOKS = {
  /** (event, {selections, system, catalogues}) -> HookResult | HookResult[] | label. Tree right-click. */
  context: "context",
  /** (event, clipboard) -> replacement data, or null to swallow the paste. */
  paste: "paste",
  /** (event, {catalogue, system}) -> awaited before the catalogue is written. */
  save: "save",
  /** (event, {system, catalogue}) -> HookResult | HookResult[]. Buttons in the editor titlebar. */
  toolbar: "toolbar",
  /** (event, {node, catalogue}) -> {title?, html?, actions?} | array. A box under the right panel. */
  panel: "panel",
  /** (event, {node, catalogue}) -> something was edited. Fires often; do your own debouncing. */
  change: "change",
  /** (event, {system, catalogue}) -> a catalogue finished loading and processing. */
  load: "load",
  /** (event, {selections}) -> the tree selection changed. */
  select: "select",
  /** (event, {nodes, catalogue}) -> awaited before entries are removed. Cannot veto. */
  beforeRemove: "beforeRemove",
} as const;

/** What a script's `context`/`toolbar` hook may hand back for one menu entry. */
export interface HookResult {
  label?: string;
  /** Which group of the asking menu to sit in; unknown names fall back to the Scripts submenu. */
  group?: string;
  /** Path under /assets, without a leading slash. */
  icon?: string;
  run?: () => unknown;
}
export type HookAction = HookResult & { label: string; run: () => unknown };

/**
 * Thrown out of `progress()` once the user presses Stop, so a script does not have to check a
 * flag after every step -- it stops at its next progress call.
 */
export class ScriptCancelled extends Error {
  constructor() {
    super("Cancelled");
    this.name = "ScriptCancelled";
  }
}

/**
 * Handed to `run()` as one extra argument after the declared ones.
 *
 * Cancellation is cooperative and so is repainting: the editor is single threaded, so a script
 * that never awaits blocks the window no matter what this offers. `progress` is async and yields,
 * which is what makes the bar move and the Stop button respond -- await it in your loop.
 */
export interface ScriptRunContext {
  progress(current: number, max?: number, message?: string): Promise<void>;
  /** For a script that would rather bail itself than be thrown out of. */
  cancelled(): boolean;
}

/** What the Run panel shows while a script is going. */
export interface ScriptProgress {
  current: number;
  max?: number;
  message?: string;
}

/** One extra box a `panel` hook contributes to the right panel. */
export interface PanelView {
  title?: string;
  html?: string;
  actions?: HookAction[];
}

/**
 * Reads a script off disk and imports it as a blob URL.
 *
 * `import(file.path)` resolved the path against the page URL, so it never worked where it
 * mattered: under file:// on Windows "C:/x/y.js" parses as the scheme "c:", under the dev
 * server it becomes http://localhost:3005/C:/x/y.js, and in web mode the path is a virtual
 * FSA path that is not fetchable at all. A blob URL behaves the same in every mode.
 *
 * ponytail: relative imports inside a script do not resolve from a blob URL. Bundle to a
 * single file -- which the docs already required. Rewrite specifiers here if that ever bites.
 */
async function importScript(path: string): Promise<any> {
  const { data } = await readFile(path);
  if (!data) throw new Error(`${path} is empty or unreadable`);
  const url = URL.createObjectURL(new Blob([data], { type: "text/javascript" }));
  try {
    return await import(/* @vite-ignore */ url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Built-in scripts that work on any game system. */
const GENERIC: ScriptDef[] = [
  fixLinkNames,
  fixProfiles,
  listRefs,
  findDuplicatesProfiles,
] as ScriptDef[];

const byName = (a: ScriptDef, b: ScriptDef) => (a.name || "").localeCompare(b.name || "");

export const useScriptsStore = defineStore("scripts", {
  state: () => ({
    hooks: {} as Record<string, Record<string, ScriptHook>>,
    /** Every registered script, keyed by file path (folder scripts) or name (built-ins). */
    scripts: {} as Record<string, ScriptDef>,
    /** Per system id, so opening the editor twice does not re-import every file. */
    loaded: {} as Record<string, ScriptDef[]>,
    /** Switched-off scripts, per system id. See disable_key for what the strings are. */
    disabled: {} as Record<string, string[]>,
    /**
     * Last argument values per system, per script, keyed by argument name.
     *
     * A script you run repeatedly is nearly always run the same way, and retyping a query or
     * re-picking a catalogue every time is the difference between a tool and a chore.
     */
    argValues: {} as Record<string, Record<string, Record<string, any>>>,
    /**
     * The script currently running on its own, if any -- a hook firing, not a button being
     * pressed. Rendered in the titlebar, because an editor that stalls for two seconds with no
     * explanation reads as a bug rather than as work being done.
     */
    background: null as { label: string; progress?: ScriptProgress } | null,
  }),

  // Only `disabled` is worth keeping: the rest holds live functions, and a script's hooks come
  // back from its file on every load anyway.
  persist: { storage: globalThis.localStorage, pick: ["disabled", "argValues"] } as any,

  actions: {
    /**
     * How a switched-off script is remembered.
     *
     * The file name rather than the full path, so moving a data folder (or opening the same
     * system on another machine) does not silently switch everything back on. It only has to be
     * unique inside one system's scripts folder, which the filesystem already guarantees.
     */
    disable_key(script: ScriptDef): string {
      return (script.path ? filename(script.path) : undefined) ?? script.name;
    },

    /** The argument values this script was last run with, keyed by argument name. */
    saved_args(systemId: string | undefined, script: ScriptDef): Record<string, any> {
      if (!systemId) return {};
      return this.argValues[systemId]?.[this.disable_key(script)] ?? {};
    },

    save_args(system: GameSystemFiles, script: ScriptDef, values: Record<string, any>) {
      const systemId = system.gameSystem?.gameSystem?.id;
      if (!systemId) return;
      if (!this.argValues[systemId]) this.argValues[systemId] = {};
      this.argValues[systemId][this.disable_key(script)] = values;
    },

    /**
     * The context handed to `run()` after its declared arguments.
     *
     * `onProgress` is what the Run panel hooks up to draw the bar; `isCancelled` is polled at
     * every progress call. Callers with no UI (the MCP tools) pass neither and get a context
     * whose progress() still yields, which is the useful half of it anyway.
     */
    run_context(onProgress?: (p: ScriptProgress) => void, isCancelled?: () => boolean): ScriptRunContext {
      const cancelled = () => Boolean(isCancelled?.());
      return {
        cancelled,
        async progress(current: number, max?: number, message?: string) {
          onProgress?.({ current, max, message });
          // setTimeout, not nextTick: this has to give the browser a chance to paint the bar and
          // deliver the Stop click, and a microtask does neither.
          await new Promise((resolve) => setTimeout(resolve));
          if (cancelled()) throw new ScriptCancelled();
        },
      };
    },

    /**
     * Runs something nobody asked for right now, with a visible indicator and a run context.
     *
     * The Run button has a card to draw a bar on; a hook that fires by itself has nowhere, so it
     * borrows the titlebar for as long as it takes.
     */
    async run_background(label: string, fn: (ctx: ScriptRunContext) => unknown) {
      const ctx = this.run_context((p) => {
        if (this.background) this.background.progress = p;
      });
      this.background = { label };
      try {
        return await this.invoke(label, () => fn(ctx));
      } finally {
        this.background = null;
      }
    },

    is_enabled(systemId: string | undefined, script: ScriptDef): boolean {
      if (!systemId) return true;
      return !this.disabled[systemId]?.includes(this.disable_key(script));
    },

    /**
     * Switches a script's always-on half on or off.
     *
     * Only hooks and diagnostics are governed: a script that also has a `run` stays runnable
     * either way, because the switch is about what it does by itself, not about the button.
     *
     * Off has to clear the findings too -- the engine can only clear ids of rules it still runs,
     * so an unregistered check would otherwise leave its errors sitting in the tree forever.
     */
    set_enabled(system: GameSystemFiles, script: ScriptDef, on: boolean) {
      const systemId = system.gameSystem?.gameSystem?.id;
      if (!systemId) return;
      const key = this.disable_key(script);
      if (!this.disabled[systemId]) this.disabled[systemId] = [];
      const list = this.disabled[systemId];
      const at = list.indexOf(key);
      if (on && at >= 0) list.splice(at, 1);
      else if (!on && at < 0) list.push(key);

      const registrationKey = script.path || script.name;
      const removed = on ? (this.register(registrationKey, script, systemId), []) : this.unregister(registrationKey, false);
      // Both directions: turning one on has to validate what is already loaded against its new
      // rules, turning one off has to wipe what its old ones wrote.
      this.revalidate_system(system, removed);
    },
    /** Built-in scripts that work on any game system. */
    get_generic_scripts(): ScriptDef[] {
      return GENERIC;
    },

    /**
     * Built-in scripts written for a single game system, filtered by system name.
     * They live here rather than in the system's own data folder because they are .ts,
     * and folder loading only handles .js.
     */
    get_system_specific_scripts(system?: GameSystemFiles): ScriptDef[] {
      const scripts = [] as ScriptDef[];
      if ((system?.gameSystem?.name ?? "").includes("Old World")) {
        scripts.push(towMatchedPlay as ScriptDef);
      }
      return scripts;
    },

    get_default_scripts(system?: GameSystemFiles): ScriptDef[] {
      return [...this.get_generic_scripts(), ...this.get_system_specific_scripts(system)];
    },

    /**
     * Loads (once) every script available for a system and registers what they contribute.
     *
     * Registration used to happen in the Run button's click handler, so a script that only
     * offered hooks did nothing at all until someone opened the Scripts page and ran it --
     * which is why the context hook, the only consumer there was, never fired in practice.
     */
    async load(system?: GameSystemFiles): Promise<ScriptDef[]> {
      const id = system?.gameSystem?.gameSystem?.id;
      if (!system || !id) return [];
      if (this.loaded[id]) return this.loaded[id];
      // Claim the slot before the first await, or two concurrent callers each import the folder.
      const scripts: ScriptDef[] = reactive([]);
      this.loaded[id] = scripts;
      for (const script of this.get_default_scripts(system)) {
        this.register(script.name, script, id);
        scripts.push(script);
      }
      await this.load_folder_scripts(system);
      scripts.sort(byName);
      return scripts;
    },

    /** Where folder scripts live: a `scripts` folder next to the .gst. Undefined for a system with no folder. */
    script_folder(system?: GameSystemFiles): string | undefined {
      const path = system?.gameSystem && getDataObject(system.gameSystem).fullFilePath;
      return path ? `${dirname(path)}/scripts` : undefined;
    },

    /** .js files in `<system folder>/scripts`, watched so saving one reloads it. */
    async load_folder_scripts(system: GameSystemFiles) {
      const folder = this.script_folder(system);
      if (!folder) return;
      let files: Array<{ name: string; path: string; directory: boolean }>;
      try {
        files = await listFolder(folder);
      } catch {
        return; // no scripts folder is the normal case, not an error
      }
      for (const file of files) {
        if (file.directory || !file.path.endsWith(".js")) continue;
        await this.load_script_file(system, file.path);
      }
    },

    /**
     * Picks up .js files dropped into the folder by hand since the first scan. Files already
     * loaded are left to their own save-watchers; only unknown paths are imported.
     */
    async rescan_folder(system?: GameSystemFiles) {
      const id = system?.gameSystem?.gameSystem?.id;
      const list = id ? this.loaded[id] : undefined;
      if (!system || !list) return;
      const folder = this.script_folder(system);
      if (!folder) return;
      let files: Array<{ name: string; path: string; directory: boolean }>;
      try {
        files = await listFolder(folder);
      } catch {
        return;
      }
      let added = 0;
      for (const file of files) {
        if (file.directory || !file.path.endsWith(".js")) continue;
        if (list.some((o) => o.path === file.path)) continue;
        await this.load_script_file(system, file.path);
        added++;
      }
      if (added) list.sort(byName);
      return added;
    },

    /**
     * Imports one .js file, registers what it contributes, and reloads it when it is saved.
     *
     * Re-loading a path reuses its entry object rather than making a second one, so the Scripts
     * page updates in place and a rewritten file does not show up twice.
     */
    async load_script_file(system: GameSystemFiles, path: string): Promise<ScriptDef> {
      const id = system.gameSystem?.gameSystem?.id;
      const list = id ? this.loaded[id] : undefined;
      const name = filename(path) || path;
      let entry = list?.find((o) => o.path === path);
      const isNew = !entry;
      if (!entry) entry = reactive({ name, path }) as ScriptDef;
      const load = async () => {
        const removed = this.unregister(path);
        for (const key of Object.keys(entry!)) delete (entry as any)[key];
        entry!.path = path;
        try {
          const module = await importScript(path);
          Object.assign(entry!, module.default ?? module);
          entry!.path = path;
          if (!entry!.name) entry!.name = name;
          this.register(path, entry!, id);
        } catch (e) {
          console.error(`Script ${path} failed to load`, e);
          entry!.name = name;
          entry!.error = e;
        }
        return removed;
      };
      await load();
      if (isNew) {
        watchFile(path, async () => {
          const removed = await load();
          this.revalidate_system(system, removed);
          notify(`Reloaded script ${entry!.name}`);
        });
        list?.push(entry);
        list?.sort(byName);
      }
      return entry;
    },

    /**
     * Writes a script into the system's scripts folder and loads it, so it is live without a
     * reload. The file is watched from here on like any other, so editing it by hand still works.
     */
    async write_script(system: GameSystemFiles, file: string, code: string): Promise<ScriptDef> {
      await this.load(system); // so the new file joins the system's list rather than loading alone
      const folder = this.script_folder(system);
      if (!folder) throw new Error("This system has no folder on disk, so it cannot hold scripts.");
      if (file.includes("/") || file.includes("\\")) throw new Error(`"${file}" must be a file name, not a path`);
      const path = `${folder}/${file.endsWith(".js") ? file : `${file}.js`}`;
      await writeFile(path, code);
      return await this.load_script_file(system, path);
    },

    /**
     * `systemId` is what makes the switch work: a disabled script is still listed and still
     * runnable, it just contributes nothing. Omit it and everything registers.
     */
    register(key: string, script: ScriptDef, systemId?: string) {
      this.scripts[key] = script;
      if (systemId && !this.is_enabled(systemId, script)) return;
      for (const [hook, func] of Object.entries(script.hooks || {})) {
        if (typeof func !== "function") continue;
        if (!this.hooks[hook]) this.hooks[hook] = {};
        this.hooks[hook][key] = func;
      }
      // toRaw: `script` is read back out of the store, so its rules arrive as reactive proxies.
      // Every rule in DIAGNOSTICS is touched once per node per validation pass, and a proxy trap
      // there costs more than the check itself.
      for (const rule of script.diagnostics || []) registerDiagnostic(toRaw(rule));
    },

    /**
     * Drops everything a script contributed. Returns the diagnostics it owned, for cleanup.
     *
     * `forget` is false when the script is only being switched off: it stays in the list and
     * stays runnable, so the entry has to survive.
     */
    unregister(key: string, forget = true): Diagnostic[] {
      const previous = this.scripts[key];
      if (forget) delete this.scripts[key];
      for (const hooks of Object.values(this.hooks)) delete hooks[key];
      const removed: Diagnostic[] = [];
      for (const rule of previous?.diagnostics || []) {
        const gone = unregisterDiagnostic(rule.id);
        if (gone) removed.push(gone);
      }
      return removed;
    },

    /**
     * Re-runs diagnostics over everything loaded, after a script's rules changed.
     *
     * `removed` rules are no longer in the registry, so the engine cannot clear their errors
     * on its own -- they are wiped explicitly in the same walk.
     *
     * ponytail: whole-system walk on every script save. It is a dev-loop action; narrow it to
     * the rules' `applies` if authoring on a big system gets slow.
     */
    revalidate_system(system: GameSystemFiles, removed: Diagnostic[] = []) {
      for (const catalogue of system.getAllLoadedCatalogues() as Array<Catalogue & EditorBase>) {
        catalogue.forEachObjectWhitelist((node: EditorBase) => {
          if (removed.length) clearDiagnostics(node, catalogue, removed);
          catalogue.revalidate(node);
        });
      }
    },

    /**
     * Runs one hook chain and returns the first answer, or `arg` untouched.
     * A hook returning null means "handled, do nothing further".
     */
    async run_hooks(key: string, event?: Event, arg?: any) {
      for (const [name, cb] of Object.entries(this.hooks[key] || {})) {
        try {
          const returned = await cb(event, arg);
          if (returned !== undefined) return returned;
        } catch (e) {
          this.report(name, key, e);
        }
      }
      return arg;
    },

    /** Fire-and-forget: every hook runs, nothing is returned. Used for `save`. */
    async emit(key: string, event?: Event, arg?: any) {
      for (const [name, cb] of Object.entries(this.hooks[key] || {})) {
        try {
          await cb(event, arg);
        } catch (e) {
          this.report(name, key, e);
        }
      }
    },

    /**
     * Collects menu entries contributed by scripts.
     *
     * A script's hook is handed the current context and returns what it wants to offer: a
     * label, an object, an array of either, or nothing to stay hidden. It used to return bare
     * script names with no way to invoke them, so the menu rendered items that did nothing.
     */
    run_hooks_sync(key: string, event?: Event, arg?: any): HookAction[] {
      const result: HookAction[] = [];
      for (const [name, cb] of Object.entries(this.hooks[key] || {})) {
        try {
          const returned = cb(event, arg) as string | HookResult | HookResult[] | undefined;
          if (!returned) continue;
          for (const one of Array.isArray(returned) ? returned : [returned]) {
            if (!one) continue;
            const obj = typeof one === "object" ? one : {};
            const label = (typeof one === "object" ? one.label : String(one)) || this.scripts[name]?.name || name;
            // `group` names a group in whatever menu is asking; an unknown one just means
            // "wherever you put things you don't have a place for".
            // A bare label means "offer me, then run the script itself".
            const run = obj.run
              ? () => this.invoke(label, () => obj.run!())
              : () => this.run_script(name, arg);
            result.push({ ...obj, label, run });
          }
        } catch (e) {
          this.report(name, key, e);
        }
      }
      return result;
    },

    /** Boxes contributed to the right panel for the selected node. */
    get_panel_views(node: EditorBase, catalogue: Catalogue): PanelView[] {
      const result: PanelView[] = [];
      for (const [name, cb] of Object.entries(this.hooks.panel || {})) {
        try {
          const returned = cb(undefined, { node, catalogue }) as PanelView | PanelView[] | undefined;
          if (!returned) continue;
          for (const one of Array.isArray(returned) ? returned : [returned]) {
            if (!one) continue;
            const title = one.title || this.scripts[name]?.name || name;
            const actions = (one.actions || []).map((a) => ({
              ...a,
              label: a.label || title,
              run: () => this.invoke(a.label || title, () => a.run?.()),
            }));
            result.push({ ...one, title, actions });
          }
        } catch (e) {
          this.report(name, "panel", e);
        }
      }
      return result;
    },

    report(script: string, hook: string, e: unknown) {
      const name = this.scripts[script]?.name || script;
      const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.error(`Script "${name}" failed in hook "${hook}"`, e);
      notify({ type: "error", text: `Script "${name}" (${hook}): ${message}` });
    },

    /**
     * Runs anything a script provides as one undoable step.
     *
     * A script that edits 400 nodes pushed 400 undo entries, so undoing it meant 400 Ctrl+Z --
     * and a half-undone bulk edit is worse than either end of it. nr_eval already collapsed;
     * scripts never did.
     */
    async invoke(label: string, fn: () => unknown) {
      const store = globalThis.$store;
      const from = store?.undoStackPos;
      try {
        return await fn();
      } catch (e) {
        // Stopping a script on purpose is not an error, and half its work is already on the undo
        // stack -- say so and let the collapse below make it one Ctrl+Z.
        if (e instanceof ScriptCancelled) {
          notify(`${label}: stopped`);
          return undefined;
        }
        console.error(`Script "${label}" failed`, e);
        notify({ type: "error", text: `${label}: ${e instanceof Error ? e.message : String(e)}` });
        return e;
      } finally {
        if (store && from !== undefined) store.collapse_undo(from, "script");
      }
    },

    /** Resolves by registration key first, then by display name, across every loaded script. */
    find_script(script: string): ScriptDef | undefined {
      return (
        this.scripts[script] ??
        Object.values(this.scripts).find((s) => s.name === script) ??
        this.get_default_scripts().find((s) => s.name === script)
      );
    },

    /**
     * Turns one raw argument value into what run() expects: the types the Run panel cannot pass
     * as-is -- a catalogue that has to be loaded first, the tree's current selection. Shared with
     * ScriptArgument.vue so the panel and a script run from elsewhere resolve them the same way.
     */
    async resolve_arg(system: GameSystemFiles, type: string, value: any): Promise<any> {
      const load = async (nameOrId: string) => {
        const found = system
          .getAllCatalogueFiles()
          .map((o) => getDataObject(o))
          .find((o) => o.name === nameOrId || o.id === nameOrId);
        if (!found) throw new Error(`No catalogue named "${nameOrId}"`);
        const result = await system.loadCatalogue({ targetId: found.id });
        result.processForEditor();
        result.imports.map((o) => o.processForEditor());
        return result;
      };
      switch (type) {
        case "catalogue[]":
          if (value === undefined || value === "All Catalogues") {
            await system.loadAll();
            const all = system.getAllLoadedCatalogues();
            all.map((o) => o.processForEditor());
            return all;
          }
          return await Promise.all((Array.isArray(value) ? value : [value]).map(load));
        case "catalogue":
          return await load(value);
        // Read at Run time on purpose: the user picks the entries in the tree, then presses Run.
        case "selection":
          return globalThis.$store?.get_selections()[0];
        case "selection[]":
          return globalThis.$store?.get_selections() ?? [];
        case "number":
          return value === "" || value === undefined ? undefined : Number(value);
        default:
          return value;
      }
    },

    /**
     * Runs a script the way the Run panel does, from values rather than from widgets: each
     * declared argument is resolved by its type, and missing ones fall back to their default.
     * `values` may be positional or keyed by argument name.
     */
    async run_script_with_args(system: GameSystemFiles, script: string, values?: any[] | Record<string, any>) {
      await this.load(system);
      const found = this.find_script(script);
      if (!found?.run) throw new Error(`No script named "${script}"`);
      const args = await Promise.all(
        (found.arguments ?? []).map((arg, i) => {
          const given = Array.isArray(values) ? values[i] : values?.[arg.name ?? String(i)];
          const type = (Array.isArray(arg.type) ? arg.type[0] : arg.type) ?? "string";
          return this.resolve_arg(system, type, given === undefined ? arg.default : given);
        }),
      );
      return await this.invoke(found.name || script, () => found.run!(...args, this.run_context()));
    },

    async run_script(script: string, ...args: any[]) {
      const found = this.find_script(script);
      if (!found?.run) {
        notify({ type: "error", text: `No script named "${script}"` });
        return;
      }
      return await this.invoke(found.name || script, () => found.run!(...args));
    },

    /** For the console, and for a script that wants to add a hook after it has loaded. */
    add_hook(hook_key: string, func_key: string, func: ScriptHook) {
      if (!this.hooks[hook_key]) {
        this.hooks[hook_key] = {};
      }
      this.hooks[hook_key][func_key] = func;
    },
  },
});

// The built-in scripts are imported at the top of this file and registered once, on `load()`. A
// hot update re-runs this module with new script objects, but the live store keeps the ones it
// already registered in `scripts`/`hooks` and its `loaded` memo stops it re-reading them -- so an
// edited default script silently kept running its old code. Nothing here can redo the
// registration in place (it needs the GameSystemFiles that load() was called with), so reload.
//
// ponytail: a reload, not a re-register. Worth revisiting if editing default-scripts/ becomes a
// tight enough loop that losing unsaved catalogue state on every save hurts.
if (import.meta.hot) import.meta.hot.accept(() => location.reload());
