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
        :defcollapsed="true"
      >
        <template #title>
          <span>
            <img :src="`assets/bsicons/${category.icon}`" />
            {{ category.name }}
          </span>
        </template>
        <template #content>
          <template :key="entry.item.id" v-for="entry of category.items">
            <CatalogueEntry
              :item="entry.item"
              :group="get_group(category.type)"
              :forceShowRecursive="forceShow"
              :imported="entry.imported"
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
        :group="group || []"
        :payload="item"
        :class="item.parentKey"
      >
        <template #title>
          <span :class="{ imported: imported }">
            <img :src="`assets/bsicons/${item.editorTypeName}.png`" />
            <span>{{ getName(item) }}</span>
            <span v-if="getNameExtra(item)" class="gray">&nbsp;{{ getNameExtra(item) }} </span>
          </span>
        </template>
        <template #content>
          <CatalogueEntry
            v-for="child of mixedChildren"
            :item="child.item"
            :group="get_group('default')"
            :key="child.item.id"
            :forceShowRecursive="forceShow"
            :imported="imported"
          />
        </template>
      </CatalogueLeftPanelComponentsEditorCollapsibleBox>
    </template>

    <ContextMenu v-if="contextmenuopen" v-model="contextmenuopen" ref="contextmenu">
      <template #default="{ payload }">
        <template v-if="!payload && item">
          <div v-if="link.target" @click="store.follow(link)">
            Follow
            <span class="gray" v-if="link.target.catalogue !== item.catalogue">
              &nbsp;({{ link.target.catalogue.getName() }})
            </span>
          </div>
          <div v-if="imported" @click="store.follow(link)">
            Goto
            <span class="gray"> &nbsp;({{ item.catalogue.getName() }}) </span>
          </div>
          <div v-if="item.links" @click="store.mode = 'references'">
            References ({{ item.links ? item.links.length : 0 }})
          </div>
          <Separator v-if="item.isLink() || item.links || imported" />
        </template>
        <template v-if="payload">
          <div @click="store.create(payload)">
            <img class="pr-4px" :src="`assets/bsicons/${getTypeName(payload)}.png`" />
            {{ getTypeLabel(getTypeName(payload)) }}
          </div>
          <div @click="store.create('entryLinks')" v-if="payload === 'selectionEntries'">
            <img class="pr-4px" :src="`assets/bsicons/link.png`" />
            Link
          </div>
          <div @click="store.create('infoLinks', { type: 'rule' })" v-if="payload === 'rules'">
            <img class="pr-4px" :src="`assets/bsicons/link.png`" />
            Link
          </div>
          <Separator />
        </template>
        <template v-else>
          <div @click="store.create('selectionEntries')" v-if="allowed('selectionEntries')">
            <img class="pr-4px" src="assets/bsicons/selectionEntry.png" />
            Entry
          </div>
          <div @click="store.create('selectionEntryGroups')" v-if="allowed('selectionEntryGroups')">
            <img class="pr-4px" src="assets/bsicons/selectionEntryGroup.png" />
            Group
          </div>
          <div @click="store.create('entryLinks')" v-if="allowed('entryLinks')">
            <img class="pr-4px" src="assets/bsicons/link.png" />
            Link
          </div>
          <Separator v-if="allowed(['selectionEntries', 'selectionEntryGroups', 'entryLinks'])" />
          <div @click="store.create('profiles')" v-if="allowed('profiles')">
            <img class="pr-4px" src="assets/bsicons/profile.png" />
            Profile
          </div>
          <div @click="store.create('rules')" v-if="allowed('rules')">
            <img class="pr-4px" src="assets/bsicons/rule.png" />
            Rule
          </div>
          <div @click="store.create('infoGroups')" v-if="allowed('infoGroups')">
            <img class="pr-4px" src="assets/bsicons/infoGroup.png" />
            Info Group
          </div>
          <div @click="store.create('infoLinks')" v-if="allowed('infoLinks')">
            <img class="pr-4px" src="assets/bsicons/link.png" />
            Info Link
          </div>
          <Separator v-if="allowed(['profiles', 'rules', 'infoGroups', 'infoLinks'])" />
          <div @click="store.create('conditions')" v-if="allowed('conditions')">
            <img class="pr-4px" src="assets/bsicons/condition.png" />
            Condition
          </div>
          <div @click="store.create('conditionGroups')" v-if="allowed('conditionGroups')">
            <img class="pr-4px" src="assets/bsicons/conditionGroup.png" />
            Condition Group
          </div>
          <div @click="store.create('repeats')" v-if="allowed('repeats')">
            <img class="pr-4px" src="assets/bsicons/repeat.png" />
            Repeat
          </div>
          <Separator v-if="allowed(['conditions', 'conditionGroups', 'repeats'])" />
          <div @click="store.create('constraints')" v-if="allowed('constraints')">
            <img class="pr-4px" src="assets/bsicons/constraint.png" />
            Constraint
          </div>
          <div @click="store.create('modifiers')" v-if="allowed('modifiers')">
            <img class="pr-4px" src="assets/bsicons/modifier.png" />
            Modifier
          </div>
          <div @click="store.create('modifierGroups')" v-if="allowed('modifierGroups')">
            <img class="pr-4px" src="assets/bsicons/modifierGroup.png" />
            Modifier Group
          </div>
          <Separator v-if="allowed(['constraints', 'modifiers', 'modifierGroups'])" />
        </template>

        <div @click="store.cut" v-if="!payload">Cut<span class="gray absolute right-5px">Ctrl+X</span> </div>
        <div @click="store.copy" v-if="!payload">Copy<span class="gray absolute right-5px">Ctrl+C</span> </div>
        <div @click="store.paste">Paste<span class="gray absolute right-5px">Ctrl+V</span> </div>
        <div @click="store.duplicate" v-if="!payload">Duplicate<span class="gray absolute right-5px">Ctrl+D</span></div>

        <template v-if="!payload && store.get_move_targets(item)?.length">
          <div @mouseover="nestedcontextmenu.show">
            <span> Move To </span>
            <span class="absolute right-5px">❯</span>
          </div>
          <ContextMenu ref="nestedcontextmenu">
            <div v-for="target of store.get_move_targets(item)" @click="store.move(item, catalogue, target)">
              {{ target.name }}
            </div>
          </ContextMenu>
        </template>
        <Separator v-if="!payload" />
        <div @click="store.remove()" v-if="!payload">
          <img class="w-12px pr-4px" src="assets/icons/redcross.png" />Remove<span class="gray absolute right-5px"
            >Del</span
          >
        </div>
      </template>
    </ContextMenu>
  </div>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { CatalogueEntryItem } from "@/stores/editorState";
