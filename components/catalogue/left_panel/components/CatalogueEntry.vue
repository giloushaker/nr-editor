<template>
  <div class="item unselectable" @click.middle.stop="debug">
    <template v-if="parent == null" v-for="category of groupedCategories">
      <CatalogueLeftPanelComponentsEditorCollapsibleBox
        :titleCollapse="false"
        nobox
        :collapsible="category.items.length > 0"
        :class="{ child: parent }"
        :group="get_group('entries')"
      >
        <template #title>
          <span>
            <img
              v-if="store.icons[category.type].length"
              :src="`/assets/bsicons/${store.icons[category.type]}`"
            />
            {{ category.name }}
          </span>
        </template>
        <template #content>
          <template v-for="entry of category.items">
            <CatalogueEntry
              :item="entry.item"
              :type="entry.type"
              :filter="filter"
              :parent="item"
              :categories="categories"
              :possibleChildren="possibleChildren"
              :group="get_group(entry.type)"
            />
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
        :class="{ child: parent }"
        :select="{ item, type }"
        :group="group || []"
      >
        <template #title>
          <span>
            <img
              v-if="store.icons[type].length"
              :src="`/assets/bsicons/${store.icons[type]}`"
            />
            {{ getName(item, type) }}
          </span></template
        >
        <template #content>
          <CatalogueEntry
            v-for="child of applyFilter(mixedChildren)"
            :item="child.item"
            :type="child.type"
            :filter="filter"
            :parent="item"
            :categories="categories"
            :possibleChildren="possibleChildren"
            :group="get_group(type)"
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
import { Base, Link } from "~/assets/shared/battlescribe/bs_main";
import { ItemTypes, ItemKeys, CatalogueEntryItem } from "@/stores/editorState";
import { useEditorStore } from "~/stores/editorState";
import { getName } from "~/assets/shared/battlescribe/bs_editor";

export default {
  setup() {
    return { store: useEditorStore() };
  },
  props: {
    type: {
      type: String as PropType<ItemKeys>,
      required: true,
    },
    categories: {
      type: Array as PropType<
        { name: string; type: ItemKeys; icon: string; links?: ItemKeys }[]
      >,
      required: true,
    },
    possibleChildren: {
      type: Array as PropType<Array<string>>,
      required: true,
    },
    item: {
      type: Object as PropType<ItemTypes>,
      required: true,
    },
    filter: String,
    parent: {
      type: Object as PropType<ItemTypes>,
      required: false,
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
    getName(obj: any, type: string) {
      return getName(obj, type);
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
          item: elt as Base | Link,
          type: type,
        };
      });
    },

    applyFilter(elements: CatalogueEntryItem[]): CatalogueEntryItem[] {
      if (!this.filter) {
        return this.sortArray(elements);
      }

      const regx = textSearchRegex(this.filter);
      return this.sortArray(
        elements.filter((o) => this.getName(o.item, o.type).match(regx))
      );
    },

    sortArray(items: CatalogueEntryItem[]) {
      return sortByAscending(items, (o) => this.getName(o.item, o.type));
    },
  },

  computed: {
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
