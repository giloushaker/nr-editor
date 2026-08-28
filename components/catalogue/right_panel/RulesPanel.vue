<template>
  <CatalogueRightPanelFieldsComment :item="item" class="section" />
  <CatalogueRightPanelFieldsBasics :item="item" class="section" aliases />
  <CatalogueRightPanelFieldsReference :item="item" :catalogue="catalogue" class="section" />
  <CatalogueRightPanelFieldsHidden :item="item" class="section">
    Constraints
  </CatalogueRightPanelFieldsHidden>

  <CatalogueRightPanelFieldsDescription class="section" :item="item" :catalogue="catalogue" />
</template>

<script lang="ts">
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { PropType } from "vue";
import { catalogueProp } from "./fields/props";
import { Rule } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    ...catalogueProp,
    item: {
      type: Object as PropType<Rule & EditorBase>,
      required: true,
    },
  },
};
</script>
