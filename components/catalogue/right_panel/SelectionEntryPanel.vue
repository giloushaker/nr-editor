<template>
  <CatalogueRightPanelFieldsComment :item="item" />
  <CatalogueRightPanelFieldsBasics :item="item" class="section" />
  <CatalogueRightPanelFieldsReference :item="item" :catalogue="catalogue" class="section" />
  <CatalogueRightPanelFieldsEntryType :item="item" class="section">
    Selection Entry
  </CatalogueRightPanelFieldsEntryType>
  <CatalogueRightPanelFieldsCreation :item="item" class="section" />

  <CatalogueRightPanelFieldsCosts :item="item" :catalogue="catalogue" class="section" />

  <CatalogueRightPanelFieldsBooleans :item="item" class="section">
    Entry
  </CatalogueRightPanelFieldsBooleans>

  <CatalogueRightPanelFieldsCategories :item="item" :catalogue="catalogue" class="section" />


  <CatalogueRightPanelFieldsQuickConstraints :item="item" :withCategory="false" class="section">
  </CatalogueRightPanelFieldsQuickConstraints>

  <CatalogueRightPanelFieldsSortChilds :item="item" :catalogue="catalogue" />
</template>

<script lang="ts">
import { PropType } from "vue";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    item: {
      type: Object as PropType<any>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
};
</script>
<style scoped>
.typeIcon {
  max-width: 18px;
  vertical-align: middle;
}

.typeIcon-wrapper {
  display: inline-block;
  min-width: 20px;
  min-height: 1px;
}
</style>