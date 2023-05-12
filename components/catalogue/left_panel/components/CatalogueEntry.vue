<template>
  <div class="item unselectable" @click.middle.stop="debug">
    <template
      v-if="
        item.editorTypeName === 'catalogue' ||
        item.editorTypeName === 'gameSystem'
      "
      v-for="category of groupedCategories"
    >
      <CatalogueLeftPanelComponentsEditorCollapsibleBox
        :titleCollapse="false"
        :collapsible="category.items.length > 0"
        :group="get_group('entries')"
        nobox
      >
        <template #title>
          <span>
            <img :src="`/assets/bsicons/${category.icon}`" />
            {{ category.name }}
          </span>
        </template>
        <template #content>
          <template v-for="entry of category.items">
            <CatalogueEntry :item="entry.item" :group="get_group(entry.type)" />
          </template>
        </template>
      </CatalogueLeftPanelComponentsEditorCollapsibleBox>
    </template>

    <template v-else>
      <CatalogueLeftPanelComponentsEditorCollapsibleBox
        nobox
        :collapsible="mixedChildren && mixedChildren.length > 0"
        :empty="!mixedChildren || mixedChildren.length == 0"
        :titleCollapse="false"
        :group="group || []"
      >
        <template #title>
          <span>
            <img :src="`/assets/bsicons/${item.editorTypeName}.png`" />
            {{ getName(item) }}
          </span></template
        >
        <template #content>
          <CatalogueEntry
            v-for="child of applyFilter(mixedChildren)"
            :item="child.item"
            :group="get_group(item.parentKey)"
          />
        </template>
      </CatalogueLeftPanelComponentsEditorCollapsibleBox>
    </template>
  </div>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import {
  sortByAscending,
  textSearchRegex,
} from "~/assets/shared/battlescribe/bs_helpers";
import { CatalogueEntryItem } from "@/stores/editorState";
import { useEditorStore } from "~/stores/editorState";
import {
  ItemKeys,
  ItemTypes,
  getName,
} from "~/assets/shared/battlescribe/bs_editor";

export default {
  setup() {
    return { store: useEditorStore() };
  },
  props: {
    item: {
      type: Object as PropType<ItemTypes>,
      required: true,
    },
    group: {
      type: Array,
    },
  },
  data() {
    return {
      groups: {} as Record<string, any>,
    };
  },
  methods: {
    get_group(key: string) {
      if (!(key in this.groups)) {
        this.groups[key] = [];
      }
      return this.groups[key];
    },
    debug() {
      console.log(this.item);
    },
    getName(obj: any) {
      return getName(obj);
    },

    getTypedArray(
      item: ItemTypes,
      type: ItemKeys | undefined
    ): CatalogueEntryItem[] {
      if (!type) {
        return [];
      }

      let arr = (item as any)[type] as Array<any>;
      if (!arr) {
        return [];
      }

      return arr.map((elt) => {
        return {
          item: elt as ItemTypes,
          type: type,
        };
      });
    },

    applyFilter(elements: CatalogueEntryItem[]): CatalogueEntryItem[] {
      if (!this.filter) {
        return this.sortArray(
          elements.filter((elt) => this.getName(elt.item) != null)
        );
      }

      const regx = textSearchRegex(this.filter);
      return this.sortArray(
        elements.filter((o) => this.getName(o.item)?.match(regx))
      );
    },

    sortArray(items: CatalogueEntryItem[]) {
      return sortByAscending(items, (o) => this.getName(o.item));
    },
  },

  computed: {
    categories() {
      return this.store.categories;
    },

    possibleChildren() {
      return this.store.possibleChildren;
    },

    filter() {
      return this.store.filter;
    },

    mixedChildren(): Array<CatalogueEntryItem> {
      let res: Array<any> = [];
      for (let cat of this.possibleChildren) {
        const sub: Array<any> = (this.item as any)[cat] as Array<any>;
        if (sub && Array.isArray(sub)) {
          res.push(
            ...sub.map((elt) => {
              return { type: cat, item: elt };
            })
          );
        }
      }
      return res;
    },

    children() {
      this.mixedChildren.map((o) => o.item);
    },

    groupedCategories() {
      return this.categories.map((o) => ({
        ...o,
        items: this.applyFilter(
          this.getTypedArray(this.item, o.type).concat(
            this.getTypedArray(this.item, o.links)
          )
        ),
      }));
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.item {
  cursor: pointer;
  padding: 0px;
}
</style>
