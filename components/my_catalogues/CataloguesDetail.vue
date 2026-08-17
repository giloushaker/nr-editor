<template>
  <fieldset class="details">
    <div class="dhead">
      <span class="dname">{{ cataloguedata.name }}</span>
      <span
        v-if="is_catalogue && (cataloguedata as BSICatalogue).library"
        class="libbadge"
        title="This catalogue is used to store data; no forces may be created from it."
        >library</span
      >
    </div>

    <div class="meta">
      <div class="mrow">
        <span class="mlabel">Id</span>
        <span class="mval mono">{{ cataloguedata.id }}</span>
      </div>
      <div class="mrow" v-if="cataloguedata.fullFilePath">
        <span class="mlabel">Path</span>
        <span class="mval mono">{{ cataloguedata.fullFilePath }}</span>
      </div>
      <div class="mrow" v-if="cataloguedata.authorName">
        <span class="mlabel">Author</span>
        <span class="mval">{{ cataloguedata.authorName }}</span>
      </div>
      <div class="mrow" v-if="cataloguedata.authorContact">
        <span class="mlabel">Contact</span>
        <span class="mval">{{ cataloguedata.authorContact }}</span>
      </div>
      <div class="mrow" v-if="electron && cataloguedata.authorUrl">
        <span class="mlabel">Url</span>
        <span class="mval">{{ cataloguedata.authorUrl }}</span>
      </div>
    </div>

    <div class="lsection" v-if="(cataloguedata as BSICatalogue).catalogueLinks?.length">
      <div class="lhead">Imports</div>
      <div v-for="link in (cataloguedata as BSICatalogue).catalogueLinks" class="lentry">
        <span :class="{ grey: !link.importRootEntries }" :title="link.importRootEntries ? undefined : 'root entries not imported'">
          {{ link.name }}
        </span>
      </div>
    </div>
    <div class="lsection" v-if="refs.length && !isSystem">
      <div class="lhead">Imported by</div>
      <div v-for="ref in refs" class="lentry">
        <span :class="{ grey: !ref.importRootEntries }">
          {{ ref.sourceName }}
        </span>
      </div>
    </div>

    <div class="actions boutons">
      <button class="bouton" @click="$emit('edit', catalogue)">Edit</button>
      <button class="bouton" @click="deletePopup = true">Delete</button>
      <button class="bouton" @click="download_file" v-if="!electron">Download</button>
      <button class="bouton" v-if="isSystem && electron" @click="popup_change_format">Change File Format</button>
      <button class="bouton" v-if="isSystem && electron" @click="popup_change_ids">Change Ids</button>
    </div>
    <p class="hint">Tip: double-click a catalogue to edit it.</p>
    <PopupDialog
      button="Confirm"
      text="Cancel"
      @button="$emit('delete', catalogue)"
      v-model="deletePopup"
      v-if="deletePopup"
    >
      <div>Are you sure you want to delete this {{ is_catalogue ? "catalogue" : "Game System" }}?</div>
    </PopupDialog>
    <PopupDialog
      button="Confirm"
      text="Cancel"
      @button="change_format(format, deleteExistingFiles)"
      v-model="changeFormatPopup"
      v-if="changeFormatPopup"
    >
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
    <PopupDialog button="Confirm" text="Cancel" @button="change_ids()" v-model="changeIdsPopup" v-if="changeIdsPopup">
      <div>
        Are you sure you want to change the ids of all the files in this system?<br />
        This will cause new lists for this system to be completely separate from the original.<br />
        only use for major versions or forks.
      </div>
    </PopupDialog>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "vue";
