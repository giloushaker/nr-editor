<template>
  <fieldset>
    <legend>Condition Group</legend>
    <table class="editorTable">
      <tr>
        <td>Type</td>
        <td>
          <select v-model="item.type" @change="changed">
            <option value="or">Or</option>
            <option value="and">And</option>
          </select>
        </td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { BSIConditionGroup } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIConditionGroup>,
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
