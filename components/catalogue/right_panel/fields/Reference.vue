<template>
  <fieldset>
    <legend>Reference</legend>
    <table class="editorTable">
      <tr v-if="catalogue.publications">
        <td>Publication:</td>
        <td>
          <select v-model="item.publicationId">
            <option :value="publication.id" v-for="publication of catalogue.publications">
              {{ publication.name }}
            </option>
          </select>
        </td>
      </tr>
      <tr>
        <td>Page:</td>
        <td>
          <input type="text" v-model="item.page" @change="changed" />
        </td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { Base } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["catalogueChanged"],
  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    item: {
      type: Object as PropType<Base>,
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
