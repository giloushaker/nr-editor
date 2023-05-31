<template>
  <fieldset>
    <legend>Information</legend>
    <table class="editorTable">
      <tr>
        <td>Author Name:</td>
        <td><input type="text" v-model="item.authorName" @change="changed" /></td>
      </tr>
      <tr>
        <td>Author Contact:</td>
        <td><UtilEditableDiv v-model="item.authorContact" /></td>
      </tr>
      <tr>
        <td>Author Website:</td>
        <td><input type="text" v-model="item.authorUrl" @change="changed" /></td>
      </tr>
      <tr>
        <td>Readme:</td>
        <td><UtilEditableDiv type="text" v-model="item.readme" @change="changed" /></td>
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
