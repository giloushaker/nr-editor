<template>
  <template v-if="error">
    <span>
      {{ error }}
    </span>
  </template>
  <template v-else-if="cat">
    <SplitView
      class="h-full"
      draggable
      :split="true"
      :double="true"
      :showRight="store.selectedItem != null"
      id="catalogueView"
    >
      <template #left>
        <LeftPanel class="h-full" :catalogue="cat" />
      </template>
      <template #right>
        <CatalogueRightPanel class="h-full overflow-y-auto" :catalogue="cat" @catalogueChanged="onChanged" />
      </template>
    </SplitView>
  </template>

  <Teleport to="#titlebar-content" v-if="cat">
    <div class="ml-10px">
      Editing {{ cat.name }} v{{ cat.revision }}
      <template v-if="changed">
        <template v-if="unsaved">
          <span class="status mx-2">unsaved</span>
          <button class="bouton save" @click="store.save_catalogue(cat as Catalogue)">Save</button>
        </template>
        <template v-else>
          <span class="status mx-2">saved</span>
        </template>
      </template>
    </div>
  </Teleport>
</template>

<script lang="ts">
import LeftPanel from "~/components/catalogue/left_panel/LeftPanel.vue";
import { BSIData, BSIDataSystem } from "~/assets/shared/battlescribe/bs_types";
import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { db } from "~/assets/ts/dexie";
import { getDataObject, getDataDbId } from "~/assets/shared/battlescribe/bs_system";
import { GameSystemFiles, saveCatalogue } from "~/assets/ts/systems/game_system";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { useEditorStore } from "~/stores/editorState";
import { ItemTypes } from "~/assets/shared/battlescribe/bs_editor";

export default {
  components: { LeftPanel },
  data() {
    return {
      error: null as string | null,
      cat: null as Catalogue | null,
      raw: null as BSIData | null,
      item: null as ItemTypes | null,
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
  setup() {
    return { cataloguesStore: useCataloguesStore(), store: useEditorStore() };
  },
  mounted() {
    window.addEventListener("beforeunload", this.beforeUnload);
    document.addEventListener("keydown", this.onKeydown, true);
  },
  unmounted() {
    window.removeEventListener("beforeunload", this.beforeUnload);
    document.removeEventListener("keydown", this.onKeydown);
  },
  async created() {
    try {
      await this.load(this.$route.query?.id as string);
      this.error = null;
    } catch (e: any) {
      this.error = e;
    }
  },
  computed: {
    changed() {
      if (!this.cat) return false;
      return this.store.get_catalogue_state(this.cat as Catalogue)?.changed || false;
    },
    unsaved() {
      if (!this.cat) return false;
      return this.store.get_catalogue_state(this.cat as Catalogue)?.unsaved || false;
    },
  },
  beforeRouteLeave(to, from, next) {
    const answer = window.confirm("You have unsaved changes that will be lost");
    if (answer) {
      next();
    } else {
      next(false);
    }
  },
  methods: {
    beforeUnload(event: BeforeUnloadEvent) {
      if (this.unsaved) {
        const message = "You have unsaved changes that will be lost";
        event.returnValue = message;
        return false;
      }
    },
    onKeydown(e: KeyboardEvent) {
      if (!(e.key === "s" && (e.ctrlKey || e.metaKey))) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      this.store.save_catalogue(this.cat as Catalogue);
    },
    onChanged() {
      this.store.set_catalogue_state(this.cat as Catalogue, true);
    },

    async load(idCat: string | null | undefined) {
      if (!idCat) {
        throw "No catalogue ID";
      }

      let dbobj: { content: BSIData; id: string } | undefined = await db.catalogues.get(idCat);

      if (!dbobj) {
        dbobj = await db.systems.get(idCat);
      }
      if (!dbobj) {
        throw "No catalogue exists with this ID";
      }

      const file = dbobj.content as BSIData;
      const id = file.catalogue ? file.catalogue.id : file.gameSystem?.id;
      const systemId = file.catalogue ? file.catalogue.gameSystemId : file.gameSystem?.id;

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
      loaded.processForEditor();
      loaded.imports.map((o) => o.processForEditor());
      this.raw = file;
      this.cat = loaded;
      (globalThis as any).$catalogue = this.cat;
    },
  },
};
</script>

<style scoped>
.save {
  width: 100px;
}

.status {
  color: lightgray;
}
</style>
