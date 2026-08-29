<template>
  <div>
    <ConditionGroup :item="item" />
    <CatalogueRightPanelFieldsSortChilds :item="item" :catalogue="catalogue" :get_items="getChilds" :autosort="false" />
    <QuickConditions :item="item"/>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import type { BSIConditionGroup } from "~/assets/shared/battlescribe/bs_types";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import ConditionGroup from "./fields/ConditionGroup.vue";
import QuickConditions from "./fields/QuickConditions.vue";
  
export default {
  components: { ConditionGroup, QuickConditions },
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
    getChilds(item: EditorBase): Base[] {
      return [
        ...(item.conditions || []),
        ...(item.conditionGroups || []),
        ...((item.repeats || []) as unknown as Base[]),
        ...((item.localConditionGroups || []) as unknown as Base[]),
      ];
    },
  },
};
</script>
