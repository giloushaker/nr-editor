<template>
  <CatalogueRightPanelFieldsComment :item="item" />
  <CatalogueRightPanelFieldsBasics :item="item" class="section" />
  <CatalogueRightPanelFieldsReference :item="item" :catalogue="catalogue" class="section" />
  <CatalogueRightPanelFieldsCosts :item="item" :catalogue="catalogue" class="section" />

  <CatalogueRightPanelFieldsBooleans :item="item"> Entry </CatalogueRightPanelFieldsBooleans>
  <CatalogueRightPanelFieldsReadme :item="item" class="section" />
  <CatalogueRightPanelFieldsQuickConstraints :item="item" :withCategory="true" class="section">
  </CatalogueRightPanelFieldsQuickConstraints>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Force } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    item: {
      type: Object as PropType<Force & EditorBase>,
      required: true,
    },

    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
};
</script>
