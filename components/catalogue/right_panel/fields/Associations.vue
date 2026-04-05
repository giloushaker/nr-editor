<template>
  <fieldset>
    <legend>Association</legend>
    <table class="editorTable">
      <tr>
        <td>Label on target   <InfoButton>
          <p>

            This is the label that may appear on the target item when listing associated items.
          </p>
            Examples: 
            <ul>
              <li>for a "Leader" association, this could be "Leading"</li>
              <li>for a "Owned by" association, this could be "Granted Items"</li>
              <li>for a "Regiment" association, this could be "Units"</li>
            </ul>
          </InfoButton>:</td>
        <td><input type="text" v-model="item.label" />
       
        </td>
      </tr>
      <tr>
        <td>Min</td>
        <td><input @input="changed" v-model="item.min" type="number" /></td>
      </tr>
      <tr>
        <td>Max</td>
        <td><input @input="changed" v-model="item.max" type="number" /></td>
      </tr>
      <tr>
        <td>Ids</td>
        <td></td>
      </tr>
      <tr>
        <td>Action (Not implemented yet)</td>
        <td>
          <select v-model="item.action">
            <option :value="undefined">Not defined</option>
            <option value="append">Append</option>
            <option value="replace">Replace</option>
            <option value="overwrite">Overwrite</option>
            <option value="group">Group</option>
          </select>
        </td>
      </tr>
      <tr>
        <td>Splitting behavior (Not implemented yet)</td>
        <td>
          <select v-model="item.splittingBehavior">
            <option :value="undefined">Not defined</option>
            <option value="combine">Combine</option>
            <option value="split">Split</option>
          </select>
        </td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "vue";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { NRAssociation } from "~/assets/shared/battlescribe/bs_types";
import InfoButton from "~/components/InfoButton.vue";

export default {
  props: {
    item: {
      type: Object as PropType<NRAssociation & EditorBase>,
      required: true,
    },
  },
};
</script>
