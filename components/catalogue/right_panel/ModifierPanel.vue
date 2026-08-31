<template>
  <CatalogueRightPanelFieldsComment :item="item" />
  <CatalogueRightPanelFieldsModifier class="section" :item="item" :catalogue="catalogue" />
  <CatalogueRightPanelFieldsComplexQuery v-if="allowQuery" :item="item" class="section" />
  <CatalogueRightPanelFieldsQuickConditions :item="item" :withCategory="false" class="section" />
</template>

<script lang="ts">
import type { PropType } from "vue";
import { catalogueProp } from "./fields/props";
import { Catalogue, Publication } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { getModifierOrConditionParent } from "~/assets/shared/battlescribe/bs_modifiers";
import type { BSIModifier } from "~/assets/shared/battlescribe/bs_types";

export default {
  props: {
    ...catalogueProp,
    item: {
      type: Object as PropType<BSIModifier & EditorBase>,
      required: true,
    },
  },
  computed: {
    parent() {
      return getModifierOrConditionParent(this.item as any as EditorBase);
    },
    allowQuery() {
      if (!this.parent) return false;
      if (
        [
          "forceEntry",
          "selectionEntry",
          "selectionEntryGroup",
          "selectionEntryLink",
          "selectionEntryGroupLink",
          "profile",
          "infoLink",
          "rule",
          "infoGroup"
        ].includes(this.parent.editorTypeName)
      )
        return true;
      return false;
    },
  },
};
</script>
