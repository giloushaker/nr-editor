<template>
  <fieldset>
    <legend>Basics</legend>
    <table class="editorTable">
      <tr>
        <td>Unique ID:</td>
        <td><input type="text" v-model="id" @change="changed" /></td>
      </tr>
      <tr>
        <td>Name:</td>
        <td><input type="text" v-model="item.name" @change="changed" /></td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIOption, BSINamed } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIOption & BSINamed>,
      required: true,
    },
  },

  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },
  computed: {
    id: {
      get(): string {
        return this.item.id;
      },
      set(id: string) {
        const obj = this.item as EditorBase;
        const catalogue = obj.getCatalogue();
        catalogue.removeFromIndex(obj);
        obj.id = id;
        catalogue.addToIndex(obj);
      },
    },
  },
};
</script>
