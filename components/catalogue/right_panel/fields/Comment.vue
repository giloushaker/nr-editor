<template>
  <fieldset>
    <legend>Comment</legend>
    <UtilEditableDiv
      v-if="item.comment"
      v-model="item.comment"
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
      type: Object as PropType<BSIOption>,
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
