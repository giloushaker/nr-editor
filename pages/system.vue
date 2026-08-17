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
        <button v-if="needsPermission" class="bouton" @click="grantAccess">
          Grant access to "{{ settings.systemsFolder }}"
        </button>
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
        {{ system.name }} <span v-if="system.id" class="gray">(browser storage)</span>
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
import { hasRoot, permissionState, requestPermission, restoreHandles } from "~/electron/web_fs";
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
      needsPermission: false,
      systems: [] as Array<{ name: string; path?: string; id?: string; highlight?: boolean }>,
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
    async selected(item: { name: string; path?: string; id?: string }) {
      this.loading = true;
      this.progress_msg = "";
      try {
        if (item.id) {
          await this.store.get_or_load_system(item.id);
          this.settings.activeSystems = [item.id];
          this.$router.push(`/?id=${item.id}`);
          return;
        }
        const loaded = await this.store.load_systems_from_folder(item.path!, async (cur, max, msg) => {
          this.progress = cur;
          this.progress_max = max;
          this.progress_msg = msg ? msg.replaceAll("\\", "/").split("/").slice(-1)[0] : "";
          const promise = new Promise((resolve) => setTimeout(resolve, 1));
          return promise;
        });
        if (loaded?.length) {
          if (!electron) {
            this.settings.activeSystems = loaded;
          }
          this.$router.push(`/?id=${loaded.join(",")}`);
        }
      } finally {
        this.loading = false;
      }
    },
    async grantAccess() {
      if (this.settings.systemsFolder && (await requestPermission(this.settings.systemsFolder))) {
        await this.update();
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
      for (const system of systems) {
        const sys = this.store.get_system(system.gameSystem.id);
        this.store.load_system(sys);
      }
      if (!electron) {
        this.settings.activeSystems = ids;
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
        this.needsPermission = false;
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
        } else if (this.settings.systemsFolder && (await hasRoot(this.settings.systemsFolder))) {
          if ((await permissionState(this.settings.systemsFolder)) !== "granted") {
            this.needsPermission = true;
          } else {
            const systems = await getFolderFolders(this.settings.systemsFolder);
            if (systems) {
              result.push(...systems);
            }
          }
        }
        if (!electron) {
          // systems stored in the browser db, unless already listed via the working folder
          const folderPaths = result.map((o) => `${o.path}/`);
          for (const row of await db.systems.toArray()) {
            const gameSystem = row.content?.gameSystem;
            if (!gameSystem) continue;
            const filePath = gameSystem.fullFilePath || row.path || "";
            if (filePath && folderPaths.some((p) => filePath.startsWith(p))) continue;
            result.push({ name: gameSystem.name, id: row.id });
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
    if (electron && !this.settings.systemsFolder) {
      const home = await getPath("home");
      this.settings.systemsFolder = `${home}/BattleScribe/data`;
    }
    if (!electron) {
      await restoreHandles();
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
