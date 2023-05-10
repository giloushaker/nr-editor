<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsBasics
    :item="item"
    @catalogueChanged="changed"
    class="section"
  />
  <CatalogueRightPanelFieldsReference
    :item="item"
    :catalogue="catalogue"
    @catalogueChanged="changed"
    class="section"
  />
  <CatalogueRightPanelFieldsEntryType
    :item="item"
    @catalogueChanged="changed"
    class="section"
  >
    Selection Entry
  </CatalogueRightPanelFieldsEntryType>

  <CatalogueRightPanelFieldsCosts
    :item="item"
    :catalogue="catalogue"
    @catalogueChanged="changed"
    class="section"
  />

  <CatalogueRightPanelFieldsBooleans
    :item="item"
    @catalogueChanged="changed"
    :fields="[
      { field: 'hidden', enabled: true, name: 'Hidden' },
      { field: 'collective', enabled: false, name: 'Collective' },
      { field: 'import', enabled: true, name: 'Import' },
    ]"
    class="section"
  >
    Entry
  </CatalogueRightPanelFieldsBooleans>

  <CatalogueRightPanelFieldsQuickConstraints
    :item="item"
    @catalogueChanged="changed"
    :withCategory="false"
    class="section"
  >
  </CatalogueRightPanelFieldsQuickConstraints>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { Base, Category } from "~/assets/shared/battlescribe/bs_main";
import {
  Catalogue,
  Publication,
} from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<Base>,
      required: true,
    },

    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },

  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },
};
</script>
