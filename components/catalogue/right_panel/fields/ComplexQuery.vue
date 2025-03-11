<template>
  <fieldset>
    <legend>Query</legend>
    <table class="editorTable">
      <tr>
        <td>Scope:</td>
        <td>
          <UtilAutocomplete
            v-model="item.scope"
            placeholder="Search Scope..."
            :options="allScopes"
            valueField="id"
            filterField="name"
            :default="allScopes[0]"
            @change="changed"
          >
            <template #option="opt">
              <div style="white-space: nowrap">
                <template v-if="opt.option.indent >= 2 && !opt.selected">
                  <span v-for="n of opt.option.indent - 1">&nbsp;&nbsp;&nbsp;</span>
                </template>
                <img class="mr-1 align-middle" :src="`assets/bsicons/${opt.option.editorTypeName || 'bullet'}.png`" />
                {{ opt.option.name }}
                <span class="gray">{{ getNameExtra(opt.option, false) }}</span>
                <span class="shared" v-if="opt.option.shared"> (shared)</span>
                <span class="catalogueName" v-if="showCatalogue(opt.option)"> [{{ opt.option.catalogue }}]</span>
              </div>
            </template>
          </UtilAutocomplete>
        </td>
      </tr>
      <tr>
        <td>Affects: </td>
        <td>
          <UtilAutocomplete
            v-model="fields.affectsWhat"
            placeholder="Entries"
            :options="allAffects"
            valueField="value"
            filterField="name"
            @change="changed"
          >
            <template #option="opt">
              <img class="mr-1 align-middle" :src="`assets/bsicons/${opt.option.editorTypeName || 'bullet'}.png`" />
              <span style="white-space: nowrap"> {{ opt.option.name }} </span>
            </template>
          </UtilAutocomplete>
        </td>
      </tr>
      <tr>
        <td>Filter By: </td>
        <td>
          <UtilAutocomplete
            v-model="fields.filterBy"
            :placeholder="`Search Child...`"
            :options="allFilterBy"
            valueField="id"
            filterField="name"
            @change="changed"
            :default="filterBySelected"
            lazy
          >
            <template #option="opt">
              <div v-if="opt.option" style="white-space: nowrap">
                <template v-if="opt.option.indent >= 1 && !opt.selected">
                  <span v-for="n of opt.option.indent">&nbsp;&nbsp;&nbsp;</span>
                </template>
                <img class="mr-1 align-middle" :src="`assets/bsicons/${opt.option.editorTypeName}.png`" />

                {{ opt.option.name }}
                <span class="gray">{{ getNameExtra(opt.option, false) }}</span>
                <span class="shared" v-if="opt.option.shared"> (shared) </span>
                <span class="gray" v-if="opt.option.rootId === rootId"> (same ancestor)</span>
                <span class="catalogueName" v-if="showCatalogue(opt.option)"> [{{ opt.option.catalogue }}]</span>
              </div>
            </template>
          </UtilAutocomplete>
        </td>
      </tr>
    </table>
    <div>
      <div class="checks">
        <div>
          <input @change="changed" id="includeSelf" type="checkbox" v-model="fields.self" />
          <label for="includeSelf">Include self(scope)</label>
        </div>
        <div>
          <input @change="changed" id="includeChildSelections" type="checkbox" v-model="fields.entries" />
          <label for="includeChildSelections">Include child Selections</label>
        </div>
        <div>
          <input @change="changed" id="includeChildForces" type="checkbox" v-model="fields.forces" />
          <label for="includeChildForces">Include child Forces</label>
        </div>
        <div>
          <input @change="changed" id="recursive" type="checkbox" v-model="fields.recursive" />
          <label for="recursive">Recursive</label>
        </div>
      </div>
    </div>
  </fieldset>
</template>
<script lang="ts">
import PopupDialog from "~/shared_components/PopupDialog.vue";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSICostType, BSIModifier } from "~/assets/shared/battlescribe/bs_types";
import {
  EditorSearchItem,
  getParentUnitHierarchy,
  getSearchCategories,
  getSearchElements,
  getParentScopes,
} from "~/assets/ts/catalogue/catalogue_helpers";
import { filterByItems, getNameExtra } from "~/assets/shared/battlescribe/bs_editor";
import {
  AffectsQuery,
  construct_affects_query,
  deconstruct_affects_query,
  Modifier,
} from "~/assets/shared/battlescribe/bs_main";
const scopes = {
  self: { id: undefined, name: "Self" },
  parent: { id: "parent", name: "Parent" },
  roster: { id: "roster", name: "Roster" },
  force: { id: "force", name: "Force" },
  category: { id: "category", name: "Category" },
  ancestor: { id: "ancestor", name: "Ancestor" },
  parents: { id: "ancestor", name: "All Parents" },
  primaryCategory: { id: "primary-category", name: "Primary Category" },
  primaryCatalogue: { id: "primary-catalogue", name: "Primary Catalogue" },
  rootEntry: { id: "root-entry", name: "Root Entry" },
  unit: { id: "unit", name: "Type: Unit" },
  model: { id: "model", name: "Type: Model" },
  upgrade: { id: "upgrade", name: "Type: Upgrade" },
  modelOrUnit: { id: "model-or-unit", name: "Type: Model or Unit" },
} as const;
interface ScopeChoice {
  id: string;
  name: string;
  editorTypeName?: string;
  title?: string;
}

