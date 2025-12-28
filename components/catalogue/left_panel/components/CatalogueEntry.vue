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
          :path="[{ key: category.type, index: 0 }]"
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
        <template v-if="!payload && item">
          <div v-if="store.can_follow(item)" @click="store.follow(link)">
            Follow
            <span class="gray" v-if="link.target.getCatalogue() !== item.getCatalogue()">
              &nbsp;[{{ link.target.getCatalogue()?.getName() || link.target.getName() }}]
            </span>
            <span class="gray right">Alt+Click</span>
          </div>
          <div v-if="imported" @click="store.goto(item)">
            Goto
            <span class="gray"> &nbsp;({{ item.getCatalogue()?.getName() }}) </span>
            <span class="gray right">Alt+Click</span>
          </div>
          <div
            v-if="item.isProfile() && item.typeId && item.getCatalogue().findOptionById(item.typeId)"
            @click="store.goto(item.getCatalogue().findOptionById(item.typeId) as EditorBase & ProfileType)"
          >
            Goto {{ item.typeName }}
            <span class="gray">
              &nbsp;[{{ item.getCatalogue().findOptionById(item.typeId)!.getCatalogue().getName() }}]
            </span>
            <span class="gray right">Alt+Click</span>
          </div>
          <div v-if="child && store.can_goto(child)" @click="store.goto(child)">
            Goto {{ child.getName() }}
            <span class="gray" v-if="item.getCatalogue() !== child.getCatalogue()">
              &nbsp;[{{ child.getCatalogue().getName() }}]
            </span>
            <span class="gray right">Alt+Click</span>
          </div>
          <div v-if="(item.refs?.length ?? 0) + (item.other_refs?.length ?? 0)" @click="store.mode = 'references'">
            References ({{ (item.refs?.length ?? 0) + (item.other_refs?.length ?? 0) }})
          </div>
          <div v-if="store.filter && !item.showChildsInEditor" @click="store.toggle_selections">
            Show All Childs<span class="gray right">Space</span>
          </div>
          <Separator v-if="item.isLink() || item.refs || imported" />
        </template>
        <template v-if="payload">
          <div @click="store.create(payload)">
            <img class="pr-4px" :src="`assets/bsicons/${getTypeName(payload)}.png`" />
            {{ getTypeLabel(getTypeName(payload)) }}
          </div>
          <div @click="store.create('entryLinks', { type: 'selectionEntry' })" v-if="payload === 'selectionEntries'">
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
          <div @click="store.create('forceEntries')" v-if="allowed('forceEntries')">
            <img class="pr-4px" src="assets/bsicons/forceEntry.png" />
            Force
          </div>
          <div @click="store.create('categoryLinks')" v-if="allowed('categoryLinks') && item.isForce()">
            <img class="pr-4px" src="assets/bsicons/categoryEntryLink.png" />
            Category
          </div>
          <Separator v-if="allowed(['forces', 'categoryLinks'])" />
          <div @click="store.create('selectionEntries')" v-if="allowed('selectionEntries')">
            <img class="pr-4px" src="assets/bsicons/selectionEntry.png" />
            Entry
          </div>
          <div @click="store.create('selectionEntryGroups')" v-if="allowed('selectionEntryGroups')">
            <img class="pr-4px" src="assets/bsicons/selectionEntryGroup.png" />
            Group
          </div>
          <div
            @click="store.create('entryLinks', { type: 'selectionEntry' })"
            v-if="allowed(['entryLinks', 'infoLinks', 'forceEntryLinks'])"
          >
            <img class="pr-4px" src="assets/bsicons/link.png" />
            Link
            <span class="right">❯</span>
            <ContextMenu id="link_contextmenu">
              <template v-if="allowed('entryLinks')">
                <div @click="store.create('entryLinks', { type: 'selectionEntry' })">
                  <img class="pr-4px" src="assets/bsicons/selectionEntryLink.png" />
                  Entry
                </div>
                <div @click="store.create('entryLinks', { type: 'selectionEntryGroup' })">
                  <img class="pr-4px" src="assets/bsicons/selectionEntryGroupLink.png" />
                  Group
                </div>
              </template>
              <template v-if="allowed('infoLinks')">
                <div @click="store.create('infoLinks', { type: 'profile' })">
                  <img class="pr-4px" src="assets/bsicons/profileLink.png" />
                  Profile
                </div>
                <div @click="store.create('infoLinks', { type: 'rule' })">
                  <img class="pr-4px" src="assets/bsicons/ruleLink.png" />
                  Rule
                </div>
                <div @click="store.create('infoLinks', { type: 'infoGroup' })">
                  <img class="pr-4px" src="assets/bsicons/infoGroupLink.png" />
                  InfoGroup
                </div>
              </template>
              <template v-if="allowed('forceEntryLinks')">
                <div @click="store.create('forceEntryLinks')">
                  <img class="pr-4px" src="assets/bsicons/forceEntryLink.png" />
                  Force
                </div>
              </template>
            </ContextMenu>
          </div>
          <Separator v-if="allowed(['selectionEntries', 'selectionEntryGroups', 'entryLinks'])" />
          <div @click="store.create_child('profiles', item)" v-if="allowed('profiles')">
            <img class="pr-4px" src="assets/bsicons/profile.png" />
            Profile
            <template v-if="profileTypes.length">
              <span class="right">❯</span>
              <ContextMenu id="profile_contextmenu">
                <div
                  v-for="type of profileTypes"
                  @click="store.create_child('profiles', item, { typeId: type.id, typeName: type.name })"
                >
                  <img class="pr-4px" src="assets/bsicons/profile.png" />
                  <span>{{ type.getName() }}</span>
                  <span v-if="getNameExtra(type)" class="gray"> &nbsp;{{ getNameExtra(type, false) }}</span>
                </div>
              </ContextMenu>
            </template>
          </div>
          <div @click="store.create('rules')" v-if="allowed('rules')">
            <img class="pr-4px" src="assets/bsicons/rule.png" />
            Rule
          </div>
          <div @click="store.create('infoGroups')" v-if="allowed('infoGroups')">
            <img class="pr-4px" src="assets/bsicons/infoGroup.png" />
            Info Group
          </div>
          <div @click="store.create('associations')" v-if="allowed('associations')">
            <img class="pr-4px" src="assets/bsicons/association.png" />
            Association
          </div>
          <Separator v-if="allowed(['profiles', 'rules', 'infoGroups', 'infoLinks'])" />
          <div @click="store.create('characteristicTypes')" v-if="allowed('characteristicTypes')">
            <img class="pr-4px" src="assets/bsicons/characteristicType.png" />
            Characteristic Type
          </div>
          <div @click="store.create('attributeTypes')" v-if="allowed('attributeTypes')">
            <img class="pr-4px" src="assets/bsicons/attributeType.png" />
            Attribute Type
          </div>
          <Separator v-if="allowed(['attributeTypes', 'characteristicTypes'])" />
          <div @click="store.create('conditions')" v-if="allowed('conditions')">
            <img class="pr-4px" src="assets/bsicons/condition.png" />
            Condition
          </div>
          <div @click="store.create('conditionGroups')" v-if="allowed('conditionGroups')">
            <img class="pr-4px" src="assets/bsicons/conditionGroup.png" />
            Condition Group
          </div>
          <div @click="store.create('localConditionGroups')" v-if="allowed('localConditionGroups')">
            <img class="pr-4px" src="assets/bsicons/conditionGroup.png" />
            Local Condition Group
          </div>
          <div @click="store.create('repeats')" v-if="allowed('repeats')">
            <img class="pr-4px" src="assets/bsicons/repeat.png" />
            Repeat
          </div>
          <Separator v-if="allowed(['conditions', 'conditionGroups', 'repeats'])" />
          <div @click="store.create_child('constraints', item)" v-if="allowed('constraints')">
            <img class="pr-4px" src="assets/bsicons/constraint.png" />
            Constraint
          </div>
          <div @click="store.create('modifiers')" v-if="allowed('modifiers')">
            <img class="pr-4px" src="assets/bsicons/modifier.png" />
            Modifier
          </div>
          <div
            v-if="item.editorTypeName === 'constraint' && item.parent"
            @click="store.create_child('modifiers', item.parent, { field: item.id, value: 0 })"
          >
            <img class="pr-4px" src="assets/bsicons/modifier.png" />
            Modifier
          </div>
          <div @click="store.create('modifierGroups')" v-if="allowed('modifierGroups')">
            <img class="pr-4px" src="assets/bsicons/modifierGroup.png" />
            Modifier Group
          </div>
          <Separator
            v-if="allowed(['constraints', 'modifiers', 'modifierGroups']) || item.editorTypeName === 'constraint'"
          />
        </template>

        <div @click="store.cut" v-if="!payload">Cut<span class="gray right">Ctrl+X</span> </div>
        <div @click="store.copy" v-if="!payload">Copy<span class="gray right">Ctrl+C</span> </div>
        <div @click="store.paste">Paste<span class="gray right">Ctrl+V</span> </div>
        <div @click="store.duplicate" v-if="!payload">Duplicate<span class="gray right">Ctrl+D</span></div>

        <div v-if="!sortable(item.parent)" @click="store.move_up(item)">
          <span> Move Up </span>
          <span class="gray right">Alt+⭡</span>
        </div>
        <div v-if="!sortable(item.parent)" @click="store.move_down(item)">
          <span> Move Down </span>
          <span class="gray right">Alt+⭣</span>
        </div>
        <template v-if="!payload && store.get_move_targets(item)?.length">
          <div>
            <span> Move To </span>
            <span class="right">❯</span>
            <ContextMenu id="moveto_contextmenu">
              <div
                v-for="target of store.get_move_targets(item)"
                @click="store.move(item, catalogue, target.target, target.type)"
              >
                <img class="pr-4px" src="assets/bsicons/catalogue.png" />
                {{ target.target.name }} -
                {{ target.type }}
              </div>
            </ContextMenu>
          </div>
        </template>
        <template v-if="!payload && store.get_context_actions().length">
          <div>
            <span> Scripts </span>
            <span class="right">❯</span>
            <ContextMenu id="moveto_contextmenu">
              <div v-for="action of store.get_context_actions()">
                <img class="pr-4px" src="assets/icons/right2.png" />
                {{ action }}
              </div>
            </ContextMenu>
          </div>
        </template>
        <div
          @click="
            store.create_child('entryLinks', catalogue, {
              targetId: item.id,
              type: 'selectionEntry',
              name: item.getName(),
            })
          "
          v-if="item.parentKey === 'sharedSelectionEntries'"
        >
          Add Root Link<span class="gray" v-if="hasRootLink(catalogue, item)">&nbsp;(already has one)</span>
        </div>
        <Separator v-if="!payload" />
        <div @click="store.remove()" v-if="!payload">
          <img class="w-12px pr-4px" src="/assets/icons/redcross.png" />Remove<span class="gray right">Del</span>
        </div>
      </template>
    </ContextMenu>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import type { CatalogueEntryItem } from "@/stores/editorStore";
