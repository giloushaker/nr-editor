<template>
  <div class="item unselectable" @click.middle.stop="debug" @contextmenu.stop="contextmenu.show">
    <template
      v-if="item.editorTypeName === 'catalogue' || item.editorTypeName === 'gameSystem'"
      v-for="category of groupedCategories"
    >
      <CatalogueLeftPanelComponentsEditorCollapsibleBox
        :titleCollapse="false"
        :collapsible="category.items.length > 0"
        :group="get_group('entries')"
        :payload="item"
        @contextmenu.stop="contextmenu.show($event, category.type)"
        :class="category.type"
        nobox
        :defcollapsed="false"
      >
        <template #title>
          <span>
            <img :src="`/assets/bsicons/${category.icon}`" />
            {{ category.name }}
          </span>
        </template>
        <template #content>
          <template v-for="entry of category.items">
            <CatalogueEntry :item="entry.item" :group="get_group(entry.type)" :forceShowRecursive="forceShow" />
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
        :class="item.parentKey"
      >
        <template #title>
          <span>
            <img :src="`/assets/bsicons/${item.editorTypeName}.png`" />
            {{ getName(item) }} ({{ item.editorTypeName }})
          </span></template
        >
        <template #content>
          <CatalogueEntry
            v-for="child of mixedChildren"
            :item="child.item"
            :group="get_group(item.parentKey)"
            :key="child.item.id"
            :forceShowRecursive="forceShow"
          />
        </template>
      </CatalogueLeftPanelComponentsEditorCollapsibleBox>
    </template>
    <DialogContextMenu ref="contextmenu">
      <template #default="{ payload }">
        <template v-if="!payload && item">
          <div v-if="link.target" @click="store.follow(link)"
            >Follow
            <span class="gray" v-if="link.target.catalogue !== item.catalogue">
              &nbsp;({{ link.target.catalogue.getName() }})
            </span>
          </div>
          <div v-if="item.links" @click="store.mode = 'references'">
            References ({{ item.links ? item.links.length : 0 }})
          </div>
          <Separator v-if="item.isLink() || item.links" />
        </template>

        <!-- All Adds -->
        <template v-if="payload">
          <div @click="store.create(payload)">
            <img class="pr-4px" :src="`/assets/bsicons/${getTypeName(payload)}.png`" />
            {{ getTypeName(payload) }}
          </div>
          <div @click="store.create('entryLink')" v-if="payload === 'selectionEntries'">
            <img class="pr-4px" :src="`/assets/bsicons/entryLink.png`" />
            Link
          </div>
          <Separator />
        </template>
        <template v-else>
          <div @click="store.create('selectionEntries')" v-if="allowed('selectionEntries')">
            <img class="pr-4px" src="/assets/bsicons/selectionEntry.png" />
            Entry
          </div>
          <div @click="store.create('selectionEntryGroups')" v-if="allowed('selectionEntryGroups')">
            <img class="pr-4px" src="/assets/bsicons/selectionEntryGroup.png" />
            Group
          </div>
          <div @click="store.create('entryLinks')" v-if="allowed('entryLinks')">
            <img class="pr-4px" src="/assets/bsicons/entryLink.png" />
            Link
          </div>
          <Separator v-if="allowed(['selectionEntries', 'selectionEntryGroups', 'entryLinks'])" />
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
          <Separator v-if="allowed(['profiles', 'rules', 'infoGroups', 'infoLinks'])" />
          <div @click="store.create('conditions')" v-if="allowed('conditions')">
            <img class="pr-4px" src="/assets/bsicons/condition.png" />
            Condition
          </div>
          <div @click="store.create('conditionGroups')" v-if="allowed('conditionGroups')">
            <img class="pr-4px" src="/assets/bsicons/conditionGroup.png" />
            Condition Group
          </div>
          <div @click="store.create('repeats')" v-if="allowed('repeats')">
            <img class="pr-4px" src="/assets/bsicons/repeat.png" />
            Repeat
          </div>
          <Separator v-if="allowed(['conditions', 'conditionGroups', 'repeats'])" />
          <div @click="store.create('constraints')" v-if="allowed('constraints')">
            <img class="pr-4px" src="/assets/bsicons/constraint.png" />
            Constraint
          </div>
          <div @click="store.create('modifiers')" v-if="allowed('modifiers')">
            <img class="pr-4px" src="/assets/bsicons/modifier.png" />
            Modifier
          </div>
          <div @click="store.create('modifierGroups')" v-if="allowed('modifierGroups')">
            <img class="pr-4px" src="/assets/bsicons/modifierGroup.png" />
            Modifier Group
          </div>
          <Separator v-if="allowed(['constraints', 'modifiers', 'modifierGroups'])" />
        </template>

        <div @click="store.cut()" v-if="!payload"> Cut<span class="gray absolute right-5px">Ctrl+X</span> </div>
        <div @click="store.copy" v-if="!payload"> Copy<span class="gray absolute right-5px">Ctrl+C</span> </div>
        <div @click="store.paste"> Paste<span class="gray absolute right-5px">Ctrl+V</span> </div>

        <Separator v-if="!payload" />
        <div @click="store.remove()" v-if="!payload">
          <img class="w-12px pr-4px" src="assets/icons/redcross.png" />Remove<span class="gray absolute right-5px"
            >Del</span
          >
        </div>
      </template>
    </DialogContextMenu>
  </div>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { CatalogueEntryItem } from "@/stores/editorState";
import { useEditorStore } from "~/stores/editorState";
import { ItemKeys, ItemTypes, getName, getTypeName } from "~/assets/shared/battlescribe/bs_editor";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { Link } from "~/assets/shared/battlescribe/bs_main";

export default {
  setup() {
    return { store: useEditorStore() };
  },
  props: {
    item: {
      type: Object as PropType<EditorBase>,
      required: true,
    },
    group: {
      type: Array,
    },
    forceShowRecursive: {
      type: Boolean,
      default: false,
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
      console.log(this.item.name, this.forceShow, this.item);
    },
    getName(obj: any) {
      return getName(obj);
    },
    getTypedArray(item: ItemTypes, type: ItemKeys | undefined): CatalogueEntryItem[] {
      if (!type) {
        return [];
      }

      let arr = (item as any)[type] as Array<any>;
      if (!arr) {
        return [];
      }

      const result = [];
      for (const elt of arr) {
        if (!this.filter_child(elt)) continue;

        result.push({ item: elt, type: type });
      }
      return result;
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
    filter_child(elt: EditorBase) {
      if (!this.forceShow) {
        if (this.store.filter && elt.showInEditor !== true) return false;
      }
      return true;
    },
  },

  computed: {
    link(): Link & EditorBase {
      return this.item as Link & EditorBase;
    },
    iscollapsible() {
      return this.mixedChildren.length > 0 && this.hiddenChilds < this.mixedChildren.length;
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
      return this.store.allowed_children(this.item, this.item.parentKey) || new Set();
    },
    forceShow() {
      return this.item.showChildsInEditor || this.forceShowRecursive;
    },
    mixedChildren(): Array<CatalogueEntryItem> {
      const res = [];
      for (const cat of this.possibleChildren) {
        const sub = (this.item as any)[cat] as any[];
        if (!sub || !Array.isArray(sub)) continue;
        for (const elt of sub) {
          if (!this.filter_child(elt)) continue;
          res.push({ type: cat, item: elt });
        }
      }
      return res;
    },
    groupedCategories() {
      return this.categories.map((o) => ({
        ...o,
        items: this.getTypedArray(this.item, o.type).concat(this.getTypedArray(this.item, o.links)),
      }));
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";
</style>
