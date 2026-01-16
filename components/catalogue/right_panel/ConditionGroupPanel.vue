<template>
  <div>
    <ConditionGroup :item="item" />
    <CatalogueRightPanelFieldsSortChilds :item="item" :catalogue="catalogue" :get_items="getChilds" :autosort="false" />
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { BSIConditionGroup } from "~/assets/shared/battlescribe/bs_types";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import ConditionGroup from "./fields/ConditionGroup.vue";

export default {
  components: { ConditionGroup },
  props: {
    item: {
      type: Object as PropType<BSIConditionGroup & EditorBase>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<any>,
      required: true,
    },
  },
  methods: {
    getChilds(item: EditorBase) {
      return [
        ...(item.conditions || []),
        ...(item.conditionGroups || []),
        ...(item.repeats || []),
        ...(item.localConditionGroups || []),
      ];
    },
  },
};
</script>
