<template>
  <fieldset>
    <legend>Comment</legend>
    <UtilEditableDiv v-model="comment" @change="changed"></UtilEditableDiv>
  </fieldset>
</template>

<script lang="ts">
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { type BSIOption } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIOption & EditorBase>,
      required: true,
    },
  },
  computed: {
    comment: {
      get(): string {
        return (Array.isArray(this.item.comment) ? this.item.comment[0] : this.item.comment) || "";
      },
      set(str: string) {
        this.item.comment = str ? str : undefined;
      },
    },
  },
  methods: {
    changed() {
      this.item.getCatalogue()?.refreshErrors(this.item);
      this.$emit("catalogueChanged");
    },
  },
};
</script>
