<template>
  <div class="p-10px" v-if="!electron">
    <div class="box">
      <h3>My Catalogues</h3>
      <div class="boutons">
        <SelectFile v-if="electron" @uploaded="filesUploaded" />
        <UploadJson @uploaded="filesUploaded" />
        <ImportFromGithub @uploaded="filesUploaded" />
        <CreateSystem />
      </div>
      <div v-if="electron">
        Note: if you modify an already imported file in another program, you will need to import it again
      </div>
    </div>
  </div>
  <p class="info">
    To return to this page, simply click on the 'New Recruit' icon located in the top-left corner of the screen.
    <br />
    Returning to this page will not cause you to lose your changes.
  </p>
  <div class="mx-10px box h-full pb-200px">
    <SplitView showMiddle showRight :rightWidth="400" id="systemView">
      <template #middle>
        <div class="scrollable">
          <fieldset v-for="gst in systems">
            <legend>
              {{ gst.gameSystem?.gameSystem.name || "Unknown GameSystem" }}
              <NuxtLink :to="`/search/${gst.getId()}`" class="align-bottom imgBt inline-block">
                <img class="w-24px h-24px" src="assets/icons/search.png" title="Search" />
              </NuxtLink>
              <a
                v-if="gst.github?.githubUrl"
                :href="gst.github.githubUrl"
                target="_blank"
                class="ml-5px align-bottom imgBt inline-block"
              >
                <img class="w-24px h-24px" src="assets/icons/github-light.png" :title="githubHoverTitle(gst.github)" />
              </a>
              <NuxtLink :to="`/scripts/${gst.getId()}`" class="align-bottom imgBt inline-block">
                <img class="w-24px h-24px" src="assets/icons/right2.png" title="Scripts" />
              </NuxtLink>
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
    <Teleport to="#titlebar-content" v-if="has_unsaved_changes && $route.name == 'index'">
      <template v-if="has_unsaved_changes">
        <button class="bouton save ml-10px !w-100px" @click="saveAll">Save All</button>
      </template>
      <template v-else-if="failed">
        <span class="status mx-2 text-red">failed to save</span>
      </template>
      <template v-else>
        <span class="status mx-2">saved</span>
      </template>
    </Teleport>
  </div>
</template>

<script lang="ts">
import { BSIData, BSIDataCatalogue, BSIDataSystem } from "~/assets/shared/battlescribe/bs_types";
import { getDataObject, getDataDbId } from "~/assets/shared/battlescribe/bs_main";
import UploadJson from "~/components/UploadJson.vue";
import CataloguesDetail from "~/components/my_catalogues/CataloguesDetail.vue";

