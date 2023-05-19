<template>
  <div>
    <ConditionGroup :item="item" @catalogueChanged="changed" />
  </div>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import ConditionGroup from "./fields/ConditionGroup.vue";
import { BSIConditionGroup } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIConditionGroup>,
      required: true,
    },
  },
  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },
  components: { ConditionGroup },
};
</script>
