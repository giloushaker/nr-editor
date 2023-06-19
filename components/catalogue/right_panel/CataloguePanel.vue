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
    <CatalogueRightPanelFieldsRevision :item="item" @catalogueChanged="changed" class="section" />
    <CatalogueRightPanelFieldsCatalogue :item="item" @catalogueChanged="changed" class="section" />
    <CatalogueRightPanelFieldsInformation :item="item" @catalogueChanged="changed" class="section" />
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<Catalogue>,
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
