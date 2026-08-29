<template>
  <div class="h-full">
    <Head>
      <Title>{{ loading ? "Loading..." : [cat?.getName(), `NR-Editor`].filter((o) => o).join(" - ") }}</Title>
    </Head>
    <template v-if="error">
      <span>
        {{ error }}
      </span>
    </template>
    <template v-else-if="loading">
      <Loading :progress="loading_progress" :progress_max="loading_progress_max" :progress_msg="loading_progress_msg" />
    </template>
    <template v-else-if="cat">
      <SplitView class="h-full" draggable showMiddle id="catalogueView">
        <template #left>
          <LeftPanel ref="leftpanel" class="h-full" :catalogue="cat" :defaults="defaults" :key="key" keepalive />
        </template>
        <template #middle>
          <CatalogueRightPanel :catalogue="cat" v-if="store.selectedItem != null" />
        </template>
      </SplitView>
    </template>

    <Teleport to="#titlebar-content" v-if="cat && route_is_catalogue">
      <span class="ml-10px">
        Editing
        <img
          class="inline"
          style="vertical-align: -2px"
          v-if="self_or_imports_changed"
          title="This file or one of it's dependencies was changed by another program. 
You may want to reload the system through the Systems tab"
          src="/assets/icons/warning_sign.png"
        />
        {{ cat.name }} <span class="text-slate-300">v{{ cat.revision }}</span>
      </span>
      <template v-if="has_unsaved_changes">
        <button class="bouton save ml-10px" @click="save_all"> Save All </button>
      </template>
      <template v-else-if="failed">
        <span class="status mx-2 text-red">failed to save</span>
      </template>
      <template v-else>
        <span class="status mx-2">saved</span>
      </template>
      <!-- a load already pulls in the whole system, so during one this is both useless and a
           duplicate of the counter on the loading screen -->
      <template v-if="systemFiles && !systemFiles.allLoaded && !loading">
        <button class="bouton load ml-10px" @click="load_all"
          >Load all
          <span v-if="loading_all">({{ loading_progress }} / {{ loading_progress_max }})</span>
        </button>
      </template>
    </Teleport>
  </div>
</template>

<script lang="ts">
import LeftPanel from "~/components/catalogue/left_panel/LeftPanel.vue";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { useEditorStore } from "~/stores/editorStore";
import type { ItemTypes } from "~/assets/editor/bs_editor";
import { useEditorUIState } from "~/stores/editorUIState";
import { showMessageBox, closeWindow } from "~/electron/node_helpers";
import { getNextRevision } from "~/assets/shared/battlescribe/github";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { LeftPanelDefaults } from "~/components/catalogue/left_panel/LeftPanelDefaults";

/**
 * Shortest gap between two yields while loading a system, and how much slower than the yield
 * itself we are willing to be. Yielding is what lets the loading screen repaint, so it has to
 * happen often enough for the counter to move; behind the loading screen a repaint is cheap,
 * but the "Load all" button runs this same pass with the whole tree on screen, where a repaint
 * costs whatever the expanded tree costs.
 *
 * ponytail: measuring the last yield and working COST x RATIO before the next one keeps paint
 * overhead near 1/RATIO either way. A fixed interval fails exactly where it matters, on the
 * big trees. Swap for scheduler.yield() when Electron ships it.
 */
const LOAD_YIELD_MIN_MS = 100;
const LOAD_YIELD_RATIO = 5;

