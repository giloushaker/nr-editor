<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsProfileType class="section" :item="item" @catalogueChanged="changed" />
</template>

<script lang="ts">
import { PropType } from "vue";
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
