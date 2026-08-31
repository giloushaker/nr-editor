<template>
  <CatalogueRightPanelFieldsComment :item="item" />
  <CatalogueRightPanelFieldsBasics :item="item" class="section" />
  <CatalogueRightPanelFieldsReference :item="item" :catalogue="catalogue" class="section" />
  <CatalogueRightPanelFieldsDefaultSelection :item="item" :catalogue="catalogue" class="section" />

  <CatalogueRightPanelFieldsBooleans
    :item="item"
    :fields="[
      { field: 'hidden', enabled: true, name: 'Hidden' },
      { field: 'collective', enabled: false, name: 'Collective' },
      { field: 'import', enabled: true, name: 'Import' },
    ]"
    class="section"
  >
    Entry
  </CatalogueRightPanelFieldsBooleans>

  <CatalogueRightPanelFieldsCategories :item="item" :catalogue="catalogue" class="section" />

  <CatalogueRightPanelFieldsQuickConstraints :item="item" :withCategory="false" class="section">
  </CatalogueRightPanelFieldsQuickConstraints>
  <CatalogueRightPanelFieldsSortChilds :item="item" :catalogue="catalogue" :get_items="getChilds" />
</template>

<script lang="ts">
import type { PropType } from "vue";
import { catalogueProp } from "./fields/props";
import type { ItemTypes } from "~/assets/editor/bs_editor";
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { Base, Group, Link } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, Publication } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    item: {
      type: Object as PropType<Group & EditorBase>,
      required: true,
    },

    ...catalogueProp,
  },
  methods: {
    getChilds(item: EditorBase & Link<Group>) {
      return sortByAscending([...item.iterateSelectionEntries(), ...item.associationsIterator()], (o) => o.getName());
    },
  },
};
</script>
