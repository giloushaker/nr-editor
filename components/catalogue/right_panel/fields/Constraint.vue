<template>
  <fieldset>
    <legend>Constraint</legend>
    <table class="editorTable">
      <tr>
        <td>Unique ID:</td>
        <td><input type="text" v-model="item.id" @change="changed" /></td>
      </tr>
    </table>
    <div class="constraint">
      <select v-model="item.type" @change="changed">
        <option value="min">Minimum</option>
        <option value="max">Maximum</option>
        <option value="exactly">Exactly</option>
      </select>
      <UtilNumberInput v-model="item.value" @change="changed" />
      <div>
        <input id="percent" type="checkbox" v-model="item.percentValue" @change="changed" />
        <label for="percent">Percentage?</label>
        <input id="negative" type="checkbox" v-model="item.negative" @change="changed" />
        <label for="negative">Negative?</label>
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { BSIConstraint } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIConstraint>,
      required: true,
    },
  },

  methods: {
    changed() {
      this.$emit("catalogueChanged");
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
</style>
