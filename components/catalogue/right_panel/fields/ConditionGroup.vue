<template>
  <CatalogueRightPanelFieldsComment :item="item" />
  <fieldset>
    <legend>Condition Group</legend>
    <table class="editorTable">
      <tr>
        <td>Type</td>
        <td>
          <select v-model="item.type" @change="onChange">
            <option value="or">Or</option>
            <option value="and">And</option>
            <option value="not">Not</option>
            <option value="count">Count</option>

            <!-- Numeric operations -->
            <option disabled>== Numeric ==</option>
            <option value="add">Add</option>
            <option value="subtract">Subtract</option>
            <option value="multiply">Multiply</option>
            <option value="divide">Divide</option>
            <option value="modulo">Modulo</option>
            <option value="power">Power</option>
            <option value="min">Min</option>
            <option value="max">Max</option>
            <!-- Comparison operators -->
            <option disabled>== Comparison ==</option>
            <option value="greater">Greater</option>
            <option value="greaterOrEqual">Greater or Equal</option>
            <option value="less">Less</option>
            <option value="lessOrEqual">Less or Equal</option>
            <option value="equal">Equal</option>
            <option value="notEqual">Not Equal</option>
          </select>
        </td>
      </tr>
      <template v-if="item.type === 'count'">
        <tr>
          <td>Min</td>
          <td>
            <input type="number" v-model="item.min" />
          </td>
        </tr>
        <tr>
          <td>Max</td>
          <td>
            <input type="number" v-model="item.max" />
          </td>
        </tr>
      </template>
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
  methods: {
    onChange() {
      if (this.item.type !== "count") {
        delete this.item.min;
        delete this.item.max;
      }
    },
  },
};
</script>
