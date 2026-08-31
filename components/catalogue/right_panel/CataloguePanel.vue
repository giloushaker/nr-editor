<template>
  <div>
    <CatalogueRightPanelFieldsComment :item="item" />
    <CatalogueRightPanelFieldsBasics :item="item" class="section" />
    <CatalogueRightPanelFieldsReference :catalogue="catalogue" :item="item" class="section" />
    <CatalogueRightPanelFieldsHidden :item="item" class="section">
      Constraints
    </CatalogueRightPanelFieldsHidden>
    <CatalogueRightPanelFieldsRevision :item="item" class="section" />
    <CatalogueRightPanelFieldsGameSystem :item="item" class="section" v-if="catalogue.isGameSystem()"/>
    <CatalogueRightPanelFieldsCatalogue :item="item" class="section" />
    <CatalogueRightPanelFieldsInformation :item="item" class="section" />
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import { catalogueProp } from "./fields/props";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    item: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    ...catalogueProp,
  },
};
</script>
