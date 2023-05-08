<template>
  <div>
    <span v-if="error">
      {{ error }}
    </span>
    <div v-if="data">
      <SplitView
        :split="true"
        :double="true"
        :showRight="item != null"
        :viewStyle="{ 'grid-template-columns': '400px auto' }"
      >
        <template #middle v-if="data">
          <LeftPanel :catalogue="data" @selected="itemSelected" />
        </template>
        <template #right>
          <CatalogueRightPanel
            :item="item"
            :catalogue="catalogue"
            @catalogueChanged="changed"
          />
        </template>
      </SplitView>
    </div>
  </div>
  <Teleport to="#titlebar-content" v-if="data">
    <div>Editing {{ data.name }}</div>
  </Teleport>
</template>

<script lang="ts">
import LeftPanel from "~/components/catalogue/left_panel/LeftPanel.vue";
import { BSIData, BSIDataSystem } from "~/assets/shared/battlescribe/bs_types";
import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { db } from "~/assets/ts/dexie";
import { GameSystemFiles } from "./index.vue";
import { getDataObject } from "~/assets/shared/battlescribe/bs_system";
import { GameSystem } from "~/assets/ts/systems/game_system";
import { rootCertificates } from "tls";
export default {
  components: { LeftPanel },
  data() {
    return {
      error: null as string | null,
      data: null as Catalogue | null,
      raw: null as BSIData | null,
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
      if (!this.data) return;
      const badKeys = new Set([
        "loaded",
        "loaded2",
        "units",
        "categories",
        "forces",
        "childs",
        "roster_constraints",
        "extra_constraints",
        "costIndex",
        "imports",
        "index",
        "catalogue",
        "gameSystem",
        "main_catalogue",
        "collective_recursive",
        "limited_to_one",
        "associations",
        "associationConstraints",
        "book",
        "short",
        "version",
        "nrversion",
        "lastUpdated",
        "costIndex",
        "target",
      ]);
      const root: any = {
        ...this.raw,
        catalogue: undefined,
        gameSystem: undefined,
      };
      const copy = { ...this.data }; // this is to make sure there is no recursive imports by only having the copy in the json
      if (this.data.isGameSystem()) {
        root.gameSystem = copy;
      } else if (this.data.isCatalogue()) {
        root.catalogue = copy;
      }
      const stringed = JSON.stringify(root, (k, v) => {
        if (v === copy || !badKeys.has(k)) return v;
        return undefined;
      });
      if (root.catalogue) {
        db.catalogues.put({
          content: JSON.parse(stringed),
          id: `${root.catalogue.gameSystemId}-${root.catalogue.id}`,
        });
        console.log("saved");
      }
      if (root.gameSystem) {
        db.systems.put({
          content: JSON.parse(stringed),
          id: root.gameSystem.id,
        });
        console.log("saved");
      }
    },

    itemSelected(item: any) {
      this.item = item;
    },

    async load(idCat: string | null | undefined) {
      if (!idCat) {
        throw "No catalogue ID";
      }

      let dbobj: { content: BSIData; id: string } | undefined =
        await db.catalogues.get(idCat);

      if (!dbobj) {
        dbobj = await db.systems.get(idCat);
      }
      if (!dbobj) {
        throw "No catalogue exists with this ID";
      }

      const file = dbobj.content as BSIData;
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
        system = dbobj.content as BSIDataSystem;
      }
      const systemFiles = new GameSystemFiles();
      systemFiles.gameSystem = system;

      const loaded = await systemFiles.loadCatalogue({
        targetId: getDataObject(file).id,
        name: getDataObject(file).name,
      });
      this.raw = file;
      this.data = loaded;
    },
  },
};
</script>
