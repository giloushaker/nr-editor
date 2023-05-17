<template>
  <fieldset class="details">
    <legend>{{ cataloguedata.name }}</legend>
    <div><span class="grey">Library:</span> {{ cataloguedata.library }}</div>
    <div><span class="grey">Id:</span> {{ cataloguedata.id }}</div>
    <div>
      <span class="grey">authorUrl:</span> {{ cataloguedata.authorUrl }}
    </div>
    <div>
      <span class="grey">authorContact:</span>
      {{ cataloguedata.authorContact }}
    </div>
    <div>
      <span class="grey">authorName:</span> {{ cataloguedata.authorName }}
    </div>
    <div>
      <span class="grey">imports:</span>
      <div
        v-if="(cataloguedata as BSICatalogue).catalogueLinks?.length"
        v-for="link in (cataloguedata as BSICatalogue).catalogueLinks"
      >
        {{ link.name }}
        <span class="grey">{{ link.targetId }}</span> importRootEntries={{
          link.importRootEntries ? "true" : "false"
        }}
      </div>
    </div>

    <div class="flex flex-col">
      <button class="bouton mx-auto" @click="$emit('edit', catalogue)">
        Edit
      </button>
      <button class="bouton mx-auto" @click="deletePopup = true">Delete</button>
    </div>
    <PopupDialog
      button="Confirm"
      text="Cancel"
      @button="$emit('delete', catalogue)"
      v-model="deletePopup"
      v-if="deletePopup"
    >
      <div>Are you sure you want to delete this catalogue?</div>
    </PopupDialog>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "vue";
import { getDataObject } from "~/assets/shared/battlescribe/bs_system";
import {
  BSIDataCatalogue,
  BSIDataSystem,
  BSICatalogue,
  BSIGameSystem,
} from "~/assets/shared/battlescribe/bs_types";
import PopupDialog from "~/shared_components/PopupDialog.vue";
export default {
  emits: ["edit", "delete"],
  props: {
    catalogue: {
      type: Object as PropType<BSIDataCatalogue | BSIDataSystem>,
      required: true,
    },
  },
  data() {
    return {
      deletePopup: false,
    };
  },
  components: { PopupDialog },
  computed: {
    cataloguedata(): BSICatalogue | BSIGameSystem {
      return getDataObject(this.catalogue);
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
