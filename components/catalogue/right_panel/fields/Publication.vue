<template>
  <fieldset>
    <legend>Publication</legend>
    <table class="editorTable">
      <tr>
        <td>Short Name</td>
        <td>
          <input type="text" v-model="item.shortName" />
        </td>
      </tr>
      <tr>
        <td>Publication:</td>
        <td>
          <input type="text" v-model="item.publisher" />
        </td>
      </tr>
      <tr>
        <td>Publication Date:</td>
        <td>
          <input type="text" v-model="item.publicationDate" />
        </td>
      </tr>
      <tr>
        <td>Publication URL:</td>
        <td>
          <input type="text" v-model="item.publisherUrl" />
        </td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { BSIPublication } from "~/assets/shared/battlescribe/bs_types";

export default {
  props: {
    item: {
      type: Object as PropType<BSIPublication>,
      required: true,
    },
  },
};
</script>
