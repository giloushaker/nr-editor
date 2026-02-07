<template>
  <fieldset>
    <legend>Revision</legend>
    <table class="editorTable">
      <tr>
        <td>Revision Number:</td>
        <td><input type="number" v-model="item.revision" /></td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    item: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
};
</script>
