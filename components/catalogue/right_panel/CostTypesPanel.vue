<template>
  <div>
    <CatalogueRightPanelFieldsComment
      :item="item"
      @catalogueChanged="changed"
    />
    <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" />
    <CatalogueRightPanelFieldsHidden :item="item" @catalogueChanged="changed">
      Cost Types
    </CatalogueRightPanelFieldsHidden>
  </div>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { BSICostType } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSICostType>,
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
