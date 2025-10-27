<template>
  <CatalogueRightPanelFieldsComment :item="item" />
  <CatalogueRightPanelFieldsBasics :item="item" class="section" />
  <CatalogueRightPanelFieldsReference :item="item" :catalogue="catalogue" class="section" />
  <CatalogueRightPanelFieldsHidden :item="item" class="section">
    Entry
  </CatalogueRightPanelFieldsHidden>
  <CatalogueRightPanelFieldsDescription class="section" :item="item" :catalogue="catalogue" />
  <CatalogueRightPanelFieldsQuickConstraints :item="item" :withCategory="false" class="section" />
</template>

<script lang="ts">
import { PropType } from "vue";
import { Category } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase, Publication } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    item: {
      type: Object as PropType<Category & EditorBase>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
};
</script>
