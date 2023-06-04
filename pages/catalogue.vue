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
      <Loading />
    </template>
    <template v-else-if="cat">
      <SplitView
        class="h-full"
        draggable
        :split="true"
        :double="true"
        :showRight="store.selectedItem != null"
        id="catalogueView"
      >
        <template #left>
          <LeftPanel ref="leftpanel" class="h-full" :catalogue="cat" :defaults="defaults" />
        </template>
        <template #right>
          <CatalogueRightPanel class="h-full overflow-y-auto" :catalogue="cat" @catalogueChanged="onChanged" />
        </template>
      </SplitView>
    </template>

    <Teleport to="#titlebar-content" v-if="cat && route_is_catalogue">
      <span class="ml-10px">
        Editing {{ cat.name }} <span class="text-slate-300">v{{ cat.revision }}</span>
      </span>
      <template v-if="changed">
        <template v-if="unsaved">
          <button class="bouton save ml-10px" @click="save">Save</button>
        </template>
        <template v-else-if="failed">
          <span class="status mx-2 text-red">failed to save</span>
        </template>
        <template v-else>
          <span class="status mx-2">saved</span>
        </template>
      </template>
      <template v-if="systemFiles && !systemFiles.allLoaded">
        <button class="bouton load ml-10px" @click="systemFiles.loadAll">Load all refs</button>
      </template>
    </Teleport>
  </div>
</template>

<script lang="ts">
import LeftPanel, { LeftPanelDefaults } from "~/components/catalogue/left_panel/LeftPanel.vue";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { get_ctx, useEditorStore } from "~/stores/editorStore";
import { ItemTypes, getAtEntryPath, getEntryPath } from "~/assets/shared/battlescribe/bs_editor";
import { GameSystemFiles } from "~/assets/ts/systems/game_system";
import { useEditorUIState } from "~/stores/editorUIState";
import { showMessageBox, closeWindow } from "~/electron/node_helpers";

export default {
  components: { LeftPanel },
  data() {
    return {
      error: null as string | null,
      item: null as ItemTypes | null,
      systemFiles: null as GameSystemFiles | null,
      loading: false,
      id: "",
      cat: null as Catalogue | null,
      failed: false,
      defaults: {} as Partial<typeof LeftPanelDefaults>,
    };
  },
  setup() {
    return { cataloguesStore: useCataloguesStore(), store: useEditorStore(), uistate: useEditorUIState() };
  },
  mounted() {
    window.addEventListener("beforeunload", this.beforeUnload);
    document.addEventListener("keydown", this.onKeydown, true);
  },
  unmounted() {
    window.removeEventListener("beforeunload", this.beforeUnload);
    document.removeEventListener("keydown", this.onKeydown);
  },
  beforeRouteUpdate() {
    if (this.id) {
      this.save_state();
    }
  },
  beforeRouteLeave() {
    if (this.id) {
      this.save_state();
    }
  },
  created() {
    this.store.init(this.$router);
    (globalThis as any).$catalogue = this.cat;
    (globalThis as any).$system = this.cat?.getGameSystem();
  },
  computed: {
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
    save() {
      try {
        this.store.save_catalogue(this.cat as Catalogue);
        this.failed = false;
      } catch (e) {
        this.failed = true;
      }
    },
    async beforeUnload(event: BeforeUnloadEvent) {
      if (globalThis._closeWindow) return;
      if (!this.loading) {
        this.save_state();
      }

      if (this.unsaved) {
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
      }
      return false;
    },
    onKeydown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key.toLowerCase() == "s") {
        e.preventDefault();
        e.stopPropagation();
        this.store.save_catalogue(this.cat as Catalogue);
      }
    },
    onChanged() {
      this.store.set_catalogue_changed(this.cat as Catalogue, true);
    },
    save_state() {
      if (this.cat) {
        const selected = this.store.get_selected();
        const leftpanel = this.$refs.leftpanel as typeof LeftPanelDefaults;
        const leftpanelstate = {} as Record<string, any>;
        for (const key of Object.keys(LeftPanelDefaults) as (keyof typeof LeftPanelDefaults)[]) {
          leftpanelstate[key] = leftpanel[key];
        }
        this.uistate.save(this.cat.id, {
          selection: selected ? getEntryPath(selected) : undefined,
          ...leftpanelstate,
        });
      }
    },
    async load_state(data: Record<string, any>) {
      const { selection } = data;
      this.defaults = data;

      if (!selection) return;
      let obj = getAtEntryPath(this.cat as Catalogue, selection);
      if (!obj) {
        const last = selection[selection.length - 1];
        obj = (this.cat as Catalogue).findOptionById(last.id) as EditorBase | undefined;
      }
      if (obj) {
        try {
          const el = await this.store.open(obj);
          if (el) {
            const ctx = get_ctx(el);
            await ctx.do_select();
          }
        } catch (e) {}
      }
    },
    async load(systemId: string, catalogueId?: string) {
      if (!catalogueId && !systemId) {
        throw new Error("couldn't load catalogue: no id");
      }
      try {
        this.loading = true;
        await new Promise((resolve) => setTimeout(resolve));
        const system = await this.store.get_or_load_system(systemId);
        let loaded = system.getLoadedCatalogue({ targetId: catalogueId || systemId });
        if (!loaded) {
          loaded = await system.loadCatalogue({
            targetId: catalogueId || systemId,
          });
        }
        this.systemFiles = system;
        this.cat = loaded;
        if (loaded) {
          const data = this.uistate.get_data(loaded.id);
          await this.load_state(data);
        }
      } finally {
        this.loading = false;
      }
    },
  },
};
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
