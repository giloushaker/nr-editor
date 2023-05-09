<template>
  <div class="item unselectable">
    <template v-if="parent == null">
      <EditorCollapsibleBox
        nobox
        :collapsible="items && items.length > 0"
        v-for="category of categories"
      >
        <template #title>
          <span :class="{ selected: selected }">{{
            category.name
          }}</span></template
        >
        <template #content v-if="item[category.type]">
          <CatalogueEntry
            ref="entries"
            v-for="entry of applyFilterHead(item[category.type])"
            :item="entry"
            :filter="filter"
            @click.prevent="select({ item: entry, type: category.type })"
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
import { textSearchRegex } from "~/assets/shared/battlescribe/bs_helpers";
import { Base, Link } from "~/assets/shared/battlescribe/bs_main";

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
      type: Object as PropType<Base | Link | null>,
      required: true,
    },
  },

  methods: {
    select(item: { type: string; item: Base | Link }) {
      this.$emit("selected", item);
    },

    applyFilter(elements: { item: Base | Link; type: string }[]) {
      if (!this.filter) {
        return elements;
      }
      const regx = textSearchRegex(this.filter);
      return elements.filter(
        (o) =>
          !o.item.getName || !o.item.getName() || o.item.getName().match(regx)
      );
    },

    applyFilterHead(elements: any) {
      if (!elements) {
        return [];
      }
      if (!this.filter) {
        return elements;
      }
      const regx = textSearchRegex(this.filter);
      return elements.filter(
        (o: any) => !o.getName || !o.getName() || o.getName().match(regx)
      );
    },
  },

  computed: {
    mixedChildren(): Array<{ type: string; item: Base | Link }> {
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
  border-bottom: 1px $gray solid;

  &:first-child {
    border-top: 1px $gray solid;
  }

  padding: 2px;
}
</style>
