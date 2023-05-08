<template>
  <fieldset>
    <legend>Publication</legend>
    <table>
      <tr>
        <td>Short Name</td>
        <td>
          <input type="text" v-model="item.shortName" @change="changed" />
        </td>
      </tr>
      <tr>
        <td>Publication:</td>
        <td>
          <input type="text" v-model="item.publisher" @change="changed" />
        </td>
      </tr>
      <tr>
        <td>Publication Date:</td>
        <td>
          <input type="text" v-model="item.publicationDate" @change="changed" />
        </td>
      </tr>
      <tr>
        <td>Publication URL:</td>
        <td>
          <input type="text" v-model="item.publicationUrl" @change="changed" />
        </td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { BSIPublication } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIPublication>,
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
