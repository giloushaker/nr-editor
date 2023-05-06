<template>
  <div class="items">
    <div v-for="item of sortedItems" class="item" @click="elementClicked(item)">
      <img src="/assets/icons/book.png" />
      <div>{{ item.name }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";

export interface NamedItem {
  name: string;
}

export default {
  props: {
    items: {
      type: Array as PropType<NamedItem[]>,
      required: true,
    },
  },

  methods: {
    elementClicked(item: NamedItem) {
      this.$emit("itemClicked", item);
    },
  },
  computed: {
    sortedItems() {
      return sortByAscending(this.items, (o) => o.name);
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.item {
  display: grid;
  grid-template-columns: "max-content";
  align-items: center;
  justify-items: center;
  &:last-child {
    margin-right: 0;
  }
  font-size: 12px;
  border: 1px $gray solid;
  padding: 2px;
  border-radius: 5px;
  box-shadow: $box_shadow;
  color: $fontColor;
  cursor: pointer;
  width: 100px;
  text-align: center;
}

.items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  grid-gap: 5px 0px;
  grid-auto-rows: 1fr;
  align-items: stretch;
}
</style>
