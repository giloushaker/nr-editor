<template>
  <CatalogueRightPanelFieldsComment :item="item" />
  <CatalogueRightPanelFieldsQuickConditions :item="item" :withCategory="false" class="section" />
</template>

<script lang="ts">
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { PropType } from "vue";
import { catalogueProp } from "./fields/props";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    item: {
      type: Object as PropType<Base & EditorBase>,
      required: true,
    },

    ...catalogueProp,
  },
};
</script>
