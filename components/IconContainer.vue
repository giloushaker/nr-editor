<template>
  <div class="items">
    <div
      v-for="item of sortedItems"
      class="relative item"
      :class="{ edited: edited(item), selected: item === modelValue }"
      @click="elementClicked(item)"
    >
      <ErrorIcon class="error" :errors="errors(item)" />
      <template v-if="item.gameSystem">
        <img src="/assets/icons/system1.png" />
      </template>
      <template v-else-if="item.catalogue!.library">
        <img src="/assets/icons/library.png" />
      </template>
      <template v-else>
        <img src="/assets/icons/book.png" />
      </template>
      <div>{{ name(item) }}</div>
    </div>
    <div class="relative item add" @click="add">
      <img class="w-40px h-40px" src="/assets/icons/iconeplus.png" />
      <div class="bold text-blue">New</div>
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { BSIData } from "~/assets/shared/battlescribe/bs_types";
import ErrorIcon from "./ErrorIcon.vue";
import {
  getDataDbId,
  getDataObject,
} from "~/assets/shared/battlescribe/bs_system";
import { useCataloguesStore } from "~/stores/cataloguesState";
export default {
  emits: ["new", "itemClicked"],
  setup() {
    return { cataloguesStore: useCataloguesStore() };
  },
  props: {
    items: {
      type: Array as PropType<BSIData[]>,
      required: true,
    },
    modelValue: {
      type: Object as PropType<null | BSIData>,
      required: true,
    },
  },
  methods: {
    elementClicked(item: BSIData) {
      this.$emit("itemClicked", item);
    },
    errors(data: BSIData) {
      return [];
    },
    edited(data: BSIData) {
      return this.cataloguesStore.getEdited(getDataDbId(data));
    },
    name(data: BSIData) {
      return getDataObject(data).name;
    },
    add() {
      this.$emit("new");
    },
  },
  computed: {
    sortedItems() {
      return sortByAscending(this.items, (o) => this.name(o));
    },
  },
  components: { ErrorIcon },
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
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  grid-gap: 5px 0px;
  grid-auto-rows: 1fr;
  align-items: stretch;
}

.error {
  position: absolute;
  right: 5px;
  top: 5px;
}

.item:hover {
  background-color: rgba($color: #000000, $alpha: 0.05);
}
.selected {
  border: solid black 2px;
}

.edited {
  background-color: rgba(40, 120, 250, 0.15);
}
.add {
  border: solid rgb(45, 190, 45) 2px;
}
</style>
