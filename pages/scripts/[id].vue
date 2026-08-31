<template>
  <div class="scripts-page">
    <div class="pagehead">
      <h1>Scripts</h1>
      <span class="mono folder" v-if="folder">{{ folder }}</span>
      <div class="right">
        <button v-if="folder" class="bouton" title="Scan the scripts folder for files added outside the editor" @click="rescan">
          Refresh
        </button>
        <button class="bouton" :disabled="!system" @click="creating = true">New script</button>
      </div>
    </div>

    <template v-if="system">
      <!--
        Always on: nothing to run, so the only control is the switch. No heading -- a card with a
        switch and no Run button says what it is, and "Run manually" below marks the boundary.
      -->
      <section v-if="alwaysOn.length">
        <div class="grid">
          <ScriptCard
            v-for="script of alwaysOn"
            :key="script.path || script.name"
            :script="script"
            :system="system"
            :class="{ wide: script.error }"
          />
        </div>
      </section>

      <section v-if="runnable.length">
        <div class="sechead">
          <b>Run manually</b>
        </div>
        <!--
          Split the way it used to be: what someone wrote for this system reads first, the
          built-ins that work anywhere after, so the two are never confused for each other.
        -->
        <template v-for="group of runnableGroups" :key="group.label">
          <div class="subhead">{{ group.label }}</div>
          <div class="column">
            <RunCard
              v-for="script of group.scripts"
              :key="script.path || script.name"
              :script="script"
              :system="system"
            />
          </div>
        </template>
      </section>

      <div v-if="!alwaysOn.length && !runnable.length" class="empty">
        No scripts yet. &ldquo;New script&rdquo; writes one into
        <span class="mono">{{ folder || "this system's folder" }}</span> and loads it straight away.
      </div>
    </template>
    <div v-else class="empty">Loading...</div>

    <details class="box info">
      <summary class="titreCategory">Writing a script</summary>
      <div class="info-body">
        <pre>
A script is one .js file in the folder above. It is loaded when the game system opens and reloaded
when you save it, so hooks and checks are live without ever pressing Run.

<code>
export default {
  name: "Display Selected",
  description: "Returns the currently selected node(s)",
  arguments: [
    { name: "catalogues", type: "catalogue[]" },
    { name: "query", type: "string", optional: true },
  ],
  run(catalogues, query) {
    return [`&lt;span style="font-weight: bold"&gt;Selected nodes:&lt;/span&gt;`, $store.get_selections()]
  }
}
</code>
<span class="bold">Arguments</span> (`type`, plus `name`, `description`, `optional`, `default`):
  catalogue          one catalogue, loaded and processed before your run() sees it
  catalogue[]        every catalogue, or one, chosen from a dropdown
  string             one line
  text               several lines; `placeholder` supported
  number             `min`, `max`, `step` supported
  boolean / toggle   a checkbox
  select             a dropdown; `options: ["a", "b"]` or [{label, value}], or a function returning either
  file               the file's text
  selection          whatever is selected in the tree when Run is pressed
  selection[]        all of it

<span class="bold">Output:</span>
return one of, or an array of: number | error | string | node[] | [node, string][]
Strings are rendered as html.

<span class="bold">Progress and stopping</span> -- run() gets one extra argument after the declared ones:
  async run(catalogues, ctx) {
    for (const [i, c] of catalogues.entries()) {
      await ctx.progress(i, catalogues.length, c.name)   // draws the bar, and yields
      ...
    }
  }
`await ctx.progress(...)` is what makes the bar move and the Stop button work: the editor is single
threaded, so a script that never awaits blocks the window whatever it reports. Stopping throws out
of the next progress() call; `ctx.cancelled()` is there if you would rather bail yourself. Whatever
the script did before stopping stays, as one undo entry.

<span class="bold">Arguments are remembered</span> per script per game system, so a query or a picked
catalogue is still there next time. `file` is the exception -- it cannot be prefilled.

<span class="bold">Hooks</span> -- `hooks: { name(event, arg) {...} }`. These fire whether or not the script was run,
and are what the switches above turn on and off:
  context   (event, {selections, system, catalogues})  right-click in the tree. Return a label, or
            {label, icon, group, run}, or an array. `group` names a group of the entry menu
            ("edit", "remove", ...); anything else goes to the Scripts submenu.
  toolbar   (event, {catalogue, system})               buttons in the editor titlebar; same shape.
  panel     (event, {node, catalogue})                 a box under the right panel:
            {title, html, actions: [{label, run}]}.
  change    (event, {node, catalogue})                 something was edited. Fires often -- do your
            own debouncing; see default-scripts/fix-profiles.js.
  save      (event, {catalogue, system})               awaited before the file is written.
  paste     (event, clipboard)                         return replacement data, or null to swallow it.
  load      (event, {system, catalogue})               a catalogue finished loading and processing,
            so the tree is indexed and the built-in checks have already run.
  select    (event, {selections})                      the tree selection changed.
  beforeRemove (event, {nodes, catalogue})             awaited before entries are removed. It cannot
            stop the removal -- it is there to read what is about to go, or to clean up after it.

<span class="bold">Diagnostics</span> -- `diagnostics: [{id, severity, applies(node), check(node, ctx)}]`.
`check` returns a message string (or {msg, severity}) when the node is wrong, nothing when it is
fine. They go in the same registry as the built-in checks, so they show in the tree and the error
list exactly like those do. Editing the script re-runs them over what is loaded.

