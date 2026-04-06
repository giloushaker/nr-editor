<template>
  <fieldset>
    <legend>Query</legend>
    <div class="query">
      <div style="flex-grow: 6">
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
      </div>
      <div class="inQuery" style="flex-grow: 4; gap: 8px;">
        <span> in </span>
        <UtilAutocomplete
          style="flex-grow: 1"
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
      </div>
    </div>

    <div class="checks" v-if="!isCostType">
      <div v-if="shared">
        <input id="shared" type="checkbox" v-model="item.shared" />
        <label for="shared" class="hastooltip" :title="sharedTooltip">Shared</label>
      </div>
      <div v-if="childSelections">
        <input id="childSelections" type="checkbox" v-model="item.includeChildSelections" />
        <label for="childSelections">And all child Selections</label>
      </div>
      <div v-if="childForces">
        <input id="childForces" type="checkbox" v-model="item.includeChildForces" />
        <label for="childForces">And all child Forces</label>
      </div>
      <div v-if="parentAssociation">
        <input id="queryFromSelf" type="checkbox" v-model="item.queryFromSelf" />
        <label for="queryFromSelf">
          Evaluate from self instead of target ({{ String(parentAssociationParent?.name) }})</label
        >
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
    changed() {},
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
      if (this.item.field === "associations") {
        this.item.scope = "self";
      } else {
        if ("childId" in this.item) {
          delete this.item.childId;
        }
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
    parentAssociation() {
      if (this.association) return;
      const parent = getModifierOrConditionParent(this.item);
      if (!parent) return;
      if (["association", "associationLink", "sharedAssociation"].includes(parent.editorTypeName)) {
        return parent;
      }
    },
    parentAssociationParent() {
      const parent = this.parentAssociation?.parent;
      if (parent && !parent.isCatalogue()) return parent;
    },
    sharedTooltip() {
      return `Its generally recommended to keep shared checked
If set to false, queries will be evaluated in a stricter way, usually only relevant if the scope is above "parent"
on NR, this is mostly equivalent to just setting scope to self.
note: shared=false on BS will limit the constraint to it's parent rootSelectionEntry ID
`;
    },
    instanceOf() {
      return ["instanceOf", "notInstanceOf"].includes(this.item?.type);
    },
    parent() {
      return getModifierOrConditionParent(this.item as EditorBase);
    },
    isCostType() {
      return this.parent?.editorTypeName === "costType";
    },
    isForceEntry() {
      return ["forceEntryLink", "forceEntry"].includes(this.parent?.editorTypeName!);
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
        type: "selectionEntry",
      });
      res.push({
        name: "Associations",
        value: "associations",
        type: "association",
      });
      res.push({
        name: "Forces",
        value: "forces",
        type: "bullet",
      });
      for (const costType of this.costTypes) {
        res.push({
          name: costType.name,
          value: costType.id,
          type: "cost",
        });
        res.push({
          name: `${costType.name} Limit`,
          value: `limit::${costType.id}`,
          type: "cost",
        });
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
      return getSearchElements(this.catalogue, "forceEntriesIterator");
    },

    allParents(): EditorSearchItem[] {
      return getParentScopes(this.item);
    },

    allScopes(): ScopeChoice[] {
      const SCOPE_SELF = {
        id: "self",
        name: "Self",
        editorTypeName: "bullet",
      };
      const SCOPE_PARENT = {
        id: "parent",
        name: "Parent",
        editorTypeName: "bullet",
      };
      const SCOPE_FORCE = {
        id: "force",
        name: "Force",
        editorTypeName: "bullet",
      };
      const SCOPE_ROSTER = {
        id: "roster",
        name: "Roster",
        editorTypeName: "bullet",
      };
      const SCOPE_ANCESTOR = {
        id: "ancestor",
        name: "Ancestor",
        editorTypeName: "bullet",
        title: "checks the condition in all parents",
      };
      const SCOPE_PRIMARY_CATALOGUE = {
        id: "primary-catalogue",
        name: "Primary Catalogue",
        editorTypeName: "bullet",
      };
      const SCOPE_PRIMARY_CATEGORY = {
        id: "primary-category",
        name: "Primary Category",
        editorTypeName: "bullet",
      };
      if (this.item.field === "associations") {
        return [SCOPE_SELF];
      }
      if (this.isForceEntry) {
        return [SCOPE_SELF, SCOPE_PARENT, SCOPE_FORCE, SCOPE_ROSTER, SCOPE_PRIMARY_CATALOGUE, SCOPE_ANCESTOR];
      }
      if (this.isCostType) {
        return [SCOPE_SELF, SCOPE_PARENT];
      }
      const common = [SCOPE_FORCE, SCOPE_ROSTER, SCOPE_PRIMARY_CATALOGUE];
      const common_non_forces_field = [
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
      if (this.item.field != "forces") {
        common.push(...common_non_forces_field);
      }
      let res = [] as ScopeChoice[];
      if (this.item.field != "forces") {
        if (["condition", "localConditionGroup", "association"].includes(this.item.editorTypeName)) {
          res = [SCOPE_SELF, SCOPE_PARENT, SCOPE_ANCESTOR, SCOPE_PRIMARY_CATEGORY];
        }
        if (["repeat", "constraint"].includes(this.item.editorTypeName)) {
          res = [SCOPE_SELF, SCOPE_PARENT];
        }
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
    display: flex;
    flex-wrap: wrap;
    flex-direction: row;
    gap: 2px 4px;
}

.query {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
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
.inQuery {
  display: flex;
  flex-direction: row;
  align-items: center;
}
</style>
