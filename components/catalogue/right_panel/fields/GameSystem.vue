<template>
  <fieldset>
    <legend>System</legend>
    <div class="mr-8px">
      <table class="editorTable">
        <tr>
          <td>Categories Label</td>
          <td class="flex gap-2px">
            <input type="text" v-model="item.categoriesLabel" />
          </td>
        </tr>
        <tr>
          <td>Force Label:</td>
          <td class="flex gap-2px items-center">
            <input type="text" v-model="item.forceLabel" />
          </td>
        </tr>
        </table>
        </div>
  </fieldset>
</template>

<script lang="ts">
import {  GameSystem } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    item: {
      type: Object as PropType<GameSystem>,
      required: true,
    },
  },
};
</script>
