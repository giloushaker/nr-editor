<template>
  <fieldset>
    <legend>Costs</legend>
    <div class="costs">
      <div v-for="cost of item.costs">
        <label>{{ cost.name }}: </label>
        <UtilNumberInput v-model="cost.value" class="input" />
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { BSICost } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<{ costs: BSICost[] }>,
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

<style scoped lang="scss">
.costs {
  display: flex;
  > div {
    margin-right: 10px;
    &:last-child {
      margin-right: 0;
    }
  }
}

.input {
  max-width: 100px;
}
</style>
