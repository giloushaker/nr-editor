<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsBasics
    :item="item"
    @catalogueChanged="changed"
    class="section"
  />
  <CatalogueRightPanelFieldsPublication
    class="section"
    :item="item"
    @catalogueChanged="changed"
  />
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { Publication } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<Publication>,
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
