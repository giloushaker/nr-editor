<template>
  <fieldset>
    <legend>Basics</legend>
    <table>
      <tr>
        <td>Unique ID:</td>
        <td><input type="text" v-model="item.id" @change="changed" /></td>
      </tr>
      <tr>
        <td>Name:</td>
        <td><input type="text" v-model="item.name" @change="changed" /></td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { BSIOption, BSINamed } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIOption & BSINamed>,
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
