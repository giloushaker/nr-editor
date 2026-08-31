<template>
  <CatalogueRightPanelFieldsComment :item="item" />
  <CatalogueRightPanelFieldsBasics :item="item" class="section" />
  <CatalogueRightPanelFieldsReference :item="item" :catalogue="catalogue" class="section" />
  <CatalogueRightPanelFieldsEntryType :item="item" class="section">
    Selection Entry
  </CatalogueRightPanelFieldsEntryType>
  <CatalogueRightPanelFieldsCreation :item="item" class="section" />

  <CatalogueRightPanelFieldsCosts :item="item" :catalogue="catalogue" class="section" />

  <CatalogueRightPanelFieldsBooleans :item="item" class="section"> Entry </CatalogueRightPanelFieldsBooleans>

  <CatalogueRightPanelFieldsCategories :item="item" :catalogue="catalogue" class="section" />

  <CatalogueRightPanelFieldsQuickConstraints :item="item" :withCategory="false" class="section">
  </CatalogueRightPanelFieldsQuickConstraints>

  <CatalogueRightPanelFieldsSortChilds :item="item" :catalogue="catalogue" :get_items="getChilds" />
</template>

<script lang="ts">
import type { PropType } from "vue";
import { catalogueProp } from "./fields/props";
import type { BSISelectionEntry } from "~/assets/shared/battlescribe/bs_types";
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    // RightPanel routes only "selectionEntry" here, and EntryType edits type/subType.
    item: { type: Object as PropType<BSISelectionEntry & EditorBase>, required: true as const },
    ...catalogueProp,
  },
  methods: {
    getChilds(item: EditorBase) {
      return sortByAscending([...item.iterateSelectionEntries(), ...item.associationsIterator()], (o) => o.getName());
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
