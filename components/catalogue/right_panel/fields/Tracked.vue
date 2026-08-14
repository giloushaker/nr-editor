<template>
  <fieldset>
    <legend>Builder</legend>
    <img
      v-if="trackedOnTarget"
      title="tracked is true on target"
      style="vertical-align: text-top; margin-left: 4px; margin-top: 1px"
      class="typeIcon"
      src="assets/bsicons/link.png"
    />
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
  computed: {
    // same rule as Booleans.vue: flag it only when the target turns it on and self doesn't
    trackedOnTarget() {
      return Boolean(this.item.target) && !this.item.tracked && Boolean(this.item.target!.tracked);
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
