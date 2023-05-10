<template>
  <fieldset>
    <legend>Description</legend>
    <UtilEditableDiv
      v-model="item.description"
      @change="changed"
    ></UtilEditableDiv>
  </fieldset>
</template>

<script lang="ts">
import { BSIOption } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<{ description: string }>,
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
