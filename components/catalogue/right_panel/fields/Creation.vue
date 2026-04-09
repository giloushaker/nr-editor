<template>
  <fieldset>
    <legend>Amount</legend>
    <div class="flex flex-row flex-wrap gap-x-4">
      <div class="flex flex-row items-center gap-2">
        <span>
          Default Amount (split by <code style="background-color: #aaaaaa40; border-radius: 3px">,</code> for multiple stacks):
        </span>
        <input class="input" type="text" v-model="item.defaultAmount" :placeholder="placeholder" pattern="[0-9,]*" />
      </div>
      <div class="flex flex-row items-center gap-2">
          Step:<input class="input" type="text" v-model="item.step" pattern="[0-9]*" placeholder="any"/>
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
export default {
  props: {
    item: {
      type: Object as PropType<{
        defaultAmount?: number;
        step?: number;
        isLink(): boolean;
        getDefaultAmount(): number | undefined;
      }>,
      required: true,
    },
  },
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
