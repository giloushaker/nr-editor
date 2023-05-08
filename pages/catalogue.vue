<template>
  <div>
    <span v-if="error">
      {{ error }}
    </span>
    <div v-if="catalogue">
      <SplitView
        :split="true"
        :double="true"
        :showRight="item != null"
        :viewStyle="{ 'grid-template-columns': '400px auto' }"
      >
        <template #middle v-if="catalogue">
          <LeftPanel :catalogue="catalogue" @selected="itemSelected" />
        </template>
        <template #right>
          <CatalogueRightPanel :item="item" @catalogueChanged="changed" />
        </template>
      </SplitView>
    </div>
  </div>
  <Teleport to="#titlebar-content" v-if="catalogue">
    <div>Editing {{ catalogue.name }}</div>
  </Teleport>
</template>

<script lang="ts">
import LeftPanel from "~/components/catalogue/left_panel/LeftPanel.vue";
import { BSIData, BSIDataSystem } from "~/assets/shared/battlescribe/bs_types";
import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { db } from "~/assets/ts/dexie";
import { GameSystemFiles } from "./index.vue";
import { getDataObject } from "~/assets/shared/battlescribe/bs_system";

export default {
  components: { LeftPanel },
  data() {
    return {
      error: null as string | null,
      catalogue: null as Catalogue | null,
      item: null as any,
    };
  },

  beforeRouteEnter(to, from, next) {
    next(async (vue: any) => {
      try {
        await vue.load(to.query.id);
        vue.error = null;
      } catch (e: any) {
        vue.error = e;
      }
    });
  },

  async created() {
    try {
      await this.load(this.$route.query?.id as string);
      this.error = null;
    } catch (e: any) {
      this.error = e;
    }
  },

  methods: {
    changed() {
      // TODO: Save the catalogue in indexed DB
      console.log(this.catalogue);
    },

    itemSelected(item: any) {
      this.item = item;
    },

    async load(idCat: string | null | undefined) {
      if (!idCat) {
        throw "No catalogue ID";
      }

      let catData: { content: BSIData; id: string } | undefined =
        await db.catalogues.get(idCat);

      if (!catData) {
        catData = await db.systems.get(idCat);
      }
      // what if the user wants to edit the gst file?
      if (!catData) {
        throw "No catalogue exists with this ID";
      }
      const file = catData.content as BSIData;

      const id = file.catalogue ? file.catalogue.id : file.gameSystem?.id;
      const systemId = file.catalogue
        ? file.catalogue.gameSystemId
        : file.gameSystem?.id;
      if (!id || !systemId) {
        throw Error("Unable to open this catalogue");
      }
      let system: BSIDataSystem;
      if (file.catalogue) {
        const systemID = file.catalogue.gameSystemId;

        if (!systemID && file.catalogue) {
          throw "This catalogue does not belong to any a game system";
        }
        const systemData = await db.systems.get(systemID);
        if (!systemData) {
          throw "The Game System File (gst) for this catalogue is not loaded";
        }

        system = systemData.content;
      } else {
        system = catData.content as BSIDataSystem;
      }
      const systemFiles = new GameSystemFiles();
      systemFiles.gameSystem = system;

      const loaded = await systemFiles.loadCatalogue({
        targetId: getDataObject(file).id,
        name: getDataObject(file).name,
      });

      this.catalogue = loaded;
    },
  },
};
</script>
