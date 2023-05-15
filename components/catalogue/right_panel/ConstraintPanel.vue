<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsConstraint
    :catalogue="catalogue"
    :item="item"
    @catalogueChanged="changed"
    class="section"
  />
  <CatalogueRightPanelFieldsQuery
    :catalogue="catalogue"
    :item="item"
    @catalogueChanged="changed"
    class="section"
  />
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<Base>,
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
