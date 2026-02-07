<template>
  <fieldset>
    <legend>Constraint</legend>
    <table class="editorTable">
      <tr>
        <td>Unique ID:</td>
        <td><input type="text" v-model="item.id" /></td>
      </tr>
    </table>
    <div class="constraint">
      <select v-model="item.type">
        <option value="min">Minimum</option>
        <option value="max">Maximum</option>
        <option value="exactly">Exactly</option>
      </select>
      <UtilNumberInput v-model="item.value" />
      <div>
        <input id="percent" type="checkbox" v-model="item.percentValue" />
        <label for="percent">Percentage</label>
        <input id="negative" type="checkbox" v-model="item.negative" />
        <label for="negative">Negative</label>
        <input id="automatic" type="checkbox" v-model="item.automatic" />
        <label for="automatic">Automatic</label>
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { BSIConstraint } from "~/assets/shared/battlescribe/bs_types";

export default {
  props: {
    item: {
      type: Object as PropType<BSIConstraint>,
      required: true,
    },
  },
};
</script>

<style scoped lang="scss">
.constraint {
  display: grid;
  grid-template-columns: 1fr 100px max-content;
  align-items: center;
  grid-gap: 5px;
}
.checkbox {
  margin-left: 5px;
}
</style>
