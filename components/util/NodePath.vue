<template>
  <div class="-indent-16px pl-16px">
    <div v-for="(node, i) in path" class="inline">
      <span class="whitespace-nowrap">
        <img class="typeIcon" :src="`/assets/bsicons/${node.type}.png`" />
        <template v-if="i == path.length - 1">
          <template v-if="node.display?.length && node.display.length <= maxLength">
            <span>{{ node.display }}</span>
          </template>
          <template v-else>
            <span> {{ node.label ? node.label : `${node.type}[${node.index}]` }}</span>
          </template>
        </template>
        <template v-else>
          <span>{{ node.display ? node.display : `${node.type}[${node.index}]` }}</span>
        </template>
      </span>
      <!-- <span class="gray" v-if="i < path.length - 1"> >&nbsp;</span> -->
      <span class="gray" v-if="endArrow || i < path.length - 1">&nbsp;> </span>
    </div>
    <span v-if="text" class="gray inline-block ml-20px text-sm">{{ text }}</span>
  </div>
</template>
<script lang="ts">
import { EntryPathEntryExtended } from "~/assets/shared/battlescribe/bs_editor";

export default defineComponent({
  props: {
    path: { type: Array<EntryPathEntryExtended>, required: true },
    maxLength: { type: Number, default: 80, required: false },
    endArrow: { type: Boolean, default: false },
    text: { type: String },
  },
});
</script>
