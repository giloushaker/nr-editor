<template>
  <CatalogueRightPanelFieldsComment :item="item" />
  <CatalogueRightPanelFieldsBasics :item="item" class="section" />
  <CatalogueRightPanelFieldsPublication class="section" :item="item" />
</template>

<script lang="ts">
import { PropType } from "vue";
import { Publication } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    item: {
      type: Object as PropType<Publication>,
      required: true,
    },
  },
};
</script>
