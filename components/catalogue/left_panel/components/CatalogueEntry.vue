<template>
  <div
    class="item unselectable"
    @click.middle.stop="debug"
    @contextmenu.stop="contextmenu.show"
  >
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
        :payload="item"
        @contextmenu.stop="contextmenu.show($event, category.type)"
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
        :payload="item"
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
            :key="child.item.id"
          />
        </template>
      </CatalogueLeftPanelComponentsEditorCollapsibleBox>
    </template>
  </div>
  <DialogContextMenu ref="contextmenu">
    <template #default="{ payload }">
      <template v-if="!payload && item">
        <div v-if="link.targetId">Follow</div>
        <div v-if="item.links">
          References ({{ item.links ? item.links.length : 0 }})
        </div>
        <Separator v-if="item.isLink() || item.links" />
      </template>
      <template v-if="payload">
        <div @click="store.create(payload)">
          <img
            class="pr-4px"
            :src="`/assets/bsicons/${getTypeName(payload)}.png`"
          />
          {{ getTypeName(payload) }}
        </div>
        <div
          @click="store.create('entryLink')"
          v-if="payload === 'selectionEntries'"
        >
          <img class="pr-4px" :src="`/assets/bsicons/entryLink.png`" />
          entryLink
        </div>
        <Separator />
      </template>
      <template v-else>
        <div
          @click="store.create('selectionEntries')"
          v-if="allowed('selectionEntries')"
        >
          <img class="pr-4px" src="/assets/bsicons/selectionEntry.png" />
          Entry
        </div>
        <div
          @click="store.create('selectionEntryGroups')"
          v-if="allowed('selectionEntryGroups')"
        >
          <img class="pr-4px" src="/assets/bsicons/selectionEntryGroup.png" />
          Group
        </div>
        <div @click="store.create('entryLinks')" v-if="allowed('entryLinks')">
          <img class="pr-4px" src="/assets/bsicons/entryLink.png" />
          Link
        </div>
        <Separator
          v-if="
            allowed(['selectionEntries', 'selectionEntryGroups', 'entryLinks'])
          "
        />
        <div @click="store.create('profiles')" v-if="allowed('profiles')">
          <img class="pr-4px" src="/assets/bsicons/profile.png" />
          Profile
        </div>
        <div @click="store.create('rules')" v-if="allowed('rules')">
          <img class="pr-4px" src="/assets/bsicons/rule.png" />
          Rule
        </div>
        <div @click="store.create('infoGroups')" v-if="allowed('infoGroups')">
          <img class="pr-4px" src="/assets/bsicons/infoGroup.png" />
          Info Group
        </div>
        <div @click="store.create('infoLinks')" v-if="allowed('infoLinks')">
          <img class="pr-4px" src="/assets/bsicons/infoLink.png" />
          Info Link
        </div>
        <Separator
          v-if="allowed(['profiles', 'rules', 'infoGroups', 'infoLinks'])"
        />
        <div @click="store.create('conditions')" v-if="allowed('conditions')">
          <img class="pr-4px" src="/assets/bsicons/condition.png" />
          Condition
        </div>
        <div
          @click="store.create('conditionGroups')"
          v-if="allowed('conditionGroups')"
        >
          <img class="pr-4px" src="/assets/bsicons/conditionGroup.png" />
          Condition Group
        </div>
        <div @click="store.create('repeats')" v-if="allowed('repeats')">
          <img class="pr-4px" src="/assets/bsicons/repeat.png" />
          Repeat
        </div>
        <Separator
          v-if="allowed(['conditions', 'conditionGroups', 'repeats'])"
        />
        <div @click="store.create('constraints')" v-if="allowed('constraints')">
          <img class="pr-4px" src="/assets/bsicons/constraint.png" />
          Constraint
        </div>
        <div @click="store.create('modifiers')" v-if="allowed('modifiers')">
          <img class="pr-4px" src="/assets/bsicons/modifier.png" />
          Modifier
        </div>
        <div
          @click="store.create('modifierGroups')"
          v-if="allowed('modifierGroups')"
        >
          <img class="pr-4px" src="/assets/bsicons/modifierGroup.png" />
          Modifier Group
        </div>
        <Separator
          v-if="allowed(['constraints', 'modifiers', 'modifierGroups'])"
        />
      </template>

      <div @click="store.cut()" v-if="!payload">
        Cut<span class="gray absolute right-5px">Ctrl+X</span>
      </div>
      <div @click="store.copy" v-if="!payload">
        Copy<span class="gray absolute right-5px">Ctrl+C</span>
      </div>
      <div @click="store.paste">
        Paste<span class="gray absolute right-5px">Ctrl+V</span>
      </div>

      <Separator v-if="!payload" />
      <div @click="store.remove()" v-if="!payload">
        <img class="w-12px pr-4px" src="assets/icons/redcross.png" />Remove<span
          class="gray absolute right-5px"
          >Del</span
        >
      </div>
    </template>
  </DialogContextMenu>
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
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { Link } from "~/assets/shared/battlescribe/bs_main";
import { getTypeName } from "~/assets/shared/battlescribe/bs_main";

export default {
  setup() {
    return { store: useEditorStore() };
  },
  props: {
    item: {
      type: Object as PropType<ItemTypes & EditorBase>,
      required: true,
    },
    group: {
      type: Array,
    },
  },
  data() {
    return {
      groups: {} as Record<string, any>,
      msg: "",
    };
  },
  methods: {
    getTypeName,
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
          item: elt as ItemTypes & EditorBase,
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
    allowed(child: string | string[]) {
      if (Array.isArray(child)) {
        for (const type of child) {
          if (this.allowedChildren.has(type)) return true;
        }
        return false;
      }
      return this.allowedChildren.has(child);
    },
  },

  computed: {
    link(): Link {
      return this.item as Link;
    },

    contextmenu() {
      return this.$refs.contextmenu as {
        show: (event: MouseEvent, o: any) => unknown;
      };
    },
    categories() {
      return this.store.categories;
    },

    possibleChildren() {
      return this.store.possibleChildren;
    },

    allowedChildren() {
      return this.store.allowed_children(this.item, this.item.parentKey);
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
</style>
