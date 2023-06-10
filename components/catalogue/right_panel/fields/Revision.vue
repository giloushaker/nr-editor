<template>
  <fieldset>
    <legend>Revision</legend>
    <table class="editorTable">
      <tr>
        <td>Revision Number:</td>
        <td><input type="number" v-model="item.revision" @change="changed" /></td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<Catalogue>,
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
