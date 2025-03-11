<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsModifier class="section" :item="item" @catalogueChanged="changed" :catalogue="catalogue" />
  <CatalogueRightPanelFieldsComplexQuery v-if="allowQuery" :item="item" @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsQuickConditions
    :item="item"
    @catalogueChanged="changed"
    :withCategory="false"
    class="section"
  />
</template>

<script lang="ts">
import { PropType } from "vue";
import { Catalogue, EditorBase, Publication } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { getModifierOrConditionParent } from "~/assets/shared/battlescribe/bs_modifiers";
import { BSIModifier } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
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

  methods: {
    changed() {
      this.$emit("catalogueChanged");
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
