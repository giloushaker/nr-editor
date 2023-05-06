<template>
  <div class="details">
    <h4>{{ catalogue.name }}</h4>
    <div><span class="grey">Library:</span> {{ cataloguedata.library }}</div>
    <div><span class="grey">Playable:</span> {{ catalogue.playable }}</div>
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

    <button class="bouton" @click="$emit('edit', catalogue)">
      Edit Catalogue
    </button>
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import {
  BSIDataCatalogue,
  BSIDataSystem,
  BSICatalogue,
  BSIGameSystem,
} from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["edit"],
  props: {
    catalogue: {
      type: Object as PropType<BSIDataCatalogue | BSIDataSystem>,
      required: true,
    },
  },

  computed: {
    cataloguedata(): BSICatalogue | BSIGameSystem {
      let cat = this.catalogue as any;
      return cat.gameSystem || cat.catalogue;
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