import { useEditorStore } from "~/stores/editorState";
import {
  ItemKeys,
  ItemTypes,
  getName,
  getTypeLabel,
  getTypeName,
  categories,
  possibleChildren,
  getNameExtra,
} from "~/assets/shared/battlescribe/bs_editor";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { Link } from "~/assets/shared/battlescribe/bs_main";
import { sortByAscending, sortByDescending } from "~/assets/shared/battlescribe/bs_helpers";
import { escapeXml } from "~/assets/shared/battlescribe/bs_export_xml";
import ContextMenu from "~/components/dialog/ContextMenu.vue";

const order: Record<string, number> = {
  selectionEntry: 1,
  entryLink: 1,
  selectionEntryGroup: 2,
  entryGroupLink: 2,
  constraint: 3,
  forceEntry: 4,
  profile: 5,
  modifier: 6,
  modifierGroup: 7,
  categoryLink: 8,
  infoLink: 9,
};
export default {
  components: {
    ContextMenu,
  },
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
    showImported: {
      type: Boolean,
    },
    imported: {
      type: Boolean,
    },
  },
  data() {
    return {
      groups: {} as Record<string, any>,
      contextmenuopen: false,
    };
  },
  methods: {
    escapeXml,
    getTypeName,
    getTypeLabel,
    getName,
    getNameExtra,
    get_group(key: string) {
      if (!(key in this.groups)) {
        this.groups[key] = [];
      }
      return this.groups[key];
    },
    debug() {
      console.log(this.item.name, this.item.editorTypeName, toRaw(this.item));
      console.log("component", this);
      console.log(this.mixedChildren.length, "childs");

      const local_mixedChildren = () => {
        const res = [];
        for (const cat of possibleChildren) {
          const sub = (this.item as any)[cat] as Array<EditorBase & ItemTypes>;
          if (!sub?.length) continue;
          for (const elt of sub) {
            if (!this.filter_child(elt)) continue;
            res.push({ type: cat, item: elt });
          }
        }
        return this.sorted(res);
      };
      console.log(local_mixedChildren().length, "actual childs");
    },
    getTypedArray(item: Catalogue, type: ItemKeys, output: CatalogueEntryItem[]) {
      if (!type) return;
      const key = type as keyof Catalogue;
      const found = item[key];
      if (found && Array.isArray(found)) {
        for (const child of found) {
          if (!this.filter_child(child as EditorBase)) continue;
          // if (child === null) debugger;
          output.push({ item: child as ItemTypes & EditorBase, type });
        }
      }
      if (this.showImported) {
        for (const catalogue of item.importRootEntries) {
          const found = catalogue[key];
          if (found && Array.isArray(found)) {
            for (const child of found) {
              if (!this.filter_child(child as EditorBase)) continue;
              output.push({ item: child as ItemTypes & EditorBase, type, imported: true });
            }
          }
        }
      }
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

    sorted(items: CatalogueEntryItem[]) {
      const a = sortByAscending(items, (o) => o.item.getName() || "");
      return sortByDescending(a, (o) => order[o.item.editorTypeName] || 1000);
    },

    menu(ref: string) {
      return {
        show: (event: MouseEvent, o: any) => {
          this.contextmenuopen = true;
          this.$nextTick(() => {
            (this.$refs[ref] as any)?.show(event, o);
          });
        },
        close: (event: MouseEvent, o: any) => {
          (this.$refs[ref] as any)?.se(event, o);
          this.contextmenuopen = false;
        },
      };
    },
    get_field(field: string) {
      return (this.item as any)[field];
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
      return this.menu("contextmenu");
    },
    nestedcontextmenu() {
      return this.menu("nestedcontextmenu");
    },
    catalogue() {
      return this.item.isCatalogue() ? this.item : this.item.catalogue;
    },
    catalogues() {
      return this.catalogue.imports;
    },

    allowedChildren() {
      return this.store.allowed_children(this.item, this.item.parentKey) || new Set();
    },
    forceShow() {
      return this.item.showChildsInEditor || this.forceShowRecursive;
    },

    mixedChildren(): Array<CatalogueEntryItem> {
      const res = [];
      this.reactivityKey;
      for (const cat of this.allowedChildren) {
        const sub = this.get_field(cat);
        if (!sub?.length) continue;
        for (const elt of sub) {
          if (!this.filter_child(elt)) continue;
          res.push({ type: cat as ItemKeys, item: elt });
        }
      }
      return this.sorted(res);
    },
    groupedCategories() {
      this.reactivityKey;
      return categories.map((o) => {
        const items = [] as CatalogueEntryItem[];
        if (o.type) this.getTypedArray(this.item as any, o.type, items);
        if (o.links) this.getTypedArray(this.item as any, o.links, items);
        return {
          ...o,
          items,
        };
      });
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";
.imported {
  color: gray;
  font-style: italic;
}
</style>
