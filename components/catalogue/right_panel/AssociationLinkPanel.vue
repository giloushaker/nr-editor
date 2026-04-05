<template>
  <div>
    <CatalogueRightPanelFieldsComment :item="item" />
    <CatalogueRightPanelFieldsBasics :item="item" class="section" />
    <CatalogueRightPanelFieldsLink
      :item="item"
      :catalogue="catalogue"
      class="section"
      type="association"
    />
    <CatalogueRightPanelFieldsQuickConditions :item="item" class="section" />
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import FilterBy from "./fields/FilterBy.vue";
import { NRAssociation } from "~/assets/shared/battlescribe/bs_types";

export default {
  props: {
    item: {
      type: Object as PropType<NRAssociation & EditorBase>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
  components: { FilterBy },
};
</script>
