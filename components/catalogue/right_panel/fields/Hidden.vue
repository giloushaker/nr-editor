<template>
  <fieldset>
    <legend>
      <slot />
    </legend>
    <input id="hidden" type="checkbox" v-model="item.hidden" />
    <label for="hidden">Hidden</label>
  </fieldset>
</template>

<script lang="ts">
import { BSIHidden } from "~/assets/shared/battlescribe/bs_types";

export default {
  props: {
    item: {
      type: Object as PropType<BSIHidden>,
      required: true,
    },
  },
};
</script>
