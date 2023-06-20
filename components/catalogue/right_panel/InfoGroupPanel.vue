<template>
  <div>
    <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
    <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" class="section" />
    <CatalogueRightPanelFieldsReference
      :catalogue="catalogue"
      :item="item"
      @catalogueChanged="changed"
      class="section"
    />
    <CatalogueRightPanelFieldsHidden :item="item" @catalogueChanged="changed" class="section">
      Constraints
    </CatalogueRightPanelFieldsHidden>
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIInfoGroup } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIInfoGroup>,
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
