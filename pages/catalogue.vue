<template>
  <div>
    <span v-if="error">
      {{ error }}
    </span>
    <div v-if="catalogue">{{ catalogue.name }} loaded!</div>
  </div>
</template>

<script lang="ts">
import { BSIData } from "~/assets/shared/battlescribe/bs_types";
import { db } from "~/assets/ts/dexie";
import { GameSystemFiles } from "./index.vue";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  data() {
    return {
      error: null as string | null,
      catalogue: null as Catalogue | null,
    };
  },

  beforeRouteEnter(to, from, next) {
    next(async (vue: any) => {
      try {
        await vue.load(to.query.id);
        vue.error = null;
      } catch (e: any) {
        vue.error = e.message;
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
    async load(idCat: string | null | undefined) {
      if (!idCat) {
        throw "No catalogue ID";
      }

      let catData = await db.catalogues
        .where({
          "content.id": parseInt(idCat),
        })
        .first();

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

      const systemID = catData.content.gameSystemId;
      if (!systemID) {
        throw "This catalogue does not belong to any a game system";
      }
      const systemData = await db.systems.get(systemID);
      if (!systemData) {
        throw "The Game System File (gst) for this catalogue is not loaded";
      }

      debugger;
      const system = systemData.content;
      const systemFiles = new GameSystemFiles();
      systemFiles.gameSystem = system;

      const loaded = await systemFiles.loadCatalogue({
        targetId: id,
      });

      this.catalogue = loaded;
    },
  },
};
</script>
