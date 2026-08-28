<template>
  <div class="item unselectable" @click.middle.stop="debug" @contextmenu.stop="contextmenu.show">
    <template v-if="item.editorTypeName === 'catalogue' || item.editorTypeName === 'gameSystem'">
      <div class="head">
        <EditorCollapsibleBox :depth="0" :payload="catalogue" nobox :collapsible="false">
          <template #title
            ><img src="/assets/bsicons/catalogue.png" />
            {{ catalogue.name }}
            <span v-if="getNameExtra(catalogue)" class="gray">&nbsp;{{ getNameExtra(catalogue) }} </span>
          </template>
          <template #content></template>
        </EditorCollapsibleBox>
      </div>

      <template v-for="category of groupedCategories" :key="category.type">
        <EditorCollapsibleBox
          :depth="depth"
          :altclickable="store.can_follow(item) || imported"
          @altclick="onctrlclick"
          :collapsible="category.items.length > 0"
          :payload="category.type"
          @contextmenu.stop="contextmenu.show($event, category.type)"
          :class="[category.type, category.links, `depth-${depth}`]"
          nobox
          :defcollapsed="!should_be_open(category.type)"
          @open="remember_open(true, category.type)"
          @close="remember_open(false, category.type)"
        >
          <template #title>
            <span>
              <span class="typeIcon-wrapper">
                <img class="typeIcon" :src="`assets/bsicons/${category.icon}`" />
              </span>
              {{ category.name }}
            </span>
          </template>
          <template #content>
            <template v-if="should_be_grouped(category.type)">
              <template v-for="{ label, type, items } of display_groups(category.type, category.items)">
                <CatalogueLabel :label="label" :depth="depth + 1" :catalogue="catalogue" :typeItem="type">
                  <template v-for="entry of items" :key="key(entry.item)">
                    <CatalogueEntry
                      :item="entry.item"
                      :forceShowRecursive="forceShow"
                      :imported="entry.imported"
                      :depth="depth + 2"
                      noType
                      grouped
                    />
                  </template>
                </CatalogueLabel>
              </template>
            </template>
            <template v-else>
              <template v-for="entry of category.items" :key="key(entry.item)">
                <CatalogueEntry
                  :item="entry.item"
                  :forceShowRecursive="forceShow"
                  :imported="entry.imported"
                  :depth="depth + 1"
                />
              </template>
            </template>
          </template>
        </EditorCollapsibleBox>
      </template>
    </template>
    <template v-else>
      <EditorCollapsibleBox
        :depth="depth"
        :altclickable="store.can_follow(item) || imported"
        @altclick="onctrlclick"
        :collapsible="mixedChildren && mixedChildren.length > 0"
        :empty="!mixedChildren || mixedChildren.length == 0"
        :payload="item"
        :class="[item.parentKey, `depth-${depth}`]"
        :defcollapsed="!open"
        nobox
        @open="remember_open(true)"
        @close="remember_open(false)"
      >
        <template #title>
          <CatalogueLeftPanelEntry :item="item" :imported="imported" :highlight="item.highlight" :grouped="grouped" />
          <!-- 

            <span>
              <span class="typeIcon-wrapper">
                <img class="typeIcon" :src="`assets/bsicons/${item.editorTypeName}.png`" />
              </span>
              <span v-if="primary" class="text-orange">{{ primary }}</span>
              <ErrorIcon :errors="item.errors" />
              <span v-if="item.sortIndex" class="gray">[{{ item.sortIndex }}]&nbsp;</span>
              <span :class="{ imported: imported, filtered: item.highlight }">
                {{ name }}
              </span>
              <span v-if="getNameExtra(item, true, !noType)" class="gray">&nbsp;{{ getNameExtra(item, true, !noType) }}
              </span>
              <span class="ml-10px" v-if="costs" v-html="costs" />
          </span>
            -->
        </template>
        <template #content>
          <CatalogueEntry
            v-for="child of mixedChildren"
            :key="key(child.item)"
            :item="child.item"
            :forceShowRecursive="forceShow"
            :imported="imported || child.imported"
            :depth="depth + 1"
          />
        </template>
      </EditorCollapsibleBox>
    </template>

    <ContextMenu v-if="contextmenuopen" v-model="contextmenuopen" ref="contextmenu">
      <template #default="{ payload }">
        <ContextMenuItems :groups="buildMenu(payload)" />
      </template>
    </ContextMenu>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import type { CatalogueEntryItem } from "@/stores/editorStore";
