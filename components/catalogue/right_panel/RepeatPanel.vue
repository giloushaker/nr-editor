<template>
  <div>
    <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
    <CatalogueRightPanelFieldsRepeat :catalogue="catalogue" :item="item" @catalogueChanged="changed" />
    <CatalogueRightPanelFieldsQuery
      class="section"
      :item="item"
      :catalogue="catalogue"
      @catalogueChanged="changed"
      childForces
      childSelections
    />
    <CatalogueRightPanelFieldsFilterBy
      class="section"
      :item="item"
      :catalogue="catalogue"
      @catalogueChanged="changed"
    />
  </div>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIRepeat } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIRepeat>,
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
