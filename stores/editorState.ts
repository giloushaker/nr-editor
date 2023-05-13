import { VueElement } from "nuxt/dist/app/compat/capi";
import { defineStore } from "pinia";
import {
  ItemTypeNames,
  ItemKeys,
  ItemTypes,
} from "~/assets/shared/battlescribe/bs_editor";

const possibleChildren: ItemKeys[] = [
  // Catalogue stuff
  "catalogueLinks",
  "publications",
  "costTypes",
  "profileTypes",
  "sharedProfiles",
  "sharedRules",

  // Modifiable
  "infoLinks",
  "profiles",
  "rules",
  "infoGroups",

  // Children
  "categoryEntries",
  "categoryLinks",
  "forceEntries",
  "selectionEntries",
  "selectionEntryGroups",
  "entryLinks",

  // Constraints and modifiers
  "constraints",
  "conditions",
  "modifiers",
  "modifierGroups",
  "repeats",
  "conditionGroups",
];
const categories: CategoryEntry[] = [
  {
    type: "catalogueLinks",
    name: "Catalogue Links",
    icon: "catalogueLink.png",
  },
  {
    type: "publications",
    name: "Publications",
    icon: "publication.png",
  },
  {
    type: "costTypes",
    name: "Cost Types",
    icon: "cost.png",
  },
  {
    type: "profileTypes",
    name: "Profile Types",
    icon: "profileType.png",
  },
  {
    type: "categoryEntries",
    name: "Category Entries",
    icon: "category.png",
  },
  {
    type: "forceEntries",
    name: "Force Entries",
    icon: "force.png",
  },
  {
    type: "sharedSelectionEntries",
    name: "Shared Selection Entries",
    icon: "entryLink.png",
  },
  {
    type: "sharedSelectionEntryGroups",
    name: "Shared Selection Entry Groups",
    icon: "shared_groups.png",
  },
  {
    type: "sharedProfiles",
    name: "Shared Profiles",
    icon: "shared_profiles.png",
  },
  {
    type: "sharedRules",
    name: "Shared Rules",
    icon: "shared_rules.png",
  },
  {
    type: "infoGroups",
    name: "Shared Info Groups",
    icon: "infoGroup.png",
  },
  {
    type: "selectionEntries",
    links: "entryLinks",
    name: "Root Selection Entries",
    icon: "selectionEntry.png",
  },
  {
    type: "rules",
    name: "Root Rules",
    icon: "rule.png",
  },
];
export interface IEditorState {
  selectionsParent?: Object | null;
  selections: { obj: any; onunselected: () => unknown }[];
  selectedElementGroup: any | null;
  selectedElement: any | null;
  selectedItem: any | null;
  categories: Array<CategoryEntry>;
  possibleChildren: Array<ItemKeys>;
  filter: string;
}
export interface CategoryEntry {
  name: string;
  type: ItemKeys;
  links?: ItemKeys;
  icon: string;
}
export interface CatalogueEntryItem {
  item: ItemTypes;
  type: ItemKeys;
}

export const useEditorStore = defineStore("editor", {
  state: (): IEditorState => ({
    selections: [],
    selectedElementGroup: null,
    selectedElement: null,
    selectedItem: null,
    filter: "",
    possibleChildren,
    categories: categories,
  }),

  actions: {
    unselect(obj?: any) {
      const next_selected = [];
      const next_unselected = [];
      for (const selection of this.selections) {
        if (obj === undefined || toRaw(selection.obj) === toRaw(obj)) {
          next_unselected.push(selection);
        } else {
          next_selected.push(selection);
        }
      }
      this.selections = next_selected;
      for (const unselected of next_unselected) {
        if (unselected.onunselected) {
          unselected.onunselected();
        }
      }
    },
    select(obj: any, onunselected: () => unknown) {
      if (!this.selections.includes(obj)) {
        this.selections.push({ obj, onunselected });
      }
    },
    is_selected(obj: any) {
      return this.selections.findIndex((o) => o.obj === obj) !== -1;
    },
    do_select(e: MouseEvent, el: VueElement, group: VueElement | VueElement[]) {
      const entries = Array.isArray(group) ? group : [group];
      const last = toRaw(this.selectedElementGroup);
      const last_element = toRaw(this.selectedElement);
      this.selectedElement = toRaw(el);
      this.selectedElementGroup = toRaw(group);

      if (e.shiftKey && toRaw(group) === toRaw(last)) {
        const a = entries.findIndex((o) => o === last_element);
        const b = entries.findIndex((o) => o === this.selectedElement);
        const low = Math.min(a, b);
        const high = Math.max(a, b);
        for (let i = low; i <= high; i++) {
          const entry: any = entries[i];
          entry.select();
        }
        return;
      }
      if (!e.ctrlKey && !e.metaKey) {
        this.unselect();
      }
      if (e.ctrlKey && this.is_selected(el)) {
        this.unselect(el);
      } else {
        (el as any).select();
        this.selectedItem = el;
      }
    },
    do_rightclick_select(
      e: MouseEvent,
      el: VueElement,
      group: VueElement | VueElement[]
    ) {
      if (this.is_selected(el)) return;
      this.do_select(e, el, group);
    },
  },
});
