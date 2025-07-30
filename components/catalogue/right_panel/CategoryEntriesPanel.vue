<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsReference :item="item" :catalogue="catalogue" @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsHidden :item="item" @catalogueChanged="changed" class="section">
    Entry
  </CatalogueRightPanelFieldsHidden>
  <CatalogueRightPanelFieldsDescription
    class="section"
    :item="item"
    :catalogue="catalogue"
    @catalogueChanged="changed"
  />
  <CatalogueRightPanelFieldsQuickConstraints
    :item="item"
    @catalogueChanged="changed"
    :withCategory="false"
    class="section"
  />
</template>

<script lang="ts">
import { PropType } from "vue";
import { Category } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, Publication } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<Category>,
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
