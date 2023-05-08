<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsHidden :item="item" @catalogueChanged="changed">
    Constraints
  </CatalogueRightPanelFieldsHidden>
  <CatalogueRightPanelFieldsCharacteristics
    :item="item"
    :catalogue="catalogue"
    @catalogueChanged="changed"
  />
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
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
