<template>
  <div>
    <CatalogueRightPanelFieldsComment :item="item" />
    <CatalogueRightPanelFieldsRepeat :catalogue="catalogue" :item="item" />
    <CatalogueRightPanelFieldsQuery class="section" :item="item" :catalogue="catalogue" childForces childSelections />
    <CatalogueRightPanelFieldsFilterBy class="section" :item="item" :catalogue="catalogue" />
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIRepeat } from "~/assets/shared/battlescribe/bs_types";

export default {
  props: {
    item: {
      type: Object as PropType<BSIRepeat>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
};
</script>
