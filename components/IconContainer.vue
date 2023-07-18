<template>
  <div class="items">
    <div
      v-for="item of sortedItems"
      class="relative item unselectable"
      :class="{ edited: edited(item), selected: item === modelValue }"
      @click="elementClicked(item)"
      @dblclick="elementDoubleClicked(item)"
    >
      <ErrorIcon class="error" :errors="errors(item)" />
      <img class="icon" :src="getType(item).icon" />
      <div>{{ name(item) }}</div>
    </div>
    <div class="relative item add unselectable" @click="add">
      <img class="w-40px h-40px" src="/assets/icons/iconeplus.png" />
      <div class="bold text-blue">New</div>
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { addOne, capitalize, sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { BSIData } from "~/assets/shared/battlescribe/bs_types";
import ErrorIcon, { IErrorMessage } from "./ErrorIcon.vue";
import { getDataObject, getDataDbId } from "~/assets/shared/battlescribe/bs_main";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { useEditorStore } from "~/stores/editorStore";
export default {
  emits: ["new", "itemClicked", "itemDoubleClicked"],
  setup() {
    return { cataloguesStore: useCataloguesStore(), store: useEditorStore() };
  },
  props: {
    items: {
      type: Array as PropType<BSIData[]>,
      required: true,
    },
    modelValue: {
      required: true,
    },
  },
  methods: {
    getType(item: BSIData) {
      if (item.gameSystem) {
        return { icon: "./assets/icons/system1.png", order: 1 };
      } else if (item.catalogue?.library) {
        return { icon: "./assets/icons/library.png", order: 2 };
      } else {
        return { icon: "./assets/icons/book.png", order: 3 };
      }
    },
    elementDoubleClicked(item: BSIData) {
      this.$emit("itemDoubleClicked", item);
    },
    elementClicked(item: BSIData) {
      this.$emit("itemClicked", item);
    },
    errors(data: BSIData): IErrorMessage[] {
      const result = [] as IErrorMessage[];
      if (this.store.get_catalogue_state(data)?.unsaved) {
        result.push({
          severity: "info",
          msg: "Unsaved",
        });
      }
      const errors = (getDataObject(data) as any as { errors: IErrorMessage[] }).errors;

      if (errors?.length) {
        const counts = {} as Record<string, number>;

        for (const error of errors) {
          if (error.severity) {
            addOne(counts, error.severity);
          } else {
            addOne(counts, "error");
          }
        }

        let msgPieces = [];
        for (const key in counts) {
          msgPieces.push(`${counts[key]} ${capitalize(key)}${counts[key] === 1 ? "" : "s"}`);
        }
        if (errors.find((o) => o.severity === "error")) {
          result.push({
            severity: "error",
            msg: `Has ${msgPieces.join(", ")}`,
          });
        } else if (errors.find((o) => o.severity === "warning")) {
          result.push({
            severity: "warning",
            msg: `Has ${msgPieces.join(", ")}`,
          });
        }
      }
      return result;
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
      return sortByAscending(
        sortByAscending(this.items, (o) => this.name(o)),
        (o) => this.getType(o).order
      );
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
  border: 1px $box_border solid;
  padding: 3px;
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
  padding: 2px;
}

.edited {
  background-color: rgba(40, 120, 250, 0.15);
}
.add {
  border: solid rgb(45, 190, 45) 2px;
}
</style>
