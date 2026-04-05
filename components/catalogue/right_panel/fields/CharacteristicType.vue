<template>
  <fieldset class="section">
    <legend>Characteristic Kind</legend>
    <div class="mr-8px">
      <table class="editorTable">
        <tr>
          <td>Kind:</td>
          <td class="flex gap-2px">
            <select v-model="item.kind">
              <option :value="undefined">Not defined</option>
              <option value="longText">Description / Long Text</option>
              <option value="annotation">Annotation</option>
              <option value="annotation">Cost</option>
            </select>
          </td>
        </tr>
      </table>
    </div>
  </fieldset>
  <fieldset class="section">
    <legend>Creation (in editor)</legend>
    <div class="mr-8px">
      <table class="editorTable">
        <tr>
          <td> Default Value: </td>
          <td>
            <UtilEditableDiv v-model="item.defaultValue" />
          </td>
        </tr>
      </table>
    </div>
  </fieldset>
  <CatalogueRightPanelFieldsFormatRules :item="item" class="section" />
</template>

<script lang="ts">
import { BSICharacteristicType } from "~/assets/shared/battlescribe/bs_types";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import UtilEditableDiv from "~/components/util/EditableDiv.vue";
import { useEditorStore } from "~/stores/editorStore";

export default {
  components: { UtilEditableDiv },
  props: {
    item: {
      type: Object as PropType<BSICharacteristicType & EditorBase>,
      required: true
    },
  },
};
</script>
