<template>
  <div class="p-10px">
    <div class="box">
      <h3>My Catalogues</h3>
      <div class="boutons">
        <UploadJson @uploaded="filesUploaded" />
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
          <fieldset v-for="gst in gameSystems">
            <legend>
              {{ gst.gameSystem?.gameSystem.name || "Unknown GameSystem" }}
            </legend>
            <IconContainer
              :items="systemAndCatalogues(gst)"
              @itemClicked="itemClicked"
              @new="newCatalogue(gst)"
              v-model="selectedItem"
            />
          </fieldset>
        </div>
      </template>
      <template #right>
        <div v-if="selectedItem">
          <template v-if="mode === 'create'">
            <CataloguesCreate
              class="fixed"
              @create="createCatalogue"
              :catalogue="selectedItem"
            />
          </template>
          <template v-else>
            <CataloguesDetail
              @delete="deleteCatalogue"
              @edit="editCatalogue"
              :catalogue="selectedItem"
            />
          </template>
        </div>
      </template>
    </SplitView>
  </div>
</template>

<script lang="ts">
import {
  BSIData,
  BSIDataCatalogue,
  BSIDataSystem,
} from "~/assets/shared/battlescribe/bs_types";
import { getDataDbId } from "~/assets/shared/battlescribe/bs_system";
import UploadJson from "~/components/UploadJson.vue";
import CataloguesDetail from "~/components/my_catalogues/CataloguesDetail.vue";
import { db } from "~/assets/ts/dexie";
import ImportFromGithub from "./ImportFromGithub.vue";
import { GameSystemFiles } from "~/assets/ts/systems/game_system";
import CataloguesCreate from "~/components/my_catalogues/CataloguesCreate.vue";
import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { getDataObject } from "~/assets/shared/battlescribe/bs_system";

export default defineComponent({
  components: {
    UploadJson,
    CataloguesDetail,
    ImportFromGithub,
    CataloguesCreate,
  },
  data() {
    return {
      msg: "",
      selectedItem: null as BSIDataCatalogue | BSIDataSystem | null,
      mode: "edit",
      editingItem: null as BSIData | null,
      gameSystems: {} as Record<string, GameSystemFiles>,
    };
  },
  setup() {
    return { cataloguesStore: useCataloguesStore() };
  },
  created() {
    this.loadSystemsFromDB();
  },
  updated() {},
  methods: {
    systemAndCatalogues(gst: GameSystemFiles) {
      let res = [];
      if (!gst.gameSystem) {
        return [];
      }
      res.push(gst.gameSystem);
      res.push(...Object.values(gst.catalogueFiles));
      return res;
    },

    itemClicked(item: BSIDataCatalogue) {
      this.selectedItem = item;
      this.mode = "edit";
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
      this.getSystem(data.catalogue.gameSystemId).setCatalogue(data);
      this.cataloguesStore.setEdited(getDataDbId(data), true);
      this.selectedItem = data;
      db.catalogues.put({
        content: JSON.parse(JSON.stringify(data)),
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
      if (!(id in this.gameSystems)) {
        this.gameSystems[id] = new GameSystemFiles();
      }
      return this.gameSystems[id];
    },
    filesUploaded(files: any[]) {
      console.log("Uploaded", files.length, "files", files);
      const systems = files.filter((o) => o.gameSystem) as BSIDataSystem[];
      for (const system of systems) {
        const systemId = system.gameSystem.id;
        this.getSystem(systemId).setSystem(system);
        db.systems.put({ content: system, id: getDataDbId(system) });
        this.cataloguesStore.setEdited(getDataDbId(system), false);
      }

      const catalogues = files.filter((o) => o.catalogue) as BSIDataCatalogue[];
      for (const catalogue of catalogues) {
        const systemId = catalogue.catalogue.gameSystemId;
        this.getSystem(systemId).setCatalogue(catalogue);
        db.catalogues.put({ content: catalogue, id: getDataDbId(catalogue) });
        this.cataloguesStore.setEdited(getDataDbId(catalogue), false);
      }
    },

    async loadSystemsFromDB() {
      let systems = (await db.systems.toArray()).map((o) => o.content);
      let catalogues = (await db.catalogues.toArray()).map((o) => o.content);

      for (let system of systems) {
        this.getSystem(system.gameSystem.id).setSystem(system);
      }
      for (let catalogue of catalogues) {
        const systemId = catalogue.catalogue.gameSystemId;
        const catalogueId = catalogue.catalogue.id;
        this.getSystem(systemId).catalogueFiles[catalogueId] = catalogue;
      }
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
