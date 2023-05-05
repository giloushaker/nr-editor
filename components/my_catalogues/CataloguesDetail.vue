<template>
  <div class="details">
    <h4>{{ catalogue.name }}</h4>
    <div>
      <span class="grey">Library:</span> {{ catalogue.catalogue.library }}
    </div>
    <div><span class="grey">Playable:</span> {{ catalogue.playable }}</div>
    <div><span class="grey">Id:</span> {{ catalogue.catalogue.id }}</div>
    <div>
      <span class="grey">authorUrl:</span> {{ catalogue.catalogue.authorUrl }}
    </div>
    <div>
      <span class="grey">authorContact:</span>
      {{ catalogue.catalogue.authorContact }}
    </div>
    <div>
      <span class="grey">authorName:</span> {{ catalogue.catalogue.authorName }}
    </div>
    <div>
      <span class="grey">imports:</span>
      <div
        v-if="catalogue.catalogue.catalogueLinks?.length"
        v-for="link in catalogue.catalogue.catalogueLinks"
      >
        {{ link.name }}
        <span class="grey">{{ link.targetId }}</span> importRootEntries={{
          link.importRootEntries ? "true" : "false"
        }}
      </div>
    </div>

    <button class="bouton" @click="$emit('edit', catalogue)">
      Edit Catalogue
    </button>
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { NamedItem } from "../IconContainer.vue";
import { BSIDataCatalogue } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["edit"],
  props: {
    catalogue: {
      type: Object as PropType<BSIDataCatalogue>,
      required: true,
    },
  },
};
</script>

<style scoped lang="scss">
.details {
  min-width: 500px;
  h4 {
    margin: 0;
    font-size: 16px;
    font-weight: bold;
  }
}
</style>
