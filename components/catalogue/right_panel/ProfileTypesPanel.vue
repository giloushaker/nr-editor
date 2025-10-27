<template>
  <CatalogueRightPanelFieldsComment :item="item" />
  <CatalogueRightPanelFieldsBasics :item="item" class="section" />
  <CatalogueRightPanelFieldsProfileType class="section" :item="item" />
</template>

<script lang="ts">
import { PropType } from "vue";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIProfileType } from "~/assets/shared/battlescribe/bs_types";
import { useEditorStore } from "~/stores/editorStore";

export default {
  props: {
    item: {
      type: Object as PropType<BSIProfileType & EditorBase>,
      required: true,
    },
  },
  setup() {
    return { store: useEditorStore() };
  },
};
</script>