import { convertToXml, removeExtension } from "~/assets/shared/battlescribe/bs_convert";
import { addOne, generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";
import { getDataObject, getDataDbId } from "~/assets/shared/battlescribe/bs_main";
import { BSIDataCatalogue, BSIDataSystem, BSICatalogue, BSIGameSystem } from "~/assets/shared/battlescribe/bs_types";
import { deleteFile, filename } from "~/electron/node_helpers";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { useEditorStore } from "~/stores/editorStore";

export async function download(filename: string, mimeType: any, content: BlobPart) {
  const a = document.createElement("a");
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  a.setAttribute("href", url);
  a.setAttribute("download", filename);
  a.setAttribute("target", "_blank");
  a.click(); // Start downloading
}

// from https://stackoverflow.com/questions/3665115/how-to-create-a-file-in-memory-for-user-to-download-but-not-through-server
export async function saveFilePickerOrDownload(filename: string, mimeType: any, content: BlobPart) {
  //@ts-ignore
  if (globalThis.showSaveFilePicker) {
    //@ts-ignore
    const handle = await showSaveFilePicker({ suggestedName: filename });
    const writable = await handle.createWritable();
    await writable.write(content);
    writable.close();
  } else {
    download(filename, mimeType, content);
  }
}

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
      changeIdsPopup: false,
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
      saveFilePickerOrDownload(`${fileName}.${extension}`, "application/xml", xml);
    },
    popup_change_format() {
      this.changeFormatPopup = true;
    },
    popup_change_ids() {
      this.changeIdsPopup = true;
    },

    async change_ids() {
      const data = getDataObject(this.catalogue);
      const sys = this.store.get_system(data.gameSystemId || data.id);
      const files = sys.getAllCatalogueFiles();
      const ids = {} as Record<string, string>;
      for (const file of files) {
        const file_data = getDataObject(file);
        ids[file_data.id] = generateBattlescribeId();
      }
      for (const file of files) {
        const file_data = getDataObject(file);
        file_data.id = ids[file_data.id];
        if (file_data.gameSystemId) {
          file_data.gameSystemId = ids[file_data.gameSystemId];
        }
        for (const cl of file_data.catalogueLinks || []) {
          cl.targetId = ids[cl.targetId];
        }
      }
      for (const file of files) {
        this.store.saveCatalogue(file);
      }
    },
    async change_format(format: "gstz" | "gst" | "json", deleteExistingFiles: boolean) {
      const data = getDataObject(this.catalogue);
      const sys = this.store.get_system(data.gameSystemId || data.id);
      const files = sys.getAllCatalogueFiles();
      for (const file of files) {
        const file_data = getDataObject(file);
        const path = file_data.fullFilePath;
        if (path) {
          if (deleteExistingFiles) {
            await deleteFile(path);
          }
          const isSystem = Boolean((file as BSIDataSystem).gameSystem);
          let extension: string;
          const fileName = removeExtension(path);
          switch (format) {
            case "gstz":
              extension = isSystem ? "gstz" : "catz";
              break;
            case "gst":
              extension = isSystem ? "gst" : "cat";
              break;
            case "json":
              extension = "json";
              break;
          }
          file_data.fullFilePath = `${fileName}.${extension}`;
          console.log(file_data.fullFilePath);
          this.store.saveCatalogue(file);
        }
      }
    },
  },
  computed: {
    has_duplicate_filename() {
      const data = getDataObject(this.catalogue);
      const sys = this.store.get_system(data.gameSystemId || data.id);
      const files = sys.getAllCatalogueFiles();
      const names = {} as Record<string, number>;

      for (const file of files) {
        const file_data = getDataObject(file);
        const path = file_data.fullFilePath;
        if (path) {
          addOne(names, removeExtension(path));
        }
      }

      return Object.values(names).find((o) => o > 1);
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
  overflow-y: auto;
  padding: 12px 14px;
}

.dhead {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  .dname {
    font-size: 15px;
    font-weight: 650;
  }
  .libbadge {
    font-family: monospace;
    font-size: 10px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border-radius: 3px;
    padding: 2px 5px;
    background: rgba(128, 128, 128, 0.18);
    color: gray;
  }
}

.meta {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 3px 10px;
  font-size: 12.5px;
  .mrow {
    display: contents;
  }
  .mlabel {
    color: gray;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-top: 1px;
  }
  .mval {
    word-break: break-all;
    &.mono {
      font-family: monospace;
      font-size: 12px;
    }
  }
}

.lsection {
  margin-top: 12px;
  .lhead {
    font-size: 11px;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: gray;
    border-bottom: 1px solid rgba(128, 128, 128, 0.25);
    padding-bottom: 2px;
    margin-bottom: 4px;
  }
  .lentry {
    font-size: 13px;
    padding: 1px 0;
  }
}

.actions {
  margin-top: 14px;
}

.hint {
  font-size: 11.5px;
  color: gray;
  font-style: italic;
  margin: 10px 0 0;
}
</style>
