<template>
  <fieldset>
    <legend>Information</legend>
    <table class="editorTable">
      <tr>
        <td>Readme:</td>
        <td>
          <UtilEditableDiv type="text" v-model="item.readme" />
        </td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { Force } from "~/assets/shared/battlescribe/bs_main";

export default {
  props: {
    item: {
      type: Object as PropType<Force>,
      required: true,
    },
  },
};
</script>
