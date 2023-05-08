<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsProfileType
    :item="item"
    @catalogueChanged="changed"
  />
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { BSIProfileType } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIProfileType>,
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
