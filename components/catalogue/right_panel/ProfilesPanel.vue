<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" class="section" aliases />
  <CatalogueRightPanelFieldsReference :item="item" :catalogue="catalogue" @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsHidden :item="item" @catalogueChanged="changed" class="section">
    Constraints
  </CatalogueRightPanelFieldsHidden>

  <CatalogueRightPanelFieldsCharacteristics
    class="section"
    :item="item"
    :catalogue="catalogue"
    @catalogueChanged="changed"
  />
  <CatalogueRightPanelFieldsAttributes
    class="section"
    :item="item"
    :catalogue="catalogue"
    @catalogueChanged="changed"
  />
</template>

<script lang="ts">
import { PropType } from "vue";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIProfile } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    item: {
      type: Object as PropType<BSIProfile>,
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
