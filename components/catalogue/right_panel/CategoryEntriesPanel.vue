<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsHidden :item="item" @catalogueChanged="changed">
    Entry
  </CatalogueRightPanelFieldsHidden>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { Category } from "~/assets/shared/battlescribe/bs_main";
import {
  Catalogue,
  Publication,
} from "~/assets/shared/battlescribe/bs_main_catalogue";

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
