import { VueElement } from "nuxt/dist/app/compat/capi";
import { defineStore } from "pinia";
import { Base, Link } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import {
  BSICondition,
  BSIConditionGroup,
  BSIConstraint,
  BSIModifier,
  BSIModifierGroup,
} from "~/assets/shared/battlescribe/bs_types";

export type ItemTypes = (
  | Base
  | Link
  | Catalogue
  | BSIModifier
  | BSIModifierGroup
  | BSICondition
  | BSIConditionGroup
  | BSIConstraint
) & {
  parentKey: ItemKeys;
  typeName: string;
};

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
  | "categoryLinks"

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

  // Constraints and modifiers
  | "constraints"
  | "conditions"
  | "modifiers"
  | "modifierGroups"
  | "repeats"
  | "conditionGroups";

export interface IEditorState {
  selectionsParent?: Object | null;
  selections: { obj: any; onunselected: () => unknown }[];
  selectedElementGroup: any | null;
  selectedElement: any | null;
  selectedItem: any | null;
  icons: Record<ItemKeys, string>;
  categories: Array<{ name: string; type: ItemKeys; links?: ItemKeys }>;
  possibleChildren: Array<ItemKeys>;
  filter: string;
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
    possibleChildren: [
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
    ],
    categories: [
      {
        type: "catalogueLinks",
        name: "Catalogue Links",
      },
      {
        type: "publications",
        name: "Publications",
      },
      {
        type: "costTypes",
        name: "Cost Types",
      },
      {
        type: "profileTypes",
        name: "Profile Types",
      },
      {
        type: "categoryEntries",
        name: "Category Entries",
      },
      {
        type: "forceEntries",
        name: "Force Entries",
      },
      {
        type: "sharedSelectionEntries",
        name: "Shared Selection Entries",
      },
      {
        type: "sharedSelectionEntryGroups",
        name: "Shared Selection Entry Groups",
      },
      {
        type: "sharedProfiles",
        name: "Shared Profiles",
      },
      {
        type: "sharedRules",
        name: "Shared Rules",
      },
      {
        type: "infoGroups",
        name: "Shared Info Groups",
      },
      {
        type: "selectionEntries",
        links: "entryLinks",
        name: "Root Selection Entries",
      },
      {
        type: "rules",
        name: "Root Rules",
      },
    ],
    icons: {
      sharedSelectionEntries: "shared_selections.png",
      selectionEntryGroups: "entrygroups",
      sharedSelectionEntryGroups: "shared_groups.png",
      entryLinks: "shared_selections.png",
      sharedEntryLinks: "shared_selections.png",
      forceEntries: "forces.png",
      categoryEntries: "categories.png",
      categoryLinks: "categories.png",
      selectionEntries: "entry.png",

      catalogue: "catalogue.png",
      catalogueLinks: "catalogue_links.png",
      publications: "publications.png",
      costTypes: "costs.png",
      profileTypes: "profiles.png",
      sharedProfiles: "shared_profiles.png",
      sharedRules: "shared_rules.png",

      // Modifiable
      infoLinks: "infogroups.png",
      profiles: "profiles.png",
      rules: "rules.png",
      infoGroups: "infogroups.png",

      // Constraints and modifiers
      constraints: "constraint.png",
      conditions: "",
      modifiers: "modifier.png",
      modifierGroups: "",
      repeats: "",
      conditionGroups: "",
    },
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
  },
});
