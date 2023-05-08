<template>
  <div class="box">
    <h3>My Catalogues</h3>
    <div class="boutons">
      <UploadJson @uploaded="filesUploaded" />
      <ImportFromGithub @uploaded="filesUploaded" />
    </div>
    <div class="section" v-for="gst in gameSystems">
      <h3>{{ gst.gameSystem?.gameSystem.name || "Unknown GameSystem" }}</h3>
      <SplitView
        :split="true"
        :double="true"
        :showRight="selectedItem != null"
        :viewStyle="{ 'grid-template-columns': 'auto 30%' }"
      >
        <template #middle>
          <IconContainer
            :items="systemAndCatalogues(gst)"
            @itemClicked="itemClicked"
          />
        </template>
        <template #right v-if="selectedItem">
          <div>
            <CataloguesDetail @edit="editCatalogue" :catalogue="selectedItem" />
          </div>
        </template>
      </SplitView>
    </div>
    <div v-if="msg">
      {{ msg }}
    </div>
  </div>
</template>

<script lang="ts">
import EditorCollapsibleBox from "~/components/EditorCollapsibleBox.vue";

import {
  BSICatalogueLink,
  BSIData,
  BSIDataCatalogue,
  BSIDataSystem,
} from "~/assets/shared/battlescribe/bs_types";
import {
  BSCatalogueManager,
  getDataDbId,
  getDataObject,
} from "~/assets/shared/battlescribe/bs_system";
import { BooksDate } from "~/assets/shared/battlescribe/bs_versioning";
import UploadJson from "~/components/UploadJson.vue";
import CataloguesDetail from "~/components/my_catalogues/CataloguesDetail.vue";
import { db } from "~/assets/ts/dexie";
import { NamedItem } from "~/components/IconContainer.vue";
import ImportFromGithub from "./ImportFromGithub.vue";
import { GameSystemFiles } from "~/assets/ts/systems/game_system";

export default defineComponent({
  components: {
    EditorCollapsibleBox,
    UploadJson,
    CataloguesDetail,
    ImportFromGithub,
  },
  data() {
    return {
      msg: "",
      selectedItem: null as BSIDataCatalogue | BSIDataSystem | null,
      editingItem: null as BSIData | null,
      gameSystems: {} as Record<string, GameSystemFiles>,
    };
  },

  created() {
    this.loadSystemsFromDB();
  },

  methods: {
    systemAndCatalogues(gst: GameSystemFiles): NamedItem[] {
      let res: NamedItem[] = [];
      if (!gst.gameSystem) {
        return [];
      }
      res.push(gst.gameSystem);
      res.push(...Object.values(gst.catalogueFiles));
      return res;
    },

    itemClicked(item: BSIDataCatalogue) {
      this.selectedItem = item;
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
      }

      const catalogues = files.filter((o) => o.catalogue) as BSIDataCatalogue[];
      for (const catalogue of catalogues) {
        const systemId = catalogue.catalogue.gameSystemId;
        this.getSystem(systemId).setCatalogue(catalogue);
        db.catalogues.put({ content: catalogue, id: getDataDbId(catalogue) });
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
