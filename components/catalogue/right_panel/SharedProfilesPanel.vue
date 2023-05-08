<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsHidden :item="item" @catalogueChanged="changed">
    Constraints
  </CatalogueRightPanelFieldsHidden>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { BSIProfile } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
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
