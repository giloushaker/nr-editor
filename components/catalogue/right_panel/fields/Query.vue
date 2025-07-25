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
      if (this.parent?.editorTypeName === "forceEntry") {
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
            id: "ancestor",
            name: "Ancestor",
            editorTypeName: "bullet",
            title: "checks the condition in all parents",
          },
        ];
      }
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
