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
              <option value="longText">Long Text</option>
              <option value="annotation">Annotation</option>
            </select>
          </td>
        </tr>
      </table>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { BSIProfileType } from "~/assets/shared/battlescribe/bs_types";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
export default {
  props: {
    item: {
      type: Object as PropType<BSIProfileType & EditorBase>,
      required: true,
    },
  },
};
</script>