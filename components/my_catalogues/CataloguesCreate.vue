<template>
  <fieldset class="details">
    <legend>{{ cataloguedata.name }}</legend>
    <table class="editorTable">
      <tr>
        <td>
          <label for="name"> name: </label>
        </td>
        <td>
          <input type="text" id="name" v-model="cataloguedata.name" />
        </td>
      </tr>
      <tr>
        <td>
          <label for="authorUrl"> authorUrl: </label>
        </td>
        <td>
          <input type="text" id="authorUrl" v-model="cataloguedata.authorUrl" />
        </td>
      </tr>
      <tr>
        <td>
          <label for="authorContact"> authorContact: </label>
        </td>
        <td>
          <input type="text" id="authorContact" v-model="cataloguedata.authorContact" />
        </td>
      </tr>
      <tr>
        <td>
          <label for="authorName"> authorName: </label>
        </td>

        <td>
          <input type="text" id="authorName" v-model="cataloguedata.authorName" />
        </td>
      </tr>
      <tr>
        <td>id:</td>
        <td>
          <input type="text" class="gray" id="id" v-model="cataloguedata.id" />
        </td>
      </tr>
      <tr>
        <td>
          <label for="library"> library: </label>
        </td>
        <td>
          <input type="checkbox" id="library" v-model="cataloguedata.library" />
        </td>
      </tr>
    </table>

    <button class="bouton" @click="$emit('create', catalogue)"> Create Catalogue </button>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "vue";
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import { BSIDataCatalogue, BSIDataSystem, BSICatalogue, BSIGameSystem } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["create"],
  props: {
    catalogue: {
      type: Object as PropType<BSIDataCatalogue | BSIDataSystem>,
      required: true,
    },
  },

  computed: {
    cataloguedata(): BSICatalogue | BSIGameSystem {
      return getDataObject(this.catalogue);
    },
  },
};
</script>

<style scoped lang="scss">
.details {
  h4 {
    margin: 0;
    font-size: 16px;
    font-weight: bold;
  }
}
.editorTable {
  td {
    border: none;
    text-align: left;
    &:first-child {
      text-align: right;
    }
  }
}
</style>