import { useEditorStore } from "~/stores/editorStore";
import {
  type ItemKeys,
  type ItemTypes,
  getName,
  getTypeLabel,
  getTypeName,
  systemCategories,
  catalogueCategories,
  getNameExtra,
  getEntryPath,
} from "~/assets/shared/battlescribe/bs_editor";
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
import { getModifiedField } from "~/assets/shared/battlescribe/bs_modifiers";

import ContextMenu from "~/components/dialog/ContextMenu.vue";
import CatalogueLabel from "~/components/catalogue/left_panel/components/CatalogueLabel.vue";
import EditorCollapsibleBox from "~/components/catalogue/left_panel/components/EditorCollapsibleBox.vue";
import { entries } from "~/assets/shared/battlescribe/entries";
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
const order: Record<string, number> = {
  link: 1,
  selectionEntry: 1,
  entryLink: 1,
  characteristicType: 1,
  attributeType: 2,
  selectionEntryGroup: 2,
  entryGroupLink: 2,
  constraint: 3,
  forceEntry: 4,
  forceEntryLink: 4,
  profile: 5,
  rule: 6,
  infoGroup: 7,
  infoLink: 8,
  modifier: 9,
  modifierGroup: 10,
  categoryLink: 11,
  association: 12,
};
const preferOpen = new Set(["modifierGroups", "conditionGroups", "localConditionGroups"]);
const hiddenTypes = new Set(["characteristics", "attributes", "costs"]);
const avoidSorting = new Set([
  "forceEntry",
  "profileType",
  "condition",
  "conditionGroup",
  "repeat",
  "localConditionGroup",
]);
export default {
  name: "CatalogueEntry",
  components: {
    ContextMenu,
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
      return preferOpen.has(this.item.parentKey) || this.state.get(this.catalogue.id, getEntryPath(this.item));
    },
    sortable(entry?: EditorBase) {
      if (this.settings.sort === "none") return false;
      if (!entry) return true;
      if (avoidSorting.has(entry.editorTypeName)) {
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
    hasRootLink(catalogue: Catalogue, item: Base) {
      return catalogue.entryLinks?.find((o) => o.targetId === item.id);
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
      const result = sortByAscending(
        this.sorted(items),
        (o) => order[(o.item?.target as EditorBase)?.editorTypeName ?? o.item.editorTypeName] ?? 1000
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
    hideType(type: string) {
      if (type === "categoryLinks" && !this.item.isForce()) return true;
      if (hiddenTypes.has(type)) return true;
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
