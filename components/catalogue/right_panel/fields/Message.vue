<template>
  <fieldset>
    <legend>Message </legend>
    <UtilEditableDiv v-model="message" />
  </fieldset>
</template>

<script lang="ts">
import { Constraint } from "~/assets/shared/battlescribe/bs_main";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    item: {
      type: Object as PropType<Constraint & EditorBase>,
      required: true,
    },
  },
  computed: {
    message: {
      get(): string {
        return (Array.isArray(this.item.message) ? this.item.message[0] : this.item.message) || "";
      },
      set(str: string) {
        this.item.message = str ? str : undefined;
      },
    },
  },
};
</script>
