<template>
  <Head>
    <Title>{{ loading ? "Loading..." : [cat?.getName(), `NR-Editor`].filter((o) => o).join(" - ") }}</Title>
  </Head>
  <template v-if="error">
    <span>
      {{ error }}
    </span>
  </template>
  <template v-else-if="loading">
    <div class="h-7/8 flex items-center justify-center"><span> Loading... </span> </div>
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
        <LeftPanel class="h-full" :catalogue="cat" />
      </template>
      <template #right>
        <CatalogueRightPanel class="h-full overflow-y-auto" :catalogue="cat" @catalogueChanged="onChanged" />
      </template>
    </SplitView>
  </template>

  <Teleport to="#titlebar-content" v-if="cat">
    <div class="ml-10px">
      Editing {{ cat.name }} <span class="text-slate-300">v{{ cat.revision }}</span>
      <template v-if="changed">
        <template v-if="unsaved">
          <button class="bouton save ml-10px" @click="store.save_catalogue(cat as Catalogue)">Save</button>
        </template>
        <template v-else>
          <span class="status mx-2">saved</span>
        </template>
      </template>
      <template v-if="systemFiles && !systemFiles.allLoaded">
        <button class="bouton save ml-10px" @click="systemFiles.loadAll">Load all</button>
      </template>
    </div>
  </Teleport>
</template>

<script lang="ts">
import LeftPanel from "~/components/catalogue/left_panel/LeftPanel.vue";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { db } from "~/assets/ts/dexie";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { useEditorStore } from "~/stores/editorState";
import { ItemTypes } from "~/assets/shared/battlescribe/bs_editor";
import { GameSystemFiles } from "~/assets/ts/systems/game_system";

export default {
  components: { LeftPanel },

  data() {
    return {
      error: null as string | null,
      item: null as ItemTypes | null,
      systemFiles: null as GameSystemFiles | null,
      loading: false,
    };
  },
  beforeRouteEnter(to, from, next) {
    next(async (vue: any) => {
      try {
        await vue.load(to.query.id);
        vue.error = null;
      } catch (e: any) {
        console.error(e);
        vue.error = e;
      }
    });
  },
  setup() {
    return toRefs({ cataloguesStore: useCataloguesStore(), store: useEditorStore(), cat: null as Catalogue | null });
  },
  mounted() {
    window.addEventListener("beforeunload", this.beforeUnload);
    document.addEventListener("keydown", this.onKeydown, true);
  },
  unmounted() {
    window.removeEventListener("beforeunload", this.beforeUnload);
    document.removeEventListener("keydown", this.onKeydown);
  },
  async created() {
    try {
      await this.load(this.$route.query?.id as string);
      this.error = null;
    } catch (e: any) {
      console.error(e);
      this.error = e;
    }
  },
  computed: {
    changed() {
      if (!this.cat) return false;
      const cat = this.cat;
      return this.store.get_catalogue_state(this.cat!)?.changed || false;
    },
    unsaved() {
      if (!this.cat) return false;
      return this.store.get_catalogue_state(this.cat as Catalogue)?.unsaved || false;
    },
  },
  watch: {
    cat(nv, pv) {
      if (nv !== pv) {
        this.store.unselect();
      }
    },
  },
  methods: {
    beforeUnload(event: BeforeUnloadEvent) {
      if (this.unsaved) {
        const message = "You have unsaved changes that will be lost";
        event.returnValue = message;
        return false;
      }
    },
    onKeydown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key.toLowerCase() == "s") {
        e.preventDefault();
        e.stopPropagation();
        this.store.save_catalogue(this.cat as Catalogue);
      }
    },
    onChanged() {
      this.store.set_catalogue_state(this.cat as Catalogue, true);
    },

    async load(catalogueFileId: string) {
      if (!catalogueFileId) {
        throw new Error("couldn't load catalogue: no id");
      }
      try {
        this.loading = true;
        const catFile = await db.catalogues.get(catalogueFileId);
        const systemId = catFile ? catFile.content.catalogue.gameSystemId : catalogueFileId;
        const catalogueId = catFile ? catFile.content.catalogue.id : catalogueFileId;
        const system = await this.store.get_or_load_system(systemId);
        let loaded = system.getLoadedCatalogue({ targetId: catalogueId });
        if (!loaded) {
          loaded = await system.loadCatalogue({
            targetId: catalogueId,
            name: catFile?.content.catalogue.name,
          });
        }
        this.systemFiles = system;
        this.cat = loaded;
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

.status {
  color: lightgray;
}
</style>
