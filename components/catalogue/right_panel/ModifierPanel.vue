<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsModifier class="section" :item="item" @catalogueChanged="changed" :catalogue="catalogue" />
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { Catalogue, EditorBase, Publication } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIModifier } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    item: {
      type: Object as PropType<BSIModifier>,
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
