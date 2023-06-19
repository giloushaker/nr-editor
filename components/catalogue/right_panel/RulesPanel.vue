<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsReference :item="item" :catalogue="catalogue" @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsHidden :item="item" @catalogueChanged="changed" class="section">
    Constraints
  </CatalogueRightPanelFieldsHidden>

  <CatalogueRightPanelFieldsDescription
    class="section"
    :item="item"
    :catalogue="catalogue"
    @catalogueChanged="changed"
  />
</template>

<script lang="ts">
import { PropType } from "vue";
import { Rule } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["catalogueChanged"],
  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    item: {
      type: Object as PropType<Rule>,
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
