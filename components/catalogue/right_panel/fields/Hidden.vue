<template>
  <fieldset>
    <legend><slot /></legend>
    <input id="hidden" type="checkbox" v-model="item.hidden" @change="changed" />
    <label for="hidden">Hidden</label>
  </fieldset>
</template>

<script lang="ts">
import { BSIHidden } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIHidden>,
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
