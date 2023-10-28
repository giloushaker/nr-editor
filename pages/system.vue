<template>
  <div class="scrollable" v-if="!loading">
    <div class="mt-10px p-10px">
      <div
        >Working Folder: <span class="workdir">{{ settings.systemsFolder }}</span></div
      >

      <div class="boutons">
        <SelectFile @uploaded="uploaded" />
        <SelectFolder @selected="selectedFolder" />
        <CreateSystem @created="update" />
        <button class="bouton" @click="update()"> Refresh </button>
      </div>

      <p
        >You can open a system by clicking any of the systems in your working folder, listed below, or click Load System
        to load a system outside this folder.</p
      >
    </div>
    <div class="p-10px">
      <div
        v-for="system in systems"
        class="item p-2px mt-2px cursor-pointer"
        :class="{ highlight: system.highlight }"
        @click="selected(system)"
      >
        {{ system.name }}
      </div>
    </div>
  </div>
  <Loading v-else :progress_msg="progress_msg" :progress_max="progress_max" :progress="progress" />
</template>

<script lang="ts">
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { BSIDataCatalogue, BSIDataSystem } from "~/assets/shared/battlescribe/bs_types";
import { db } from "~/assets/shared/battlescribe/cataloguesdexie";
import { getFolderFolders, getPath } from "~/electron/node_helpers";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { useEditorStore } from "~/stores/editorStore";
import { useSettingsStore } from "~/stores/settingsState";
import CreateSystem from "~/components/CreateSystem.vue";
import Loading from "~/components/Loading.vue";
import { getDataDbId } from "~/assets/shared/battlescribe/bs_main";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
export default defineComponent({
  components: { CreateSystem, Loading },
  head() {
    return {
      title: "NR-Editor",
    };
  },
  data() {
    return {
      loading: true,
      systems: [] as Array<{ name: string; path: string; highlight?: boolean }>,
      progress: 0,
      progress_max: 0,
      progress_msg: "",
      error_msg: "",
    };
  },
  setup() {
    return { cataloguesStore: useCataloguesStore(), store: useEditorStore(), settings: useSettingsStore() };
  },

  methods: {
    async selectedFolder(folder: string[]) {
      this.settings.systemsFolder = Array.isArray(folder) ? folder[0] : folder;
      this.update();
    },
    async selected(item: { name: string; path: string }) {
      if (electron) {
        this.loading = true;
        this.progress_msg = "";
        const loaded = await this.store.load_systems_from_folder(item.path, async (cur, max, msg) => {
          this.progress = cur;
          this.progress_max = max;
          this.progress_msg = msg ? msg.replaceAll("\\", "/").split("/").slice(-1)[0] : "";
          const promise = new Promise((resolve) => setTimeout(resolve, 1));
          return promise;
        });
        this.loading = false;
        if (loaded?.length) {
          this.$router.push(`/?id=${loaded.join(",")}`);
        }
      }
    },
    async uploaded(files: any[]) {
      console.log("Uploaded", files.length, "files", files);
      const systems = files.filter((o) => o.gameSystem) as BSIDataSystem[];
      const ids = [];
      for (const system of systems) {
        const systemId = system.gameSystem.id;
        ids.push(systemId);
        const dbId = getDataDbId(system);
        this.store.get_system(systemId).setSystem(system);
        if (!electron) {
          db.systems.put({ content: system, id: dbId });
        }
        this.cataloguesStore.updateCatalogue(system.gameSystem);
        this.cataloguesStore.setEdited(dbId, false);
      }

      const catalogues = files.filter((o) => o.catalogue) as BSIDataCatalogue[];
      for (const catalogue of catalogues) {
        const systemId = catalogue.catalogue.gameSystemId;
        this.store.get_system(systemId).setCatalogue(catalogue);
        if (!electron) {
          db.catalogues.put({ content: catalogue, id: getDataDbId(catalogue) });
        }
        this.cataloguesStore.updateCatalogue(catalogue.catalogue);
        this.cataloguesStore.setEdited(getDataDbId(catalogue), false);
      }
      this.$router.push(`/?id=${ids.join(",")}`);
    },
    onBeforeRouteUpdate() {
      console.log("update");
      this.update();
    },
    onBeforeRouteEnter() {
      console.log("update");
    },
    async update(highlight?: GameSystemFiles) {
      try {
        const result = [] as Array<{ name: string; path: string }>;
        if (electron) {
          if (this.settings.systemsFolder) {
            const systems = await getFolderFolders(this.settings.systemsFolder);
            if (systems) {
              result.push(...systems);
            }
          } else {
            const home = await getPath("home");
            const systems = await getFolderFolders(`${home}/BattleScribe/data`);
            if (systems) {
              result.push(...systems);
            }
          }
        }
        this.systems = sortByAscending(result, (o) => o.name);
        this.systems.forEach((o) => {
          o.highlight = o.name === highlight?.gameSystem?.gameSystem?.name;
        });
      } finally {
        this.loading = false;
      }
    },
  },

  async mounted() {
    if (!this.settings.systemsFolder) {
      const home = await getPath("home");
      this.settings.systemsFolder = `${home}/BattleScribe/data`;
    }

    await this.update();
  },
});
</script>
<style lang="scss" scoped>
@import "@/shared_components/css/vars.scss";
.item {
  border: 1px solid $box_border;
}
.item:hover {
  background-color: rgba(0, 0, 0, 0.15);
}
.highlight {
  background-color: rgba(0, 0, 0, 0.5);
}

.workdir {
  font-weight: bold;
}

p {
  font-style: italic;
  margin-top: 10px;
}
</style>
