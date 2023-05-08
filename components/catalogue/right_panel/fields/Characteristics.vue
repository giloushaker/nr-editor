<template>
  <fieldset>
    <legend>Characteristics</legend>
    <table></table>
  </fieldset>
</template>

<script lang="ts">
import { BSIProfile } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIProfile>,
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
