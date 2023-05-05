<template>
  <div class="items">
    <div v-for="item of items" class="item" @click="elementClicked(item)">
      <img src="/assets/icons/book.png" />
      <div>{{ item.name }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";

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
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.item {
  display: grid;
  grid-template-columns: "max-content";
  align-items: center;
  justify-items: center;
  margin-right: 10px;
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
}

.items {
  display: flex;
}
</style>
