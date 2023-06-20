<template>
  <fieldset>
    <legend>Reference</legend>
    <table class="editorTable">
      <tr>
        <td>Publication:</td>
        <td>
          <select v-model="item.publicationId" @change="changed">
            <option :value="publication.id" v-for="publication of publications">
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
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
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
  computed: {
    publications() {
      return sortByAscending([...this.catalogue.iteratePublications()], (o) => o?.name || "");
    },
  },
  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },
};
</script>
