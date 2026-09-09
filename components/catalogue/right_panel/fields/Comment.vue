<template>
  <fieldset>
    <legend>Comment</legend>
    <UtilEditableDiv v-model="comment" @blur="comment = comment.trim()" />
  </fieldset>
</template>

<script lang="ts">
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
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
        return String(this.item.comment ?? "");
      },
      set(str: string) {
        this.item.comment = String(str ?? "");
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
