<template>
  <fieldset>
    <legend>Builder</legend>
    <input id="tracked" type="checkbox" :checked="item.tracked ?? false" @change="setTracked" />
    <label for="tracked" title="If this is checked, the builder always shows this category with its count and limits, even when empty.">Show tracker</label>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

// NR-only hint telling the builder to always display this category's count/limits
export default {
  props: {
    item: {
      type: Object as PropType<Base & EditorBase>,
      required: true,
    },
  },
  methods: {
    // delete instead of storing false so untracked categories keep no extra key in the data
    setTracked(event: Event) {
      if ((event.target as HTMLInputElement).checked) this.item.tracked = true;
      else delete this.item.tracked;
    },
  },
};
</script>
