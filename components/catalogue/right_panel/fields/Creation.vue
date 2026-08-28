<template>
  <fieldset>
    <legend>Amount</legend>
    <div class="flex flex-row flex-wrap gap-x-4">
      <div class="flex flex-row items-center gap-2">
        <span>
          Default Amount (split by <code style="background-color: #aaaaaa40; border-radius: 3px">,</code> for multiple stacks):
        </span>
        <EditorFieldControl :item="item" field="defaultAmount" class="input" pattern="[0-9,]*" :placeholder="placeholder" />
      </div>
      <div class="flex flex-row items-center gap-2">
        Step:<EditorFieldControl :item="item" field="step" class="input" pattern="[0-9]*" placeholder="any" />
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import EditorFieldControl from "./EditorFieldControl.vue";
import { itemProp } from "./props";

export default {
  components: { EditorFieldControl },
  props: itemProp,
  computed: {
    placeholder(): string {
      return `${this.item.isLink() ? this.item.getDefaultAmount() || "unset" : "unset"}`;
    },
  },
};
</script>
<style scoped>
.input {
  max-width: 100px;
}
</style>
