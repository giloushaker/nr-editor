<template>
  <fieldset>
    <legend>Query</legend>
    <div class="query">
      <UtilIconSelect
        v-model="itemField"
        :fetch="() => fieldTypes"
        @change="fieldChanged"
        class="modType"
        :disabled="instanceOf || association"
      >
        <template #option="opt">
          <div>
            <img class="mr-1 align-middle" :src="`assets/bsicons/${opt.option.type}.png`" />
            {{ opt.option.name }}
          </div>
        </template>
      </UtilIconSelect>

      <span> in </span>

      <UtilAutocomplete
        v-model="item.scope"
        :placeholder="`Search Scope...`"
        :options="allScopes"
        valueField="id"
        filterField="name"
        @change="scopeChanged"
        :disabled="itemField?.value?.startsWith('limit::')"
      >
        <template #option="opt">
          <div style="white-space: nowrap">
            <template v-if="opt.option.indent >= 2 && !opt.selected">
              <span v-for="n of opt.option.indent - 1">&nbsp;&nbsp;&nbsp;</span>
            </template>
            <img class="mr-1 align-middle" :src="`assets/bsicons/${opt.option.editorTypeName}.png`" />
            {{ opt.option.name }}
            <span class="gray">{{ getNameExtra(opt.option, false) }}</span>
            <span class="shared" v-if="opt.option.shared"> (shared)</span>
            <span class="catalogueName" v-if="showCatalogue(opt.option)"> [{{ opt.option.catalogue }}]</span>
          </div>
        </template>
      </UtilAutocomplete>

      <div class="checks" v-if="!costType">
        <div v-if="shared">
          <input @change="changed" id="shared" type="checkbox" v-model="item.shared" />
          <label for="shared" class="hastooltip" :title="sharedTooltip">Shared</label>
        </div>
        <div v-if="childSelections">
          <input @change="changed" id="childSelections" type="checkbox" v-model="item.includeChildSelections" />
          <label for="childSelections">And all child Selections</label>
        </div>
        <div v-if="childForces">
          <input @change="changed" id="childForces" type="checkbox" v-model="item.includeChildForces" />
          <label for="childForces">And all child Forces</label>
        </div>
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { getNameExtra } from "~/assets/shared/battlescribe/bs_editor";
import { Condition, Constraint } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase, getAllPossibleParents } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { getModifierOrConditionParent } from "~/assets/shared/battlescribe/bs_modifiers";
import { BSICondition, BSIConstraint, BSICostType } from "~/assets/shared/battlescribe/bs_types";
import {
  EditorSearchItem,
  getSearchCategories,
  getSearchElements,
  getParentUnitHierarchy,
  getParentScopes,
} from "~/assets/ts/catalogue/catalogue_helpers";
interface ScopeChoice {
  id: string;
  name: string;
  editorTypeName: string;
  title?: string;
}
export default {
  emits: ["catalogueChanged"],
  data() {
    return {
      itemField: null as any,
    };
  },
  props: {
    item: {
      type: Object as PropType<EditorBase & (BSIConstraint | BSICondition)>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    childForces: {
      type: Boolean,
      default: false,
    },
    childSelections: {
      type: Boolean,
      default: false,
    },
    shared: {
      type: Boolean,
      default: false,
    },
  },

  methods: {
    getNameExtra,
    changed() {
      this.$emit("catalogueChanged");
    },

    getProfilesInScope() {
      const profiles: {profile: any, entryName?: string}[] = [];
      const scope = this.item.scope;
      
      // Helper function to collect profiles from an entry and its selectionEntries recursively
      const collectProfilesFromEntry = (entry: any, entryName?: string, recurseChildren: boolean = false) => {
        if (!entry) return;
        
        // Collect profiles directly from this entry
        if (entry.profilesIterator) {
          for (const profile of entry.profilesIterator()) {
            profiles.push({ profile, entryName: entryName || entry.name });
          }
        } else if (entry.profiles) {
          // Fallback for direct profiles array access
          for (const profile of entry.profiles) {
            profiles.push({ profile, entryName: entryName || entry.name });
          }
        }
        
        // Only recursively collect profiles from selectionEntries if includeChildSelections is true
        if (recurseChildren) {
          if (entry.selectionEntriesIterator) {
            for (const selectionEntry of entry.selectionEntriesIterator()) {
              collectProfilesFromEntry(selectionEntry, selectionEntry.name, recurseChildren);
            }
          } else if (entry.selectionEntries) {
            // Fallback for direct selectionEntries array access
            for (const selectionEntry of entry.selectionEntries) {
              collectProfilesFromEntry(selectionEntry, selectionEntry.name, recurseChildren);
            }
          }
        }
      };

      // Start with the parent's profiles as fallback
      const parent = this.parent;
      
      if (scope === "self" || !scope) {
        // Self scope - use parent profiles and its children
        if (parent) {
          collectProfilesFromEntry(parent, parent.name === "self" ? undefined : parent.name, this.item.includeChildSelections);
        }
      } else if (scope === "parent") {
        // Parent scope
        if (parent?.parent) {
          collectProfilesFromEntry(parent.parent, parent.parent.name, this.item.includeChildSelections);
        }
      } else {
        // Try to find the scope by ID first
        const targetEntry = this.catalogue.findOptionById(scope);
        if (targetEntry) {
          collectProfilesFromEntry(targetEntry, targetEntry.name, this.item.includeChildSelections);
        } else if (["force", "roster", "primary-catalogue"].includes(scope)) {
          // For broader scopes, search through available selections
          const allAvailableEntries = [
            ...this.allSelections,
            ...this.allCategories,
            ...this.allForces
          ];
          
          for (const item of allAvailableEntries) {
            const entry = this.catalogue.findOptionById(item.id);
            if (entry) {
              collectProfilesFromEntry(entry, entry.name, this.item.includeChildSelections);
            }
          }
        }
        
        // If no profiles found in scope, fallback to parent
        if (profiles.length === 0 && parent) {
          collectProfilesFromEntry(parent, parent.name === "self" ? undefined : parent.name, this.item.includeChildSelections);
        }
      }

      console.log(`Profiles found in scope "${scope}":`, profiles.length);
      return profiles;
    },

    scopeChanged() {
      if (this.item.scope === "roster") {
        this.item.includeChildSelections = true;
        this.item.includeChildForces = true;
      }
      if (this.item.scope === "force") {
        this.item.includeChildSelections = true;
      }
      this.item.catalogue.updateCondition(this.item as EditorBase & (Condition | Constraint));
      this.changed();
    },
    fieldChanged() {
      this.item.field = this.itemField.value;
      if (this.item.field.startsWith("limit::") && this.item.editorTypeName !== "constraint") {
        this.item.childId = "any";
      }

      this.changed();
    },

    showCatalogue(opt: EditorSearchItem): boolean {
      if (!opt.catalogue) {
        return false;
      }
      if (opt.catalogue === this.item.catalogue?.getName()) {
        return false;
      }
      return true;
    },
  },

  computed: {
    association() {
      return this.item.editorTypeName == "association";
    },

    sharedTooltip() {
      if (this.item.editorTypeName !== "constraint") {
        return `Its recommended to keep shared checked on ${this.item.editorTypeName}s`;
      }
      return `Indicates that constraints on links should be evaluated as if they are on their target, usually only relevant if the scope is above "parent"

eg: a unit has a Leader and a Model which have a link to the same entry, with a max 1 constraint on the links scoped to the unit.
assuming both have selected 1 of that entry:
- a shared constraint would error as its evaluating the target of the links
- a non-shared constraint would not error as it would be evaluating the amount of the links themselves

note: shared=false on BS will also limit the constraint to it's parent rootSelectionEntry ID
`;
    },
    instanceOf() {
      return ["instanceOf", "notInstanceOf"].includes(this.item?.type);
    },
    parent() {
      return getModifierOrConditionParent(this.item as EditorBase);
    },
    costType() {
      return this.parent?.editorTypeName === "costType";
    },
    fieldTypes() {
      const res: {
        name: string;
        type: string | null;
        value: string | undefined;
      }[] = [];
      if (this.instanceOf) {
        res.push({
          name: "",
          value: undefined,
          type: null,
        });
      }
      res.push({
        name: "Selections",
        value: "selections",
        type: "bullet",
      });
      res.push({
        name: "Forces",
        value: "forces",
        type: "bullet",
      });
      // Add characteristics from profiles
      for (const charOption of this.availableCharacteristics) {
        res.push({
          name: charOption.name,
          value: charOption.id,
          type: "characteristic",
        });
      }
      for (const costType of this.costTypes) {
        res.push({
          name: costType.name,
          value: costType.id,
          type: "cost",
        });
        if (this.item.scope === "roster") {
          res.push({
            name: `${costType.name} Limit`,
            value: `limit::${costType.id}`,
            type: "cost",
          });
        }
      }
      return res;
    },

    includeCategories() {
      if (this.item.field === "forces") {
        return false;
      }
      return true;
    },

    includeForces() {
      return true;
    },

    includeSelections() {
      if (this.item.field == "forces") {
        return false;
      }
      return true;
    },

    costTypes() {
      let res: BSICostType[] = [];
      for (let elt of this.catalogue.iterateCostTypes()) {
        res.push(elt);
      }
      return res;
    },

    availableCharacteristics() {
      const characteristicMap = new Map<string, {id: string, name: string, profileType: string, entryName?: string}>();
      
      // Get profiles from the selected scope
      const profilesInScope = this.getProfilesInScope();
      
      for (const profileInfo of profilesInScope) {
        const profile = profileInfo.profile;
        const entryName = profileInfo.entryName;
        const profileType = this.catalogue.profileTypes?.find(pt => pt.id === profile.typeId);
        
        if (profileType && profileType.characteristicTypes) {
          for (const charType of profileType.characteristicTypes) {
            // Create a unique key for each characteristic in each entry context
            const key = `${profile.typeId}:${charType.id}:${entryName || 'self'}`;
            if (!characteristicMap.has(key)) {
              let displayName = `${charType.name} (${profileType.name})`;
              
              // Add entry name in parentheses if it's not self (current entry)
              if (entryName && entryName !== this.parent?.name && entryName !== "self") {
                displayName += ` (${entryName})`;
              }
              
              characteristicMap.set(key, {
                id: charType.id,
                name: displayName,
                profileType: profileType.name,
                entryName: entryName
              });
            }
          }
        }
      }
      
      return Array.from(characteristicMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    },

    allSelections(): EditorSearchItem[] {
      if (!this.includeSelections) {
        return [];
      }
      return getParentUnitHierarchy(this.item);
    },

    allCategories(): EditorSearchItem[] {
      if (!this.includeCategories) {
        return [];
      }
      return getSearchCategories(this.catalogue);
    },

    allForces(): EditorSearchItem[] {
      if (!this.includeForces) {
        return [];
      }
      return getSearchElements(this.catalogue, "forcesIterator");
    },

    allParents(): EditorSearchItem[] {
      return getParentScopes(this.item);
    },

    allScopes(): ScopeChoice[] {
      if (this.costType)
        return [
          {
            id: "self",
            name: "Self",
            editorTypeName: "bullet",
          },
          {
            id: "parent",
            name: "Parent",
            editorTypeName: "bullet",
          },
        ];
      const common = [
        {
          id: "force",
          name: "Force",
          editorTypeName: "bullet",
        },
        {
          id: "roster",
          name: "Roster",
          editorTypeName: "bullet",
        },
        {
          id: "primary-catalogue",
          name: "Primary Catalogue",
          editorTypeName: "bullet",
        },
        {
          id: "root-entry",
          name: "Root Entry",
          editorTypeName: "bullet",
        },
        {
          id: "unit",
          name: "Type: Unit",
          editorTypeName: "bullet",
        },
        {
          id: "model",
          name: "Type: Model",
          editorTypeName: "bullet",
        },
        {
          id: "upgrade",
          name: "Type: Upgrade",
          editorTypeName: "bullet",
        },
        {
          id: "model-or-unit",
          name: "Type: Model or Unit",
          editorTypeName: "bullet",
        },
      ];
      let res = [] as ScopeChoice[];

      if (
        this.item.field != "forces" &&
        ["condition", "localConditionGroup", "association"].includes(this.item.editorTypeName)
      ) {
        res = [
          {
            id: "self",
            name: "Self",
            editorTypeName: "bullet",
          },
          {
            id: "parent",
            name: "Parent",
            editorTypeName: "bullet",
          },
          {
            id: "ancestor",
            name: "Ancestor",
            editorTypeName: "bullet",
            title: "checks the condition in all parents",
          },
          {
            id: "primary-category",
            name: "Primary Category",
            editorTypeName: "bullet",
          },
        ] as ScopeChoice[];
      }

      if (this.item.field !== "forces" && ["repeat", "constraint"].includes(this.item.editorTypeName)) {
        res = [
          {
            id: "self",
            name: "Self",
            editorTypeName: "bullet",
          },
          {
            id: "parent",
            name: "Parent",
            editorTypeName: "bullet",
          },
        ];
      }

      return [...res, ...common]
        .concat(this.allParents)
        .concat(this.allSelections)
        .concat(this.allCategories)
        .concat(this.allForces);
    },
  },

  watch: {
    "item.field": {
      handler() {
        if (this.item.field == "forces") {
          this.item.scope = "roster";
        }
        this.itemField = this.fieldTypes.find((elt) => {
          return elt.value == this.item.field;
        });
      },
      immediate: true,
    },
  },
};
</script>

<style scoped lang="scss">
.constraint {
  display: grid;
  grid-template-columns: 1fr 50px max-content;
}

.checks {
  display: grid;
  grid-gap: 10px;
  grid-auto-flow: column;
}

.query {
  display: grid;
  grid-gap: 5px;
  grid-template-columns: auto max-content 1fr;
  align-items: center;
}

@import "@/shared_components/css/vars.scss";

.catalogueName {
  color: rgb(144, 152, 197);
  font-style: italic;
}

.shared {
  color: $gray;
  font-style: italic;
}
</style>
