<template>
  <div class="box">
    <h3>My Catalogues</h3>
    <div class="boutons">
      <button class="bouton">Import Catalogue</button>
      <UploadJson @uploaded="filesUploaded" />
    </div>
    <div class="section" v-for="gst in gameSystems">
      <h3>{{ gst.gameSystem?.gameSystem.name || "Unknown GameSystem" }}</h3>
      <SplitView :split="true" :double="true" :showRight="selectedItem != null">
        <template #middle>
          <IconContainer
            :items="gst.catalogueFiles"
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
  </div>
</template>

<script lang="ts">
import CollapsibleBox from "~/shared_components/CollapsibleBox.vue";
import { NamedItem } from "@/components/IconContainer.vue";
import { groupBy } from "~/assets/shared/battlescribe/bs_helpers";
import {
  BSICatalogueLink,
  BSIData,
  BSIDataCatalogue,
  BSIDataSystem,
} from "~/assets/shared/battlescribe/bs_types";
import { string_of_bool } from "~/assets/shared/blossomJs/pervasives";
import { BSCatalogueManager } from "~/assets/shared/battlescribe/bs_system";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BooksDate } from "~/assets/shared/battlescribe/bs_versioning";
import UploadJson from "~/components/UploadJson.vue";
import CataloguesDetail from "~/components/my_catalogues/CataloguesDetail.vue";

export class GameSystemFiles extends BSCatalogueManager {
  gameSystem: BSIDataSystem | null = null;
  catalogueFiles: Record<string, BSIDataCatalogue> = {};
  async getData(
    catalogueLink: BSICatalogueLink,
    booksDate?: BooksDate
  ): Promise<BSIData> {
    if (catalogueLink.targetId == this.gameSystem?.gameSystem.id) {
      return this.gameSystem;
    }
    if (catalogueLink.targetId in this.catalogueFiles) {
      return this.catalogueFiles[catalogueLink.targetId];
    }

    throw Error(
      `Couldn't import catalogue with id ${catalogueLink.targetId}, perhaps it wasnt uploaded?`
    );
  }
}
export default defineComponent({
  components: { CollapsibleBox, UploadJson, CataloguesDetail },
  data() {
    return {
      items: [
        {
          name: "Orcs and Goblins",
        },
        {
          name: "Warriors of Chaos",
        },
        {
          name: "Highborn Elves",
        },
        {
          name: "Vampire Counts",
        },
      ],

      selectedItem: null as NamedItem | null,
      gameSystems: {} as Record<string, GameSystemFiles>,
    };
  },

  methods: {
    itemClicked(item: NamedItem) {
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
        this.getSystem(system.gameSystem.id).gameSystem = system;
      }
      const catalogues = files.filter((o) => o.catalogue) as BSIDataCatalogue[];
      for (const catalogue of catalogues) {
        const systemId = catalogue.catalogue.gameSystemId;
        const catalogueId = catalogue.catalogue.id;
        this.getSystem(systemId).catalogueFiles[catalogueId] = catalogue;
      }
    },
    async editCatalogue(file: BSIData) {
      const id = file.catalogue ? file.catalogue.id : file.gameSystem?.id;
      const systemId = file.catalogue
        ? file.catalogue.gameSystemId
        : file.gameSystem?.id;
      if (!id || !systemId) {
        throw Error("Cant edit this");
      }
      const loaded = await this.gameSystems[systemId].loadCatalogue({
        targetId: id,
      });
      console.log("loaded catalogue", loaded.getName());
    },
  },
});
</script>
