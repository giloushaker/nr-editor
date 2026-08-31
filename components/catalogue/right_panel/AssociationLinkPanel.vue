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
import type { PropType } from "vue";
import { catalogueProp } from "./fields/props";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
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
