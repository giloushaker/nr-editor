<template>
  <CatalogueRightPanelFieldsComment :item="item" />
  <CatalogueRightPanelFieldsBasics :item="item" class="section" />
  <CatalogueRightPanelFieldsReference :item="item" :catalogue="catalogue" class="section" />
  <CatalogueRightPanelFieldsDefaultSelection :item="item" :catalogue="catalogue" class="section" />

  <CatalogueRightPanelFieldsBooleans :item="item" :fields="[
    { field: 'hidden', enabled: true, name: 'Hidden' },
    { field: 'collective', enabled: false, name: 'Collective' },
    { field: 'import', enabled: true, name: 'Import' },
  ]" class="section">
    Entry
  </CatalogueRightPanelFieldsBooleans>

  <CatalogueRightPanelFieldsCategories :item="item" :catalogue="catalogue" class="section" />

  <CatalogueRightPanelFieldsQuickConstraints :item="item" :withCategory="false" class="section">
  </CatalogueRightPanelFieldsQuickConstraints>
  <CatalogueRightPanelFieldsSortChilds :item="item" :catalogue="catalogue" />
</template>

<script lang="ts">
import { PropType } from "vue";
import { ItemTypes } from "~/assets/shared/battlescribe/bs_editor";
import { Base, Group, Link } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase, Publication } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    item: {
      type: Object as PropType<ItemTypes & EditorBase & (Base | Link<Group>)>,
      required: true,
    },

    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
};
</script>