export default defineComponent({
  components: { LeftPanel },
  data() {
    return {
      error: null as string | null,
      item: null as ItemTypes | null,
      systemFiles: null as GameSystemFiles | null,
      loading: false,
      loading_all: false,
      loading_progress: 0,
      loading_progress_max: 0,
      loading_progress_msg: "" as string,
      saving: false,
      failed: false,
      id: "",
      cat: null as Catalogue | null,
      defaults: {} as Partial<typeof LeftPanelDefaults>,
      key: 1,
      route: null as { catalogueId: string; gameSystemId: string } | null,
    };
  },
  setup() {
    return { cataloguesStore: useCataloguesStore(), store: useEditorStore(), uistate: useEditorUIState() };
  },
  mounted() {
    this.store.init(this);
    (globalThis as any).$catalogue = this.cat;

    window.addEventListener("beforeunload", this.beforeUnload);
    document.addEventListener("keydown", this.onKeydown, true);
  },
  updated() {
    this.store.init(this);
    (globalThis as any).$catalogue = this.cat;
  },
  unmounted() {
    window.removeEventListener("beforeunload", this.beforeUnload);
    document.removeEventListener("keydown", this.onKeydown, true);
  },
  activated() {
    window.addEventListener("beforeunload", this.beforeUnload);
  },
  deactivated() {
    window.removeEventListener("beforeunload", this.beforeUnload);
  },
  beforeRouteUpdate() {
    if (this.id) {
      this.store.save_state();
    }
  },
  beforeRouteLeave() {
    if (this.id) {
      this.store.save_state();
    }
  },
  beforeRouteEnter() {},
  computed: {
    has_unsaved_changes() {
      const changes = this.store.unsavedChanges;
      for (const key in changes) {
        const val = changes[key];
        if (this.cat && !key.includes(this.cat?.getSystemId())) continue;
        if (val.unsaved) return true;
      }
      return false;
    },
    self_or_imports_changed() {
      return this.file_changed(this.cat as Catalogue) || this.cat?.imports?.find((o) => this.file_changed(o));
    },
    changed() {
      if (!this.cat) return false;
      return this.store.get_catalogue_state(this.cat as Catalogue)?.changed || false;
    },
    unsaved() {
      if (!this.cat) return false;
      return this.store.get_catalogue_state(this.cat as Catalogue)?.unsaved || false;
    },
    query() {
      return {
        gameSystemId: this.$route.query.systemId,
        catalogueId: this.$route.query.id || this.$route.query.systemId,
      };
    },
    route_is_catalogue() {
      return this.$route.name === "catalogue";
    },
  },
  watch: {
    query: {
      async handler(newVal) {
        if (!this.route_is_catalogue) return;
        if (JSON.stringify(newVal) === JSON.stringify(this.route)) {
          this.$nextTick(() => {
            this.store.$nextTickResolve && this.store.$nextTickResolve();
          });
        }
        this.route = newVal;
        const { gameSystemId, catalogueId } = newVal;
        this.id = catalogueId || gameSystemId;
        this.store.unselect();
        try {
          await this.load(gameSystemId, this.id);
          this.error = null;

          // Resolve a promise in the store so that code elsewhere can wait for this to load
          this.$nextTick(() => {
            this.store.$nextTickResolve && this.store.$nextTickResolve();
          });
        } catch (e: any) {
          console.error(e);
          this.error = e;
        }
      },
      immediate: true,
    },
  },
  methods: {
    file_changed(catalogue: Catalogue) {
      return this.store.get_catalogue_state(catalogue).isChangedOnDisk;
    },
    async load_all() {
      if (this.systemFiles && !this.systemFiles.allLoaded) {
        try {
          this.loading_all = true;
          await new Promise((resolve) => setTimeout(resolve, 0));
          let last_yield = performance.now();
          let yield_cost = 0;
          // loadAll reports twice per catalogue, so this runs a few hundred times on a big
          // system. Only the calls that end in a paint do any work: a value written between
          // two yields is overwritten before anyone can see it, and each write costs a
          // re-render. Deliberately not async either, so the calls that do nothing cost
          // nothing rather than a promise and a microtask each.
          const on_load_progress = (current: number, max: number, msg?: string) => {
            const gap = Math.max(LOAD_YIELD_MIN_MS, yield_cost * LOAD_YIELD_RATIO);
            if (performance.now() - last_yield < gap) return;
            this.set_progress(current, max, msg ?? "");
            const before = performance.now();
            return new Promise<void>((resolve) => setTimeout(resolve)).then(() => {
              // Time inside the timeout is the browser's: layout, paint, input handlers.
              yield_cost = performance.now() - before;
              last_yield = performance.now();
            });
          };
          await this.systemFiles.loadAll(on_load_progress);
        } catch (e) {
          console.error(e);
        } finally {
          this.loading_all = false;
        }
      }
    },
    async save_all() {
      try {
        this.failed = await this.store.save_all(this.cat?.getSystemId());
      } finally {
        this.saving = false;
      }
    },
    async save() {
      try {
        const increment = await this.store.prompt_revision(this.cat as Catalogue);
        const incremented = await this.store.save_catalogue(
          this.systemFiles as GameSystemFiles,
          this.cat as Catalogue,
          increment
        );
        if (incremented) {
          notify("Incremented 1 catalogue's revision");
        }
        this.failed = false;
      } catch (e) {
        this.failed = true;
      }
    },
    async test() {
      if (!this.systemFiles?.github) {
        console.error("no github set");
        return;
      }
      console.log("revision", await getNextRevision(this.systemFiles.github, this.cat as Catalogue));
    },
    async beforeUnload(event: BeforeUnloadEvent) {
      if (globalThis._closeWindow) return;
      if (!this.loading) {
        this.store.save_state();
      }

      if (this.unsaved || this.store.unsavedCount) {
        const message = "You have unsaved changes that will be lost";
        event.returnValue = message;
        if (electron) {
          setTimeout(async () => {
            const result = await showMessageBox({
              message: "You have unsaved changes that will be lost?",
              buttons: ["Cancel", "Leave"],
              defaultId: 0,
              cancelId: 0,
              type: "question",
            });
            if (result === 1) {
              globalThis._closeWindow = true;
              closeWindow();
            }
          });
        }
        return false;
      }
    },
    onKeydown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key.toLowerCase() == "s") {
        e.preventDefault();
        e.stopPropagation();
        this.save();
      }
    },
    load_state(data: Record<string, any>) {
      this.defaults = data;
    },

    async load(systemId: string, catalogueId?: string) {
      if (!catalogueId && !systemId) {
        throw new Error("couldn't load catalogue: no id");
      }
      // Nothing to read and nothing to process: this open must not enter the loading state at
      // all. Skipping only the forced repaint below was not enough -- `loading` still flipped,
      // so the loading screen mounted and the editor waited on it, and re-opening a catalogue
      // that was already in memory showed a bar where it used to be instant.
      const instant = this.opens_instantly(systemId, catalogueId);
      try {
        if (!instant) {
          this.loading = true;
          this.set_progress(0, 0, "");
          // rAF then a task: rAF runs after Vue has flushed the DOM, the timeout after the
          // browser has painted it. Without this the loading screen never reaches the screen,
          // because open_catalogue blocks the thread and clears `loading` in the same frame.
          await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)));
        }
        const { system, catalogue } = await this.store.open_catalogue(systemId, catalogueId, this.on_progress);
        this.systemFiles = system;
        if (catalogue) {
          (catalogue as any).opened = true;
          const data = this.uistate.get_data(catalogue.id);
          this.load_state(data);
        }
        // Finish the whole system before handing over the editor. The tree renders imported
        // entries, so showing it half-loaded means a tree that keeps shifting under the user,
        // and every catalogue that lands repaints however much of it is expanded.
        await this.load_all();
        this.cat = catalogue;
      } finally {
        this.loading = false;
        this.set_progress(0, 0, "");
      }
    },

    /**
     * Whether this open will finish in one frame, with nothing to read and nothing to process.
     *
     * `allLoaded` covers the processing: loadAll runs processForEditor over the whole system,
     * and both that and init are guarded, so everything is already done for the catalogue and
     * for its imports.
     */
    opens_instantly(systemId: string, catalogueId?: string) {
      const system = this.store.gameSystems[systemId];
      if (!system?.allLoaded) return false;
      return Boolean(system.getLoadedCatalogue({ targetId: catalogueId || systemId }));
    },
    set_progress(current: number, max: number, msg: string) {
      this.loading_progress = current;
      this.loading_progress_max = max;
      this.loading_progress_msg = msg;
    },
    /** Yields so the progress it just set gets painted before the next blocking step. */
    async on_progress(current: number, max: number, msg?: string) {
      this.set_progress(current, max, msg ?? "");
      await new Promise((resolve) => setTimeout(resolve));
    },
  },
});
</script>

<style scoped>
.save {
  width: 100px;
}

.load {
  width: 150px;
}

.status {
  color: lightgray;
}
</style>
