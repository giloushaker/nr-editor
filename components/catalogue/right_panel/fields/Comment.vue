<template>
  <fieldset>
    <legend>Comment</legend>
    <UtilEditableDiv v-model="comment" />
  </fieldset>
</template>

<script lang="ts">
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { type BSIOption } from "~/assets/shared/battlescribe/bs_types";

export default {
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
    },
  },
};
</script>
