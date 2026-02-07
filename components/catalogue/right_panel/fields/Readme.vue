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