import CataloguesCreate from "~/components/my_catalogues/CataloguesCreate.vue";
import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { useEditorStore } from "~/stores/editorStore";
import ImportFromGithub from "~/components/ImportFromGithub.vue";
import SelectFile from "~/components/SelectFile.vue";
import { closeWindow, dirname, showMessageBox } from "~/electron/node_helpers";
import IconContainer from "~/components/IconContainer.vue";
import SplitView from "~/components/SplitView.vue";
import { getExtension } from "~/assets/shared/battlescribe/bs_convert";
import { useSettingsStore } from "~/stores/settingsState";
import { db } from "~/assets/shared/battlescribe/cataloguesdexie";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { GithubIntegration } from "~/assets/shared/battlescribe/github";

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
      failed: false,
    };
  },
  setup() {
    return { cataloguesStore: useCataloguesStore(), store: useEditorStore(), settings: useSettingsStore() };
  },
  created() {
    this.store.init(this.$router);
    if (!electron) {
      this.store.load_systems_from_db();
    }
  },
  activated() {
    window.addEventListener("beforeunload", this.beforeUnload);
  },
  deactivated() {
    window.removeEventListener("beforeunload", this.beforeUnload);
  },
  computed: {
    has_unsaved_changes() {
      const changes = this.store.unsavedChanges;
      for (const key in changes) {
        const val = changes[key];
        if (val.unsaved) return true;
      }
      return false;
    },
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
        }
        return result;
      }

      return this.store.gameSystems;
    },
  },
  methods: {
    githubHoverTitle(github: GithubIntegration) {
      if (github.discovered) {
        return `using discovered .git repo at ${github.githubUrl}
use a publication name="Github", url="https://github.com/{owner}/{repo}" in the gameSystem to overwrite.`;
      }

      return `using repo at ${github.githubUrl}`;
    },
    async saveAll() {
      let failed = false;
      try {
        for (const sys of Object.values(this.systems)) {
          const increment = await this.store.prompt_revision(sys);
          for (const cat of sys.getAllLoadedCatalogues()) {
            if (this.store.get_catalogue_state(cat)?.unsaved) {
              this.store.save_catalogue(sys, cat, increment);
            }
          }
        }
      } catch (e) {
        failed = true;
      }
      this.failed = failed;
    },
    async beforeUnload(event: BeforeUnloadEvent) {
      if (globalThis._closeWindow) return;
      if (this.store.unsavedCount) {
        const message = "You have unsaved changes that will be lost";
        event.returnValue = message;
        if (electron) {
          setTimeout(async () => {
            const result = await showMessageBox({
              message: "You have unsaved changes that will be lost?",
              buttons: ["Cancel", "Leave"],
              defaultId: 0,
              cancelId: 0,
              type: "question",
            });
            if (result === 1) {
              globalThis._closeWindow = true;
              closeWindow();
            }
          });
        }
      }
      return false;
    },
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
    getCatExtension(gstPath: string): string {
      switch (getExtension(gstPath)) {
        case "json":
          return "json";
        case "gstz":
          return "catz";
        default:
        case "gst":
          return "cat";
      }
    },
    createCatalogue(data: BSIDataCatalogue) {
      const system = this.store.get_system(data.catalogue.gameSystemId);
      const copy = JSON.parse(JSON.stringify(data)) as BSIDataCatalogue;
      copy.catalogue.battleScribeVersion = "2.03";
      if (electron) {
        if (!system.gameSystem) {
          throw new Error("Cannot create catalogue: no game system");
        }
        const systemPath = getDataObject(system.gameSystem).fullFilePath;
        if (!systemPath) {
          throw new Error("Cannot create catalogue: game system has no path set");
        }
        const name = copy.catalogue.name;
        if (!name) {
          throw new Error("Cannot create catalogue: no name provided");
        }
        const folder = dirname(systemPath);

        getDataObject(copy).fullFilePath = `${folder}/${name}.${this.getCatExtension(systemPath)}`;
      }
      system.setCatalogue(copy);
      this.cataloguesStore.setEdited(getDataDbId(copy), true);
      this.store.set_catalogue_changed(copy, true);
      this.store.get_catalogue_state(copy).incremented = true;
      this.selectedItem = copy;
      if (!electron) {
        db.catalogues.put({
          content: copy,
          id: getDataDbId(data),
        });
      }
      this.mode = "edit";
    },
    deleteCatalogue(data: BSIDataCatalogue | BSIDataSystem) {
      console.log("Deleted catalogue", data);
      const obj = getDataObject(data);
      const systemId = obj.gameSystemId || obj.id;
      if ((data as BSIDataCatalogue).catalogue) {
        this.store.get_system(systemId).removeCatalogue(data as BSIDataCatalogue);
        if (!electron) {
          db.catalogues.delete(getDataDbId(data));
        }
      } else if ((data as BSIDataSystem).gameSystem) {
        const sys = this.store.get_system(systemId);
        for (const catalogue of Object.values(sys.catalogueFiles)) {
          const id = getDataDbId(catalogue);
          db.catalogues.delete(id);
        }
        db.catalogues.delete(getDataDbId(sys.gameSystem!));
        db.systems.delete(getDataDbId(sys.gameSystem!));
        this.store.delete_system(systemId);
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

.icon {
  padding: 1px;
}
</style>
