<template>
  <div class="item unselectable">
    <template v-if="parent == null">
      <EditorCollapsibleBox nobox v-for="category of categories">
        <template #title>
          <span :class="{ selected: selected }">{{
            category.name
          }}</span></template
        >
        <template #content v-if="item[category.type]">
          <CatalogueEntry
            ref="entries"
            v-for="entry of applyFilter(getTypedArray(item, category.type))"
            :item="entry.item"
            :filter="filter"
            @click.prevent="select(entry)"
            :parent="item"
            :selectedId="selectedId"
            :selected="item.id === selectedId"
            :categories="categories"
            :possibleChildren="possibleChildren"
          />
        </template>
      </EditorCollapsibleBox>
    </template>

    <template v-else>
      <EditorCollapsibleBox
        nobox
        :collapsible="mixedChildren && mixedChildren.length > 0"
        :empty="!mixedChildren || mixedChildren.length == 0"
        :selected="item.id === selectedId"
        :titleCollapse="false"
      >
        <template #title>
          <span>{{ item.name }} </span></template
        >
        <template #content>
          <CatalogueEntry
            ref="entries"
            v-for="child of applyFilter(mixedChildren)"
            :item="child.item"
            :filter="filter"
            @click.prevent="select(child)"
            :parent="item"
            :selectedId="selectedId"
            :categories="categories"
            :possibleChildren="possibleChildren"
          />
        </template>
      </EditorCollapsibleBox>
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

interface CatalogueEntryItem {
  item: Base | Link;
  type: keyof (Base | Link);
}

export default {
  data() {
    return {
      selected: false,
    };
  },

  props: {
    categories: {
      type: Array as PropType<{ name: string; type: keyof (Base | Link) }[]>,
      required: true,
    },
    possibleChildren: {
      type: Array as PropType<Array<keyof (Base | Link)>>,
      required: true,
    },
    selectedId: {
      type: String,
    },
    item: {
      type: Object as PropType<Base | Link>,
      required: true,
    },
    filter: String,
    parent: {
      type: Object as PropType<Base | Link>,
      required: false,
    },
  },

  methods: {
    getTypedArray(
      item: Base | Link,
      type: keyof (Base | Link)
    ): CatalogueEntryItem[] {
      let arr = item[type] as Array<any>;
      return arr.map((elt) => {
        return {
          item: elt as Base | Link,
          type: type,
        };
      });
    },

    select(item: CatalogueEntryItem) {
      this.$emit("selected", item);
    },

    applyFilter(elements: CatalogueEntryItem[]): CatalogueEntryItem[] {
      if (!this.filter) {
        return this.sortArray(elements);
      }

      const regx = textSearchRegex(this.filter);
      return this.sortArray(
        elements.filter(
          (o) =>
            !o.item.getName || !o.item.getName() || o.item.getName().match(regx)
        )
      );
    },

    sortArray(items: CatalogueEntryItem[]) {
      return sortByAscending(items, (o) => o.item.name);
    },

    /*
    sorted() {
      const items = (this.catalogue[this.type] || []) as Base[];
      return sortByAscending(items, (o) => o.getName());
    },
    items() {
      if (!this.filter) {
        return this.sorted;
      }
      const regx = textSearchRegex(this.filter);
      return this.sorted.filter(
        (o) => !o.getName || !o.getName() || o.getName().match(regx)
      );
    },
    entries(): (typeof CatalogueEntry)[] {
      return this.$refs.entries as (typeof CatalogueEntry)[];
    },

    itemSelected(item: any, $el: typeof CatalogueEntry, e: MouseEvent) {
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        for (const selected of this.selected) {
          selected.unselect(item);
        }
      }
      if (e.shiftKey && this.lastSelected) {
        const entries = this.entries;
        const a = entries.findIndex((o) => o === $el);
        const b = entries.findIndex((o) => o === this.lastSelected);
        const low = Math.min(a, b);
        const high = Math.max(a, b);
        for (let i = low; i <= high; i++) {
          const entry = entries[i];
          if (!this.selected.includes(entry)) {
            this.selected.push(entry);
          }
          entries[i].select();
        }
      } else {
        if (!e.ctrlKey) {
          this.$emit("selected", { type: this.type, item: item });
        }
      }
      if (!this.selected.includes($el)) {
        this.selected.push($el);
      }
      this.lastSelected = $el;
    }, */
  },

  computed: {
    mixedChildren(): Array<{ type: keyof (Base | Link); item: Base | Link }> {
      let res: Array<any> = [];
      for (let cat of this.possibleChildren) {
        const sub: Array<any> = this.item[cat] as Array<any>;
        if (sub) {
          res.push(
            ...sub.map((elt) => {
              return { type: cat, item: elt };
            })
          );
        }
      }
      return res;
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
