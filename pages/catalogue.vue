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
      <template v-if="systemFiles && !systemFiles.allLoaded">
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
import { ItemTypes } from "~/assets/shared/battlescribe/bs_editor";
import { useEditorUIState } from "~/stores/editorUIState";
import { showMessageBox, closeWindow } from "~/electron/node_helpers";
import { getNextRevision } from "~/assets/shared/battlescribe/github";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { LeftPanelDefaults } from "~/components/catalogue/left_panel/LeftPanelDefaults";

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
      initial: true,
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
        if (JSON.stringify(newVal) === JSON.stringify(this.route)) return;
        this.route = newVal;
        const { gameSystemId, catalogueId } = newVal;
        this.id = catalogueId || gameSystemId;
        this.store.unselect();
        try {
          await this.load(gameSystemId, this.id);
          this.systemFiles?.loadAll();
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
      if (this.systemFiles) {
        try {
          this.loading_all = true;
          await new Promise((resolve) => setTimeout(resolve, 0));
          await this.systemFiles.loadAll(async (current, max, msg) => {
            this.loading_progress = current;
            this.loading_progress_max = max;
            this.loading_progress_msg = msg ?? "";
            await new Promise((resolve) => setTimeout(resolve, 0));
          });
          this.loading_progress = 0;
          this.loading_progress_max = 0;
          this.loading_progress_msg = "";
        } catch (e) {
          console.error(e);
        } finally {
          this.loading_all = true;
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
      try {
        this.loading = true;
        if (this.initial) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          this.initial = false;
        }
        const { system, catalogue } = await this.store.open_catalogue(systemId, catalogueId);
        this.systemFiles = system;
        this.cat = catalogue;
        if (catalogue) {
          (catalogue as any).opened = true;
          const data = this.uistate.get_data(catalogue.id);
          this.load_state(data);
        }
      } finally {
        this.loading = false;
      }
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