import { useEditorStore } from "~/stores/editorStore";
import {
  type ItemTypes,
  getName,
  getTypeLabel,
  getTypeName,
  systemCategories,
  catalogueCategories,
  getNameExtra,
  getEntryPath,
  type ItemKeys,
} from "~/assets/editor/bs_editor";
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { Base, Condition, Link, ProfileType } from "~/assets/shared/battlescribe/bs_main";
import {
  generateBattlescribeId,
  sortByAscending,
  sortByDescending,
  escapeXml,
  groupBy,
  addObj,
  sortByAscendingInplace,
} from "~/assets/shared/battlescribe/bs_helpers";

import { useEditorUIState } from "~/stores/editorUIState";
import { useSettingsStore } from "~/stores/settingsState";
import { allowed_children } from "~/assets/shared/battlescribe/bs_convert";
import { getModifiedField, modifiersOrder } from "~/assets/shared/battlescribe/bs_modifiers";
import type { BSIModifier } from "~/assets/shared/battlescribe/bs_types";

import ContextMenu from "~/components/dialog/ContextMenu.vue";
import ContextMenuItems from "~/components/dialog/ContextMenuItems.vue";
import type { MenuItem } from "~/components/dialog/menu";
import { buildEntryMenu } from "./entry_menu";
import CatalogueLabel from "~/components/catalogue/left_panel/components/CatalogueLabel.vue";
import EditorCollapsibleBox from "~/components/catalogue/left_panel/components/EditorCollapsibleBox.vue";
import { entries, types } from "~/assets/shared/battlescribe/entries";
export interface ICost {
  name: string;
  value: number;
  typeId: string;
}
function round(num: number): number {
  return Math.round(num * 100) / 100;
}
export function formatCosts(costs: ICost[]): string {
  let res = "";
  costs = sortByDescending(costs, (c) => c.name);
  for (const cost of costs) {
    if (cost.value != 0) {
      let name = "";
      if (cost.name.length != 0) {
        name = " " + cost.name;
      }
      res = `${res}<span class='cost'>${round(cost.value)}${name}</span>`;
    }
  }
  if (res.length == 0) {
    return res;
  }
  return `<span class="costList">${res}</span>`;
}
/** Tree display metadata lives with the node definitions in entries.ts. */
function typeMeta(type: string): { sortOrder?: number; noSort?: boolean } {
  return (types as Record<string, { sortOrder?: number; noSort?: boolean }>)[type] ?? {};
}
function entryMeta(key: string): { hiddenInTree?: boolean; preferOpen?: boolean } {
  return (entries as Record<string, { hiddenInTree?: boolean; preferOpen?: boolean }>)[key] ?? {};
}
export default {
  name: "CatalogueEntry",
  components: {
    ContextMenu,
    ContextMenuItems,
    EditorCollapsibleBox,
    CatalogueLabel,
  },
  setup() {
    return { store: useEditorStore(), state: useEditorUIState(), settings: useSettingsStore() };
  },
  props: {
    item: {
      type: Object as PropType<EditorBase>,
      required: true,
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
    depth: {
      type: Number,
      default: 0,
    },
    noType: {
      type: Boolean,
      default: false,
    },
    grouped: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      contextmenuopen: false,
      open: false,
      open_categories: undefined as Set<string> | undefined,
      name: "",
    };
  },
  created() {
    if (this.catalogue) {
      this.catalogue.processForEditor();
      if (!this.imported) {
        this.open = this.should_be_open();
        if (this.item.isCatalogue()) {
          const openCategories = new Set<string>();
          for (const category of this.categories) {
            if (this.state.get_root(this.catalogue.id, category.type)) {
              openCategories.add(category.type);
            }
          }
          this.open_categories = openCategories;
        }
      }
    }
  },
  watch: {
    "scope.name"(_new) {
      this.name = getName(this.item);
    },
    _name: {
      immediate: true,
      handler(_new) {
        this.name = _new;
      },
    },
  },
  methods: {
    escapeXml,
    getTypeName,
    getTypeLabel,
    getName,
    getNameExtra,
    key(entry: EditorBase | any): string {
      if (entry.id) {
        return entry.id;
      } else if (entry["$id"]) {
        return entry["$id"];
      } else {
        entry["$id"] = `temp-${generateBattlescribeId()}`;
        return entry["$id"];
      }
    },
    should_be_grouped(category: string) {
      return category === "sharedProfiles";
    },
    display_groups(category: string, items: CatalogueEntryItem[]) {
      const result = [];
      for (const [id, group] of Object.entries(groupBy(items, (o) => o.item.typeId ?? "Untyped"))) {
        const type = group[0].item.catalogue.findOptionById(id) as EditorBase;
        const label = type?.name ?? id;
        result.push({ type, label, items: group });
      }
      return result;
    },
    should_be_open(category?: string): boolean {
      if (category) {
        return this.open_categories !== undefined && this.open_categories.has(category);
      }
      return entryMeta(this.item.parentKey).preferOpen || this.state.get(this.catalogue.id, getEntryPath(this.item));
    },
    /**
     * Write side of should_be_open. Imported entries belong to another catalogue, so their
     * paths would be meaningless under this one -- created() skips reading them for the same
     * reason.
     */
    remember_open(open: boolean, category?: string) {
      if (this.imported || !this.catalogue) return;
      if (category) this.state.set_root_open(this.catalogue.id, category, open);
      else this.state.set_open(this.catalogue.id, getEntryPath(this.item), open);
    },
    sortable(entry?: EditorBase) {
      if (this.settings.sort === "none") return false;
      if (!entry) return true;
      if (typeMeta(entry.editorTypeName).noSort) {
        return false;
      }
      return true;
    },
    ref_count(item: EditorBase) {
      return item.refs?.length;
    },
    async onctrlclick() {
      if (this.store.can_follow(this.item)) {
        await this.store.follow(this.item as EditorBase & Link);
      } else if (this.imported) {
        await this.store.goto(this.item);
      } else if (this.item.refs || this.item.other_refs) {
        this.store.mode = "references";
      }
    },
    debug() {
      console.log(this.item.name, this.item.editorTypeName, toRaw(this.item));
      (globalThis as any).$debugOption = this.item;
      (globalThis as any).$debugElement = this;
      (globalThis as any).$debugGroup = this.$parent;
    },
    getTypedArray(item: Catalogue, type: ItemKeys, output: CatalogueEntryItem[]) {
      if (!type) return;
      const key = type as keyof Catalogue;
      const found = item[key];
      if (found && Array.isArray(found)) {
        for (const child of found) {
          if (!this.filter_child(child as EditorBase)) continue;
          output.push({ item: child as ItemTypes & EditorBase, type });
        }
      }
      if (this.showImported) {
        const useRoot = ["selectionEntries", "selectionEntryLinks", "rules"];
        const imports = useRoot.includes(type) ? item.importsWithEntries : item.imports;
        for (const catalogue of imports) {
          const found = catalogue[key];
          const system = catalogue.isGameSystem();
          if (found && Array.isArray(found)) {
            for (const child of found) {
              if (!this.filter_child(child as EditorBase)) continue;
              if (!system && (child as EditorBase).import === false) continue;
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
      if (!this.sortable(this.item)) {
        return items;
      }
      switch (this.settings.sort) {
        default:
        case "asc":
          const asc = sortByAscending(items, (o) => o.item.getName() || "");
          return asc;
        case "desc":
          const desc = sortByDescending(items, (o) => o.item.getName() || "");
          return desc;
        case "type":
          const type_asc = sortByAscending(items, (o) => o.item.getName() || "");
          sortByAscendingInplace(type_asc, (o) => (o.item.isProfile() ? o.item.getTypeName() : o.item.getType()) || "");
          if (this.settings.display.primaryCategory) {
            sortByAscendingInplace(type_asc, (o) => {
              const item = o.item;
              if (item.parent?.isCatalogue() && ["selectionEntries", "entryLinks"].includes(item.parentKey)) {
                return o.item.getPrimaryCategoryLink()?.target?.name || "";
              }
              return "";
            });
          }
          return type_asc;
      }
    },
    grouped_items(items: CatalogueEntryItem[]) {
      // modifiers run in type order rather than the order they are listed, so show them the way they apply.
      // sortable() is false when the user picked sort "none", which is also the only mode offering move
      // up/down, so that view keeps raw array order and stays consistent with reordering.
      const ordered = this.sortable(this.item)
        ? sortByAscending(this.sorted(items), (o) =>
            o.item.editorTypeName === "modifier" ? (modifiersOrder[(o.item as unknown as BSIModifier).type] ?? 0) : 0,
          )
        : this.sorted(items);
      const result = sortByAscending(
        ordered,
        (o) => typeMeta((o.item?.target as EditorBase)?.editorTypeName ?? o.item.editorTypeName).sortOrder ?? 1000,
      );
      if (this.settings.display.sortIndex) {
        sortByAscendingInplace(result, (o) => o.item.sortIndex ?? 10000);
      }
      return result;
    },
    groupBy,

    menu(ref: string) {
      return {
        show: (event: MouseEvent, e: any) => {
          this.contextmenuopen = true;
          this.$nextTick(() => {
            (this.$refs[ref] as any)?.show(event, e);
          });
        },
        close: (event: MouseEvent, e: any) => {
          (this.$refs[ref] as any)?.close(event, e);
          this.contextmenuopen = false;
        },
      };
    },
    get_field(field: string) {
      return (this.item as any)[field];
    },
    get_target_field(field: string) {
      if (this.item.target) {
        return (this.item.target as any)[field];
      }
    },
    /** See entry_menu.ts; this component supplies the context that builds it. */
    buildMenu(payload?: ItemKeys): MenuItem[][] {
      return buildEntryMenu(this, payload);
    },
    hideType(type: string) {
      if (type === "categoryLinks" && !this.item.isForce()) return true;
      if (entryMeta(type).hiddenInTree) return true;
    },
  },

  computed: {
    scope() {
      const _item = this.item as Condition & EditorBase;
      if (_item.scope) {
        const result = getModifiedField(_item, _item.scope);
        if (result) {
          return reactive(result);
        }
      }
    },
    costs() {
      const result = [] as ICost[];
      const catalogue = this.item.getCatalogue();
      const costs = this.item.getCosts();
      for (const cost of costs) {
        const name = catalogue.findOptionById(cost.typeId)?.name || cost.name || cost.typeId;
        if (name) {
          result.push({
            name: name,
            value: cost.value,
            typeId: cost.typeId,
          });
        }
      }
      return formatCosts(result);
    },
    profileTypes() {
      return [...this.catalogue.iterateProfileTypes()];
    },
    childId(): string | undefined {
      return (this.item as any as Condition).childId;
    },
    child() {
      if (!this.childId) return undefined;
      return this.item.getCatalogue().findOptionById(this.childId) as EditorBase;
    },
    link(): Link & EditorBase {
      return this.item as Link & EditorBase;
    },
    iscollapsible() {
      return this.mixedChildren.length > 0;
    },
    contextmenu() {
      return this.menu("contextmenu");
    },
    /** Menu entries contributed by scripts. Computed once instead of per template read. */
    scriptActions() {
      return this.store.get_context_actions();
    },
    catalogue() {
      return this.item.getCatalogue() as Catalogue & EditorBase;
    },
    catalogues() {
      return this.catalogue.imports;
    },

    allowedChildren() {
      return allowed_children(this.item, this.item.parentKey);
    },
    forceShow() {
      return this.item.showChildsInEditor || this.forceShowRecursive;
    },

    mixedChildren(): Array<CatalogueEntryItem> {
      const childs = [];
      for (const category of this.allowedChildren) {
        if (this.hideType(category)) continue;

        const arr = this.get_field(category);
        if (arr?.length) {
          for (const elt of arr) {
            if (!this.filter_child(elt)) continue;
            childs.push({ type: category as ItemKeys, item: elt });
          }
        }
      }

      if (this.item.isLink() && this.item.target) {
        const targetChilds = [];
        for (const category of this.allowedChildren) {
          if (this.hideType(category)) continue;

          const target_arr = this.get_target_field(category);
          if (target_arr?.length) {
            for (const elt of target_arr) {
              if (!this.filter_child(elt)) continue;
              targetChilds.push({ type: category as ItemKeys, item: elt, imported: true });
            }
          }
        }
        return [...this.grouped_items(targetChilds), ...this.grouped_items(childs)];
      }
      return this.grouped_items(childs);
    },
    categories() {
      if (this.item.isCatalogue()) {
        const categories = this.item.isGameSystem() ? systemCategories : catalogueCategories;
        return categories;
      }
      return [];
    },
    groupedCategories() {
      return this.categories.map((category) => {
        const items = [] as CatalogueEntryItem[];
        if (category.type) this.getTypedArray(this.item as any, category.type, items);
        if (category.links) this.getTypedArray(this.item as any, category.links, items);
        return {
          ...category,
          items: this.grouped_items(items),
        };
      });
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.imported {
  color: rgb(128, 145, 183);
  // font-style: italic;
}

.filtered {
  background-color: rgba(10, 80, 255, 0.15);
}

.typeIcon {
  max-width: 18px;
  vertical-align: middle;
}

.typeIcon-wrapper {
  display: inline-block;
  min-width: 20px;
  min-height: 1px;
}

.head {
  margin-left: -20px;
}

.text-orange {
  color: rgb(153 31 31);
}

.right {
  margin-left: auto;
  float: right;
  padding-left: 5px;
}
</style>