<span class="bold">Notes:</span>
Everything a script does in one call is a single undo entry.
Interact with the editor through `$store` (also available in the console). Available actions are in
<a target="_blank" href="https://github.com/giloushaker/nr-editor/blob/master/stores/editorStore.ts">stores/editorStore.ts</a>; the hook and argument types are in
<a target="_blank" href="https://github.com/giloushaker/nr-editor/blob/master/stores/scriptsStore.ts">stores/scriptsStore.ts</a>.
Example scripts (typescript here, but folder scripts must be .js): <a target="_blank" href="https://github.com/giloushaker/nr-editor/tree/master/default-scripts">default-scripts/</a>
Imports have to be bundled into the one .js file (rollup/webpack) -- scripts are loaded standalone.
To read/write local files, use the functions on the global `$node`.
        </pre>
      </div>
    </details>

    <NewScriptDialog v-if="creating && system" :system="system" @close="creating = false" @created="created" />
  </div>
</template>

<script lang="ts">
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import ScriptCard from "~/components/scripts/ScriptCard.vue";
import RunCard from "~/components/scripts/RunCard.vue";
import NewScriptDialog from "~/components/scripts/NewScriptDialog.vue";
import { useEditorStore } from "~/stores/editorStore";
import type { ScriptDef } from "~/stores/scriptsStore";

export default defineComponent({
  components: { ScriptCard, RunCard, NewScriptDialog },
  setup() {
    return { store: useEditorStore() };
  },
  data() {
    return {
      system: null as GameSystemFiles | null,
      scripts: [] as ScriptDef[],
      creating: false,
    };
  },
  // The folder is scanned once per session; coming back to the page picks up hand-added files.
  activated() {
    if (this.system) this.store.scripts.rescan_folder(this.system);
  },
  async mounted() {
    this.system = await this.store.get_or_load_system((this.$route.params as { id: string }).id);
    // get_or_load_system already loads them; this is the same cached array.
    this.scripts = await this.store.scripts.load(this.system);
  },
  computed: {
    folder(): string | undefined {
      return this.system ? this.store.scripts.script_folder(this.system) : undefined;
    },
    /**
     * The two kinds of script, and a script may be both: the switch governs what it does by
     * itself, the Run button governs what it does when asked. Fix profiles is both.
     */
    alwaysOn(): ScriptDef[] {
      // Object.keys, not truthiness: `hooks: {}` is an object, and a card offering a switch
      // over nothing is worse than no card.
      return this.scripts.filter((o) => o.error || Object.keys(o.hooks ?? {}).length || o.diagnostics?.length);
    },
    runnable(): ScriptDef[] {
      return this.scripts.filter((o) => typeof o.run === "function");
    },
    /**
     * By name, not by identity: `scripts` came out of a reactive array, so its entries are
     * proxies and never `===` the raw objects GENERIC holds.
     */
    runnableGroups(): Array<{ label: string; scripts: ScriptDef[] }> {
      const generic = new Set(this.store.scripts.get_generic_scripts().map((o) => o.name));
      // A folder script lives in this system's folder, so it is this system's whatever it is called.
      const isGeneric = (o: ScriptDef) => !o.path && generic.has(o.name);
      return [
        { label: this.system?.gameSystem?.name || "This game system", scripts: this.runnable.filter((o) => !isGeneric(o)) },
        { label: "Any game system", scripts: this.runnable.filter(isGeneric) },
      ].filter((o) => o.scripts.length);
    },
  },
  methods: {
    async rescan() {
      const added = await this.store.scripts.rescan_folder(this.system!);
      notify(added ? `Found ${added} new script${added === 1 ? "" : "s"}` : "No new files in the scripts folder");
    },
    created(script: ScriptDef) {
      // write_script pushed it into the same array `load` returned, so nothing to re-fetch.
      this.creating = false;
      if (!this.scripts.includes(script)) this.scripts.push(script);
    },
  },
});
</script>

<style lang="scss" scoped>
@use "@/shared_components/css/vars.scss" as *;

.scripts-page {
  height: 100%;
  overflow-y: auto;
  padding: 10px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pagehead {
  display: flex;
  align-items: center;
  gap: 10px;

  > h1 {
    font-size: 19px;
    margin: 0;
    font-weight: bold;
  }

  .right {
    margin-left: auto;
  }
}

.folder {
  font-size: 12px;
  /* opacity, not `.gray`: that class is a hardcoded #808080 and fails on the dark theme. */
  opacity: 0.7;
  /* The path is the least important thing here and the first that may be dropped. */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sechead {
  display: flex;
  align-items: baseline;
  gap: 9px;
  padding: 0 2px 6px;

  /* A divider between the two kinds of card, so it sits below them in the ramp:
     page title 19 > card name 15 > description 13 > this. */
  > b {
    font-size: 13px;
    opacity: 0.8;
  }
}

/**
 * Two columns: the toggle cards are short and read rarely, so they should not push the run cards
 * (and their output, which is what you came for) below the fold.
 */
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  /* A broken script has more to say than a working one, and no switch to line up with. */
  > .wide {
    grid-column: span 2;
  }
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);

    > .wide {
      grid-column: auto;
    }
  }
}

/* Below the section head in the ramp, and above the cards it labels. */
.subhead {
  font-size: 12px;
  opacity: 0.6;
  padding: 0 2px 4px;

  /* Only between groups -- the first one already has the section head above it. */
  & ~ & {
    padding-top: 12px;
  }
}

.column {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty {
  padding: 6px 2px;
  font-size: 13.5px;
  opacity: 0.75;
}

.mono {
  font-family: monospace;
}

details.info {
  padding: 0;

  > summary {
    cursor: pointer;
    font-weight: bold;
  }

  pre {
    margin: 10px;
  }
}
</style>
