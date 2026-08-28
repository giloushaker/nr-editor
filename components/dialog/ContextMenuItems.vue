<template>
  <template v-for="(group, gi) of visibleGroups" :key="gi">
    <Separator v-if="gi > 0" />
    <div v-for="(item, ii) of group" :key="ii" @click="item.run && item.run()">
      <img v-if="item.icon" class="pr-4px" :class="item.iconClass" :src="item.icon" />
      <span>{{ item.label }}</span>
      <span v-if="item.note" class="gray">&nbsp;{{ item.note }}</span>
      <span v-if="item.shortcut" class="gray right">{{ item.shortcut }}</span>
      <template v-if="item.children && item.children.length">
        <span class="right">❯</span>
        <ContextMenu :id="item.submenuId || item.label">
          <ContextMenuItems :groups="[item.children]" />
        </ContextMenu>
      </template>
    </div>
  </template>
</template>

<script lang="ts">
import type { PropType } from "vue";
import ContextMenu from "./ContextMenu.vue";
import Separator from "../Separator.vue";
import type { MenuItem } from "./menu";

/**
 * Renders a menu described as data: an array of groups, each an array of items.
 *
 * The point is the separators. They used to be written by hand, each with a `v-if` repeating
 * the conditions of the items above it -- and three had drifted: one tested a key that does
 * not exist, one was a copy of its neighbour, one tested an array for truthiness. Here a
 * group is drawn only if it has items and separators fall between whatever is left, so there
 * is nothing left to keep in step.
 */
export default {
  name: "ContextMenuItems",
  components: { ContextMenu, Separator },
  props: {
    groups: {
      type: Array as PropType<Array<MenuItem[]>>,
      required: true,
    },
  },
  computed: {
    visibleGroups(): Array<MenuItem[]> {
      return this.groups.filter((group) => group.length);
    },
  },
};
</script>

<style scoped>
.right {
  margin-left: auto;
  float: right;
  padding-left: 5px;
}
</style>
