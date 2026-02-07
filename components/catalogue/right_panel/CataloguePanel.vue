<template>
  <div>
    <CatalogueRightPanelFieldsComment :item="item" />
    <CatalogueRightPanelFieldsBasics :item="item" class="section" />
    <CatalogueRightPanelFieldsReference :catalogue="catalogue" :item="item" class="section" />
    <CatalogueRightPanelFieldsHidden :item="item" class="section">
      Constraints
    </CatalogueRightPanelFieldsHidden>
    <CatalogueRightPanelFieldsRevision :item="item" class="section" />
    <CatalogueRightPanelFieldsCatalogue :item="item" class="section" />
    <CatalogueRightPanelFieldsInformation :item="item" class="section" />
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    item: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
};
</script>
