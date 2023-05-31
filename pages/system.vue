<template>
  <div class="scrollable" v-if="!loading">
    <div class="mt-10px p-10px">
      <h2 class="inline">Select a system to load, or browse for one:</h2>
      <SelectFile class="ml-10px" @uploaded="uploaded" />
      <SelectFolder class="ml-10px" @selected="selectedFolder" />
    </div>
    <div class="p-10px">
      <div
        v-for="system in systems"
        class="item p-2px mt-2px border-gray border-solid border-1px cursor-pointer"
        @click="selected(system)"
      >
        {{ system.name }}
      </div>
    </div>
  </div>
  <div v-else class="h-full">
    <div class="flex items-center h-full">
      <div class="m-auto items-center flex flex-col">
        <div class="items-center flex">
          <img class="w-20px h-20px" src="/assets/icons/spin.gif" />
          <span class="ml-5px"> Loading... </span>
        </div>
        <div>
          <div class="text-center" v-if="progress_max">{{ progress }}/{{ progress_max }}</div>
          <div v-if="progress_msg">{{ progress_msg }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { getDataDbId } from "~/assets/shared/battlescribe/bs_system";
import { BSIDataCatalogue, BSIDataSystem } from "~/assets/shared/battlescribe/bs_types";
import { db } from "~/assets/ts/dexie";
import { getFolderFolders, getPath } from "~/electron/node_helpers";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { useEditorStore } from "~/stores/editorStore";
import { useSettingsStore } from "~/stores/settingsState";
export default defineComponent({
  head() {
    return {
      title: "NR-Editor",
    };
  },
  data() {
    return {
      loading: true,
      systems: [] as Array<{ name: string; path: string }>,
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
        const loaded = await this.store.load_systems_from_folder(item.path, async (cur, max, msg) => {
          this.progress = cur;
          this.progress_max = max;
          this.progress_msg = msg ? msg.replaceAll("\\", "/").split("/").slice(-1)[0] : "";
          console.log(this.progress, this.progress_max, this.progress_msg);
          const promise = new Promise((resolve) => setTimeout(resolve, 10));
          return promise;
        });
        this.loading = false;
        this.$router.push(`/?id=${loaded.join(",")}`);
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
    async update() {
      try {
        const result = [] as Array<{ name: string; path: string }>;
        if (!electron) {
          // const repos = await fetch_bs_repos_datas(true);
          // for (const repo of repos.repositories) {
          // result.push({ name: repo.name, path: repo.repositoryUrl });
          // }
          for (let i = 0; i < 100; i++) {
            result.push({ name: "Warhammer 40k", path: "BSData/wh40k" });
          }
        } else {
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
      } finally {
        this.loading = false;
      }
    },
  },

  async mounted() {
    await this.update();
  },
});
</script>
<style scoped>
.item:hover {
  background-color: rgba(0, 0, 0, 0.15);
}
</style>
