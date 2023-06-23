<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsReference :item="item" :catalogue="catalogue" @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsEntryType :item="item" @catalogueChanged="changed" class="section">
    Selection Entry
  </CatalogueRightPanelFieldsEntryType>
  <CatalogueRightPanelFieldsCreation :item="item" @catalogueChanged="changed" class="section" />

  <CatalogueRightPanelFieldsCosts :item="item" :catalogue="catalogue" @catalogueChanged="changed" class="section" />

  <CatalogueRightPanelFieldsBooleans :item="item" @catalogueChanged="changed" class="section">
    Entry
  </CatalogueRightPanelFieldsBooleans>

  <CatalogueRightPanelFieldsCategories
    :item="item"
    :catalogue="catalogue"
    @catalogueChanged="changed"
    class="section"
  />

  <CatalogueRightPanelFieldsQuickConstraints
    :item="item"
    @catalogueChanged="changed"
    :withCategory="false"
    class="section"
  >
  </CatalogueRightPanelFieldsQuickConstraints>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["catalogueChanged"],
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

  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },
};
</script>