export default defineComponent({
  components: { PopupDialog },
  emits: ["catalogueChanged"],
  props: {
    item: { type: Object as PropType<BSIModifier & EditorBase>, required: true },
  },
  data: () => ({
    fields: {
      self: true,
      entries: false,
      forces: false,
      recursive: false,
      filterBy: "any",
      affectsWhat: "entries",
    } as AffectsQuery,
  }),
  methods: {
    getNameExtra,
    showCatalogue(opt: EditorSearchItem): boolean {
      if (!opt.catalogue) {
        return false;
      }
      if (opt.catalogue === this.item.catalogue?.getName()) {
        return false;
      }
      return true;
    },
    changed() {
      this.$emit("catalogueChanged");
    },
  },
  mounted() {
    this.fields = deconstruct_affects_query(this.item.affects);
  },
  computed: {
    scope: {
      get() {
        return this.item.scope ?? "self";
      },
      set(val: string) {
        if (val === "self") delete this.item.scope;
        else this.item.scope = val;
      },
    },
    catalogue() {
      return this.item.getCatalogue();
    },
    type() {
      return this.item.editorTypeName;
    },
    costTypes() {
      let res: BSICostType[] = [];
      for (let elt of this.catalogue.iterateCostTypes()) {
        res.push(elt);
      }
      return res;
    },
    rootId() {
      let item = this.item as any;
      if (!item?.parent) return;
      while (item?.parent && !item.parent.isCatalogue()) {
        item = item.parent;
      }
      return item.id;
    },

    allSelections(): EditorSearchItem[] {
      return getParentUnitHierarchy(this.item);
    },

    allCategories(): EditorSearchItem[] {
      return getSearchCategories(this.catalogue);
    },

    allForces(): EditorSearchItem[] {
      return getSearchElements(this.catalogue, "forcesIterator");
    },

    allParents(): EditorSearchItem[] {
      return getParentScopes(this.item);
    },

    allAffects(): Array<any> {
      return [
        {
          name: "Entries",
          value: "entries",
        },
        ...[...this.catalogue.iterateProfileTypes()].map((type) => ({
          name: `Profiles (${type.name})`,
          value: `profiles.${type.name}`,
          editorTypeName: "profileType",
        })),
        {
          name: "Rules",
          value: "rules",
          editorTypeName: "rule",
        },
      ];
    },
    allScopes(): Array<ScopeChoice | EditorSearchItem> {
      const result = [scopes.self, scopes.parent, scopes.force, scopes.roster, scopes.primaryCatalogue] as Array<
        ScopeChoice | EditorSearchItem
      >;
      if (this.type !== "forceEntry") {
        result.push(scopes.rootEntry, scopes.unit, scopes.model, scopes.upgrade, scopes.modelOrUnit);
      }
      result.push(...this.allParents);
      if (this.type !== "forceEntry") {
        result.push(...this.allCategories);
      }
      result.push(...this.allForces);
      return result;
    },
    allFilterBy() {
      const result = [...filterByItems, ...this.allCategories];
      return result;
    },

    filterBySelected() {
      if (!this.fields.filterBy || this.fields.filterBy === "any") {
        return this.allFilterBy[0];
      }

      const base = this.allFilterBy.find((elt) => elt.id === this.fields.filterBy);
      if (base) {
        return base;
      }
      return this.catalogue.findOptionById(this.fields.filterBy) as any as EditorSearchItem;
    },
  },
  watch: {
    fields: {
      deep: true,
      handler(fields) {
        const built = construct_affects_query(fields);
        if (!built || built === "self") {
          delete this.item.affects;
        } else {
          this.item.affects = built;
        }
        console.log(built);
      },
    },
  },
});
</script>
<style scoped lang="scss">
.checks > div {
  display: inline-block;
  margin-right: 10px;
}
</style>
