<template>
  <div>
    <CatalogueRightPanelFieldsComment :item="item" />
    <CatalogueRightPanelFieldsBasics :item="item" class="section" />
    <CatalogueRightPanelFieldsQuery
      :catalogue="catalogue"
      childSelctions
      :item="item"
      class="section"
      childSelections
      childForces
    />

    <FilterBy class="section" :item="item" :catalogue="catalogue" hideshared />
    <CatalogueRightPanelFieldsAssociations :item="item" class="section" />
    <CatalogueRightPanelFieldsQuickConditions :item="item" class="section" />
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import { catalogueProp } from "./fields/props";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import FilterBy from "./fields/FilterBy.vue";
import type { NRAssociation } from "~/assets/shared/battlescribe/bs_types";

export default {
  props: {
    item: {
      type: Object as PropType<NRAssociation & EditorBase>,
      required: true,
    },
    ...catalogueProp,
  },
  components: { FilterBy },
};
</script>
