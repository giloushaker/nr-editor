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
import { catalogueProp } from "./fields/props";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import FilterBy from "./fields/FilterBy.vue";
import { AssociationLink } from "~/assets/shared/battlescribe/bs_main";

export default {
  props: {
    item: {
      type: Object as PropType<AssociationLink & EditorBase>,
      required: true,
    },
    ...catalogueProp,
  },
  components: { FilterBy },
};
</script>
