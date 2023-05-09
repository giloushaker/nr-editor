<template>
  <div
    class="item unselectable"
    :class="{ selected: selected }"
    @click.shift.prevent="select($event)"
    @click="select($event)"
  >
    {{ item.name }}
  </div>
</template>

<script lang="ts">
export default {
  data() {
    return {
      selected: false,
    };
  },

  props: {
    item: {
      type: Object as PropType<{ name?: string }>,
      required: true,
    },
  },

  methods: {
    select(evt: Event) {
      this.selected = true;
      if (evt) {
        this.$emit("selected", this.item, this, evt);
      }
    },

    unselect(val: any) {
      if (this.item != val) {
        this.selected = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.item {
  cursor: pointer;
  border-bottom: 1px $gray solid;

  &:first-child {
    border-top: 1px $gray solid;
  }

  padding: 2px;

  &:hover,
  &.selected {
    background-color: rgba(0, 0, 0, 0.2);
  }
}
</style>
