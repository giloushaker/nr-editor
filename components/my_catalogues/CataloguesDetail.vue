<template>
  <fieldset class="details">
    <div>
      <legend>{{ cataloguedata.name }}</legend>
      <div><span class="grey">Library:</span> {{ cataloguedata.library }}</div>
      <div><span class="grey">Id:</span> {{ cataloguedata.id }}</div>
      <div><span class="grey">path:</span> {{ cataloguedata.fullFilePath }}</div>
      <div v-if="electron"> <span class="grey">authorUrl:</span> {{ cataloguedata.authorUrl }} </div>
      <div>
        <span class="grey">authorContact:</span>
        {{ cataloguedata.authorContact }}
      </div>
      <div> <span class="grey">authorName:</span> {{ cataloguedata.authorName }} </div>
      <div v-if="(cataloguedata as BSICatalogue).catalogueLinks?.length ">
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
      <p class="info"> To quickly edit a catalogue, you can double-click on it. </p>
    </div>
    <PopupDialog
      button="Confirm"
      text="Cancel"
      @button="$emit('delete', catalogue)"
      v-model="deletePopup"
      v-if="deletePopup"
    >
      <div
        >Are you sure you want to delete this
        {{ (catalogue as BSIDataCatalogue).catalogue ? "catalogue" : "Game System" }}?</div
      >
    </PopupDialog>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "vue";
import { convertToXml } from "~/assets/shared/battlescribe/bs_convert";
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import { getDataDbId } from "~/assets/shared/battlescribe/bs_system";
import { BSIDataCatalogue, BSIDataSystem, BSICatalogue, BSIGameSystem } from "~/assets/shared/battlescribe/bs_types";
import { download } from "~/assets/shared/util";
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
    };
  },
  methods: {
    download_file() {
      const data = getDataObject(this.catalogue);
      const loaded = this.store.get_system(data.gameSystemId || data.id).getLoadedCatalogue({ targetId: data.id });
      const xml = convertToXml(loaded || data);
      download((data as any).gameSystemId ? `${data.name}.cat` : `${data.name}.gst`, "application/xml", xml);
    },
  },
  computed: {
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
}
</style>
