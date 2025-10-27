<template>
  <CatalogueRightPanelFieldsComment :item="item" />
  <fieldset>
    <legend>Condition Group</legend>
    <table class="editorTable">
      <tr>
        <td>Type</td>
        <td>
          <select v-model="item.type">
            <option value="or">Or</option>
            <option value="and">And</option>
          </select>
        </td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIConditionGroup } from "~/assets/shared/battlescribe/bs_types";

export default {
  props: {
    item: {
      type: Object as PropType<BSIConditionGroup & EditorBase>,
      required: true,
    },
  },
};
</script>
