<template>
  <div>
    <ConditionGroup :item="item" />
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import ConditionGroup from "./fields/ConditionGroup.vue";
import { BSIConditionGroup } from "~/assets/shared/battlescribe/bs_types";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    item: {
      type: Object as PropType<BSIConditionGroup & EditorBase>,
      required: true,
    },
  },
  components: { ConditionGroup },
};
</script>
