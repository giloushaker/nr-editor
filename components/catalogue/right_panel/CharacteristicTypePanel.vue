<template>
  <p class="info" v-if="item.editorTypeName === 'attributeType'">
    Note: AttributeTypes are used to add data for exports, they are not directly visible in the list builder.
  </p>
  <CatalogueRightPanelFieldsBasics :item="item" class="section" />
  <CatalogueRightPanelFieldsCharacteristicType :item="item" />
</template>

<script lang="ts">
import { PropType } from "vue";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIAttributeType, BSICharacteristicType } from "~/assets/shared/battlescribe/bs_types";
import { useEditorStore } from "~/stores/editorStore";
import { useSettingsStore } from "~/stores/settingsState";

export default {
  props: {
    item: {
      type: Object as PropType<(BSICharacteristicType | BSIAttributeType) & EditorBase>,
      required: true,
    },
  },
  setup() {
    return { settings: useSettingsStore(), store: useEditorStore() };
  },
};
</script>
