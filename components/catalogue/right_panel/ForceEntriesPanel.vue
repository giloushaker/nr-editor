<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsReference :item="item" :catalogue="catalogue" @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsCosts :item="item" :catalogue="catalogue" @catalogueChanged="changed" class="section" />

  <CatalogueRightPanelFieldsHidden :item="item" @catalogueChanged="changed" class="section">
    Entry
  </CatalogueRightPanelFieldsHidden>

  <CatalogueRightPanelFieldsQuickConstraints
    :item="item"
    @catalogueChanged="changed"
    :withCategory="true"
    class="section"
  >
  </CatalogueRightPanelFieldsQuickConstraints>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Force } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<Force>,
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
