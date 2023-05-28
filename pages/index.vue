<template>
  <div class="p-10px">
    <div class="box">
      <h3>My Catalogues</h3>
      <div class="boutons">
        <SelectFile v-if="electron" @uploaded="filesUploaded" />
        <UploadJson v-if="!electron" @uploaded="filesUploaded" />
        <ImportFromGithub @uploaded="filesUploaded" />
      </div>
    </div>
  </div>

  <div class="mx-10px box h-full pb-200px">
    <SplitView
      :split="true"
      :double="true"
      :showRight="selectedItem != null"
      leftWidth="calc(100% - 400px)"
      rightWidth="400px"
    >
      <template #left>
        <div class="scrollable">
          <fieldset v-for="gst in store.gameSystems">
            <legend>
              {{ gst.gameSystem?.gameSystem.name || "Unknown GameSystem" }}
            </legend>
            <IconContainer
              :items="systemAndCatalogues(gst)"
              @itemClicked="itemClicked"
              @itemDoubleClicked="itemDoubleClicked"
              @new="newCatalogue(gst)"
              v-model="selectedItem"
            />
          </fieldset>
        </div>
      </template>
      <template #right>
        <div v-if="selectedItem" class="scrollable">
          <template v-if="mode === 'create'">
            <CataloguesCreate @create="createCatalogue" :catalogue="selectedItem" />
          </template>
          <template v-else>
            <CataloguesDetail @delete="deleteCatalogue" @edit="editCatalogue" :catalogue="selectedItem" />
          </template>
        </div>
      </template>
    </SplitView>
  </div>
</template>

<script lang="ts">
import { BSIData, BSIDataCatalogue, BSIDataSystem } from "~/assets/shared/battlescribe/bs_types";
import { getDataDbId, getDataObject } from "~/assets/shared/battlescribe/bs_system";
import UploadJson from "~/components/UploadJson.vue";
import CataloguesDetail from "~/components/my_catalogues/CataloguesDetail.vue";
import { db } from "~/assets/ts/dexie";
import { GameSystemFiles } from "~/assets/ts/systems/game_system";
import CataloguesCreate from "~/components/my_catalogues/CataloguesCreate.vue";
import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { useEditorStore } from "~/stores/editorState";
import ImportFromGithub from "~/components/ImportFromGithub.vue";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import SelectFile from "~/components/SelectFile.vue";
import { dirname } from "~/electron/node_helpers";

export default defineComponent({
  components: {
    UploadJson,
    CataloguesDetail,
    ImportFromGithub,
    CataloguesCreate,
    SelectFile,
  },
  head() {
    return {
      title: "NR-Editor",
    };
  },
  data() {
    return {
      msg: "",
      selectedItem: null as BSIDataCatalogue | BSIDataSystem | null,
      mode: "edit",
      editingItem: null as BSIData | null,
    };
  },
  setup() {
    return { cataloguesStore: useCataloguesStore(), store: useEditorStore() };
  },
  created() {
    this.store.load_systems_from_db();
  },
  computed: {
    electron() {
      return Boolean(globalThis.electron);
    },
  },
  methods: {
    systemAndCatalogues(gst: GameSystemFiles) {
      let res = [];
      if (gst.gameSystem) {
        res.push(gst.gameSystem);
      }
      if (gst.catalogueFiles) {
        res.push(...Object.values(gst.catalogueFiles));
      }
      return res;
    },

    itemClicked(item: BSIDataCatalogue) {
      this.selectedItem = item;
      this.mode = "edit";
    },

    itemDoubleClicked(item: BSIDataCatalogue) {
      this.$router.push({
        name: "catalogue",
        query: { id: getDataDbId(item) },
      });
    },
    newCatalogue(gst: GameSystemFiles) {
      if (!gst.gameSystem) return;
      const gameSystem = gst.gameSystem.gameSystem;
      this.mode = "create";
      this.selectedItem = {
        catalogue: {
          library: false,
          id: generateBattlescribeId(),
          name: "New Catalogue",
          gameSystemId: gameSystem.id,
          gameSystemRevision: gameSystem.revision,
          revision: 1,
        },
      } as any;
    },
    createCatalogue(data: BSIDataCatalogue) {
      const system = this.getSystem(data.catalogue.gameSystemId);
      system.setCatalogue(data);
      this.cataloguesStore.setEdited(getDataDbId(data), true);
      this.selectedItem = data;
      const copy = JSON.parse(JSON.stringify(data));
      if (electron) {
        if (!system.gameSystem) {
          throw new Error("Cannot create catalogue: no game system");
        }
        const systemPath = getDataObject(system.gameSystem).fullFilePath;
        if (!systemPath) {
          throw new Error("Cannot create catalogue: game system has no path set");
        }
        const name = data.name;
        if (!name) {
          throw new Error("Cannot create catalogue: no name provided");
        }
        const folder = dirname(systemPath);
        (getDataObject(copy) as any).fullFilePath = `${folder}/${name}`;
      }
      db.catalogues.put({
        content: copy,
        id: getDataDbId(data),
      });
      this.mode = "edit";
    },
    deleteCatalogue(data: BSIDataCatalogue) {
      console.log("Deleted catalogue", data);
      this.getSystem(data.catalogue.gameSystemId).removeCatalogue(data);
      db.catalogues.delete(getDataDbId(data));
      this.selectedItem = null;
    },
    getSystem(id: string) {
      if (!(id in this.store.gameSystems)) {
        this.store.gameSystems[id] = new GameSystemFiles();
      }
      return this.store.gameSystems[id];
    },
    filesUploaded(files: any[]) {
      console.log("Uploaded", files.length, "files", files);
      const systems = files.filter((o) => o.gameSystem) as BSIDataSystem[];
      for (const system of systems) {
        const systemId = system.gameSystem.id;
        const dbId = getDataDbId(system);
        this.getSystem(systemId).setSystem(system);
        db.systems.put({ content: system, id: dbId });
        this.cataloguesStore.updateCatalogue(system.gameSystem);
        this.cataloguesStore.setEdited(dbId, false);
      }

      const catalogues = files.filter((o) => o.catalogue) as BSIDataCatalogue[];
      for (const catalogue of catalogues) {
        const systemId = catalogue.catalogue.gameSystemId;
        this.getSystem(systemId).setCatalogue(catalogue);
        db.catalogues.put({ content: catalogue, id: getDataDbId(catalogue) });
        this.cataloguesStore.updateCatalogue(catalogue.catalogue);
        this.cataloguesStore.setEdited(getDataDbId(catalogue), false);
      }
    },
    loadSystem(path: string) {
      // Electron only
    },
    async editCatalogue(file: BSIData) {
      this.$router.push({
        name: "catalogue",
        query: { id: getDataDbId(file) },
      });
    },
  },
});
</script>

<style scope>
.scrollable {
  height: 100%;
  overflow-y: auto;
}
</style>
