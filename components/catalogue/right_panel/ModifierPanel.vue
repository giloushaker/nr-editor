<template>
  <CatalogueRightPanelFieldsComment :item="item" />
  <CatalogueRightPanelFieldsModifier class="section" :item="item" :catalogue="catalogue" />
  <CatalogueRightPanelFieldsComplexQuery v-if="allowQuery" :item="item" class="section" />
  <CatalogueRightPanelFieldsQuickConditions :item="item" :withCategory="false" class="section" />
</template>

<script lang="ts">
import { PropType } from "vue";
import { Catalogue, EditorBase, Publication } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { getModifierOrConditionParent } from "~/assets/shared/battlescribe/bs_modifiers";
import { BSIModifier } from "~/assets/shared/battlescribe/bs_types";

export default {
  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
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
        ].includes(this.parent.editorTypeName)
      )
        return true;
      return false;
    },
  },
};
</script>
