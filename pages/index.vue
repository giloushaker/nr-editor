<template>
  <div class="p-10px" v-if="!electron">
    <div class="box">
      <h3>My Catalogues</h3>
      <div class="boutons">
        <SelectFile v-if="electron" @uploaded="filesUploaded" />
        <UploadJson @uploaded="filesUploaded" />
        <ImportFromGithub @uploaded="filesUploaded" />
      </div>
      <div v-if="electron">
        Note: if you modify an already imported file in another program, you will need to import it again
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
          <fieldset v-for="gst in systems">
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
import { useEditorStore } from "~/stores/editorStore";
import ImportFromGithub from "~/components/ImportFromGithub.vue";
import SelectFile from "~/components/SelectFile.vue";
import { dirname } from "~/electron/node_helpers";
import IconContainer from "~/components/IconContainer.vue";
import SplitView from "~/components/SplitView.vue";

export default defineComponent({
  components: {
    UploadJson,
    CataloguesDetail,
    ImportFromGithub,
    CataloguesCreate,
    SelectFile,
    IconContainer,
    SplitView,
  },
  head() {
    return {
      title: "New Recruit - Editor",
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
    this.store.init(this.$router);
    if (!electron) {
      this.store.load_systems_from_db();
    }
  },
  computed: {
    electron() {
      return Boolean(globalThis.electron);
    },
    filter() {
      const id = this.$route.query?.id;
      if (!id) return undefined;
      return (id as string).split(",");
    },
    systems(): Record<string, GameSystemFiles> {
      if (this.filter) {
        const result = {} as Record<string, GameSystemFiles>;
        for (const id of this.filter) {
          const found = this.store.gameSystems[id];
          if (found) {
            result[id] = found;
          }

          return result;
        }
      }

      return this.store.gameSystems;
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
      const id = getDataObject(item).id;
      const systemId = getDataObject(item).gameSystemId || id;
      this.$router.push({
        name: "catalogue",
        query: { systemId, id },
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
      const system = this.store.get_system(data.catalogue.gameSystemId);
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
      if (!electron) {
        db.catalogues.put({
          content: copy,
          id: getDataDbId(data),
        });
      }
      this.mode = "edit";
    },
    deleteCatalogue(data: BSIDataCatalogue) {
      console.log("Deleted catalogue", data);
      this.store.get_system(data.catalogue.gameSystemId).removeCatalogue(data);
      if (!electron) {
        db.catalogues.delete(getDataDbId(data));
      }

      this.selectedItem = null;
    },

    filesUploaded(files: any[]) {
      console.log("Uploaded", files.length, "files", files);
      const systems = files.filter((o) => o.gameSystem) as BSIDataSystem[];
      for (const system of systems) {
        const systemId = system.gameSystem.id;
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
      delete this.$route.query.id;
    },
    async editCatalogue(file: BSIData) {
      const id = getDataObject(file).id;
      const systemId = getDataObject(file).gameSystemId || id;
      this.$router.push({
        name: "catalogue",
        query: { systemId, id },
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
