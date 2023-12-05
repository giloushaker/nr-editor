<template>
  <fieldset class="details">
    <div>
      <legend>{{ cataloguedata.name }}</legend>
      <div v-if="is_catalogue">
        <span class="grey hastooltip"
          title="indicates that this catalogue is used to store data, no forces may be created from it if true.">
          Library:
        </span>
        {{ (cataloguedata as BSICatalogue).library }}
      </div>
      <div><span class="grey">Id:</span> {{ cataloguedata.id }}</div>
      <div><span class="grey">path:</span> <span style="word-break: break-all;">{{ cataloguedata.fullFilePath }}</span>
      </div>
      <div v-if="electron"> <span class="grey">authorUrl:</span> {{ cataloguedata.authorUrl }} </div>
      <div>
        <span class="grey">authorContact:</span>
        {{ cataloguedata.authorContact }}
      </div>
      <div> <span class="grey">authorName:</span> {{ cataloguedata.authorName }} </div>
      <div v-if="(cataloguedata as BSICatalogue).catalogueLinks?.length">
        <span class="bold">imports:</span>
        <div class="ml-10px">
          <div v-for="link in (cataloguedata as BSICatalogue).catalogueLinks">
            <span :class="{ grey: !link.importRootEntries }">
              {{ link.name }}
            </span>
          </div>
        </div>
      </div>
      <div v-if="refs.length && !isSystem">
        <span class="bold">imported by:</span>
        <div class="ml-10px">
          <div v-for="ref in refs">
            <span :class="{ grey: !ref.importRootEntries }">
              {{ ref.sourceName }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="section boutons">
      <button class="bouton" @click="$emit('edit', catalogue)">Edit</button>
      <button class="bouton" @click="deletePopup = true">Delete</button>
      <button class="bouton" @click="download_file">Download</button>
      <button class="bouton" v-if="isSystem" @click="popup_change_format">Change File Format</button>
      <p class="info"> To quickly edit a catalogue, you can double-click on it. </p>
    </div>
    <PopupDialog button="Confirm" text="Cancel" @button="$emit('delete', catalogue)" v-model="deletePopup"
      v-if="deletePopup">
      <div>Are you sure you want to delete this {{ is_catalogue ? "catalogue" : "Game System" }}?</div>
    </PopupDialog>
    <PopupDialog button="Confirm" text="Cancel" @button="change_format(format, deleteExistingFiles)"
      v-model="changeFormatPopup" v-if="changeFormatPopup">
      <div>

        <label for="newFormat">New Format:</label>
        <select id="newFormat" v-model="format">
          <option value="gstz">.gstz/.catz (Zipped XML)</option>
          <option value="gst">.gst/.cat (XML)</option>
          <option value="json" v-if="!has_duplicate_filename">.json (JSON)</option>
        </select>
      </div>
      <div v-if="has_duplicate_filename">
        <span class="gray">Note: Cannot convert to json because a catalogue has the same filename as the gst</span>
      </div>
      <div>
        <label for="deleteExisting">Delete existing files:</label>
        <input type="checkbox" id="deleteExisting" v-model="deleteExistingFiles" />
      </div>
    </PopupDialog>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "vue";
import { convertToXml, removeExtension } from "~/assets/shared/battlescribe/bs_convert";
import { addOne } from "~/assets/shared/battlescribe/bs_helpers";
import { getDataObject, getDataDbId } from "~/assets/shared/battlescribe/bs_main";
import { BSIDataCatalogue, BSIDataSystem, BSICatalogue, BSIGameSystem } from "~/assets/shared/battlescribe/bs_types";
import { download } from "~/assets/shared/util";
import { deleteFile, filename } from "~/electron/node_helpers";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { useEditorStore } from "~/stores/editorStore";
export default {
  emits: ["edit", "delete"],
  props: {
    catalogue: {
      type: Object as PropType<BSIDataCatalogue | BSIDataSystem>,
      required: true,
    },
  },
  setup() {
    return { catalogueStore: useCataloguesStore(), store: useEditorStore() };
  },
  data() {
    return {
      deletePopup: false,
      changeFormatPopup: false,
      format: "gst" as "gstz" | "gst" | "json",
      deleteExistingFiles: false,
    };
  },
  methods: {
    download_file() {
      const data = getDataObject(this.catalogue);
      const loaded = this.store.get_system(data.gameSystemId || data.id).getLoadedCatalogue({ targetId: data.id });
      const xml = convertToXml(loaded || data);
      const fileName = data.fullFilePath ? removeExtension(filename(data.fullFilePath)) : data.name;
      const extension = data.gameSystemId ? `cat` : `gst`;
      download(`${fileName}.${extension}`, "application/xml", xml);
    },
    popup_change_format() {
      this.changeFormatPopup = true;
    },

    async change_format(format: "gstz" | "gst" | "json", deleteExistingFiles: boolean) {
      const data = getDataObject(this.catalogue);
      const sys = this.store.get_system(data.gameSystemId || data.id)
      const files = sys.getAllCatalogueFiles()
      for (const file of files) {
        const file_data = getDataObject(file)
        const path = file_data.fullFilePath
        if (path) {
          if (deleteExistingFiles) {
            await deleteFile(path);
          }
          const isSystem = Boolean((file as BSIDataSystem).gameSystem)
          let extension: string;
          const fileName = removeExtension(path)
          switch (format) {
            case "gstz":
              extension = isSystem ? "gstz" : "catz"
              break;
            case "gst":
              extension = isSystem ? "gst" : "cat"
              break;
            case "json":
              extension = "json"
              break;
          }
          file_data.fullFilePath = `${fileName}.${extension}`;
          console.log(file_data.fullFilePath)
          this.store.saveCatalogue(file)
        }
      }
    },
  },
  computed: {
    has_duplicate_filename() {
      const data = getDataObject(this.catalogue);
      const sys = this.store.get_system(data.gameSystemId || data.id)
      const files = sys.getAllCatalogueFiles()
      const names = {} as Record<string, number>

      for (const file of files) {
        const file_data = getDataObject(file)
        const path = file_data.fullFilePath
        if (path) {
          addOne(names, removeExtension(path))
        }
      }

      return Object.values(names).find(o => o > 1)
    },
    is_catalogue() {
      return Boolean((this.catalogue as BSIDataCatalogue).catalogue);
    },
    electron() {
      return Boolean(globalThis.electron);
    },
    imports() {
      return (this.cataloguedata as BSICatalogue).catalogueLinks || [];
    },
    refs() {
      return this.catalogueStore.getDependents(getDataDbId(this.catalogue)) || [];
    },
    cataloguedata(): BSICatalogue | BSIGameSystem {
      return getDataObject(this.catalogue);
    },
    isSystem() {
      return !this.cataloguedata.gameSystemId;
    },
  },
};
</script>

<style scoped lang="scss">
.details {
  h4 {
    margin: 0;
    font-size: 16px;
    font-weight: bold;
  }

  overflow-y: auto;
}
</style>
