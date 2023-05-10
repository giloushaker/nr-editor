<template>
  <div class="item unselectable" @click.middle.stop="debug">
    <template v-if="parent == null" v-for="category of groupedCategories">
      <EditorCollapsibleBox
        :titleCollapse="false"
        nobox
        @titleClick="select({ item: item, type: type })"
        :collapsible="category.items.length > 0"
      >
        <template #title>
          <span :class="{ selected: selected }">
            {{ category.name }}
          </span>
        </template>
        <template #content>
          <CatalogueEntry
            ref="entries"
            v-for="entry of category.items"
            :item="entry.item"
            :type="category.type"
            :filter="filter"
            @selected="select"
            :parent="item"
            :selectedItem="selectedItem"
            :selected="item === selectedItem"
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
        :selected="item === selectedItem"
        :titleCollapse="false"
        @titleClick="select({ item: item, type: type })"
      >
        <template #title>
          <span>{{ getName(item, type) }} </span></template
        >
        <template #content>
          <CatalogueEntry
            ref="entries"
            v-for="child of applyFilter(mixedChildren)"
            :item="child.item"
            :type="child.type"
            :filter="filter"
            @selected="select"
            :parent="item"
            :selectedItem="selectedItem"
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
import { findSelfOrParentWhere } from "~/assets/shared/battlescribe/bs_condition";
import {
  sortByAscending,
  textSearchRegex,
} from "~/assets/shared/battlescribe/bs_helpers";
import { Base, Link } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { constraintToText } from "~/assets/shared/battlescribe/bs_modifiers";
import {
  BSICatalogueLink,
  BSICondition,
  BSIConditionGroup,
  BSIConstraint,
  BSIModifier,
  BSIModifierGroup,
  BSIProfile,
  BSIProfileType,
  BSIPublication,
  BSIQuery,
  BSIValued,
} from "~/assets/shared/battlescribe/bs_types";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { getName } from "~/assets/shared/battlescribe/bs_editor";
export type ItemTypes =
  | Base
  | Link
  | Catalogue
  | BSIModifier
  | BSIModifierGroup
  | BSICondition
  | BSIConditionGroup
  | BSIConstraint;

export type ItemKeys =
  // Entries
  | "selectionEntries"
  | "sharedSelectionEntries"
  | "selectionEntryGroups"
  | "sharedSelectionEntryGroups"
  | "entryLinks"
  | "sharedEntryLinks"
  | "forceEntries"
  | "categoryEntries"

  //
  | "catalogue"
  | "catalogueLinks"
  | "publications"
  | "costTypes"
  | "profileTypes"
  | "sharedProfiles"
  | "sharedRules"

  // Modifiable
  | "infoLinks"
  | "profiles"
  | "rules"
  | "infoGroups"

  // Children
  | "categoryEntries"
  | "categoryLinks"
  | "forceEntries"
  | "selectionEntries"
  | "selectionEntryGroups"
  | "entryLinks"

  // Constraints and modifiers
  | "constraints"
  | "conditions"
  | "modifiers"
  | "modifierGroups"
  | "repeats"
  | "conditionGroups";

export interface CatalogueEntryItem {
  item: ItemTypes;
  type: ItemKeys;
}

export default {
  data() {
    return {
      selected: false,
    };
  },

  props: {
    type: {
      type: String as PropType<ItemKeys>,
      required: true,
    },
    categories: {
      type: Array as PropType<{ name: string; type: ItemKeys }[]>,
      required: true,
    },
    possibleChildren: {
      type: Array as PropType<Array<string>>,
      required: true,
    },
    selectedItem: {
      type: Object as PropType<ItemTypes>,
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
  },

  methods: {
    debug() {
      console.log(this.type, this.item, this.getName(this.item, this.type));
    },
    titleClicked() {
      this.$emit("headerClicked", this.item);
    },

    select(item: CatalogueEntryItem) {
      this.$emit("selected", item);
    },

    getName(obj: any, type: string) {
      return getName(obj, type);
    },

    getTypedArray(item: ItemTypes, type: ItemKeys): CatalogueEntryItem[] {
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
    mixedChildren(): Array<CatalogueEntryItem> {
      let res: Array<any> = [];
      for (let cat of this.possibleChildren) {
        const sub: Array<any> = (this.item as any)[cat] as Array<any>;
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
    groupedCategories() {
      return this.categories.map((o) => ({
        ...o,
        items: this.applyFilter(this.getTypedArray(this.item, o.type)),
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
