<template>
  <fieldset>
    <legend>Filter By</legend>
    <table class="editorTable">
      <tr>
        <td>Of:</td>
        <td>
          <span v-if="child">
            <img class="mr-1 align-middle" :src="`/assets/bsicons/${child.editorTypeName}.png`" />
            {{ child.name }}</span
          >
        </td>
      </tr>
      <tr>
        <td>Child ID:</td>
        <td><input type="text" v-model="childId" @change="changed" /></td>
      </tr>
      <tr>
        <td>Child:</td>
        <td>
          <UtilAutocomplete
            v-model="childId"
            :placeholder="`Search Child...`"
            :options="availableTargets"
            valueField="id"
            filterField="name"
            @change="changed"
            :default="child"
            lazy
          >
            <template #option="opt">
              <div v-if="opt.option" style="white-space: nowrap">
                <template v-if="opt.option.indent >= 1 && !opt.selected">
                  <span v-for="n of opt.option.indent">&nbsp;&nbsp;&nbsp;</span>
                </template>
                <img class="mr-1 align-middle" :src="`/assets/bsicons/${opt.option.editorTypeName}.png`" />

                {{ opt.option.name }}
                <span class="gray">{{ getNameExtra(opt.option, false) }}</span>
                <span class="shared" v-if="opt.option.shared"> (shared) </span>
                <span class="catalogueName" v-if="showCatalogue(opt.option)"> [{{ opt.option.catalogue }}]</span>
              </div>
            </template>
          </UtilAutocomplete>
        </td>
      </tr>
    </table>
    <input type="checkbox" v-model="item.shared" id="shared" @change="changed" />
    <label for="shared">Shared?</label>
  </fieldset>
</template>

<script lang="ts">
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSICondition } from "~/assets/shared/battlescribe/bs_types";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

import {
  EditorSearchItem,
  getSearchElements,
  getSearchCategories,
  getFilterSelections,
  getSearchCatalogues,
  scopeIsId,
} from "@/assets/ts/catalogue/catalogue_helpers";
import { getNameExtra } from "~/assets/shared/battlescribe/bs_editor";
const baseItems = [
  {
    id: "any",
    name: "Anything",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
  {
    id: "unit",
    name: "Unit",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
  {
    id: "model",
    name: "Model",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
  {
    id: "upgrade",
    name: "Upgrade",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
];
export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSICondition & EditorBase>,
      required: true,
    },

    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },

  methods: {
    getNameExtra,
    changed() {
      this.$emit("catalogueChanged");
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
    availableTargets() {
      return [...baseItems, ...this.allCategories, ...this.allEntries, ...this.allForces, ...this.allCatalogues];
    },
  },

  watch: {
    "item.scope"() {
      if (!this.child) {
        this.item.childId = this.availableTargets()[0]?.id || undefined;
      }
    },
  },

  computed: {
    childId: {
      get() {
        return this.item.childId;
      },
      set(id: string) {
        const old = this.item.childId;
        this.item.childId = id;
        this.catalogue.updateCondition(this.item, old);
      },
    },
    child() {
      if (!this.item.childId) {
        return null;
      }

      const base = this.availableTargets().find((elt) => elt.id === this.item.childId);
      if (base) {
        return base;
      }
      return this.catalogue.findOptionById(this.item.childId) as any as EditorSearchItem;
    },

    instanceOf() {
      return ["instanceOf", "notInstanceOf"].includes(this.item?.type);
    },

    allEntries(): EditorSearchItem[] {
      if (!this.includeSelections) {
        return [];
      }
      return getFilterSelections(this.item, this.catalogue);
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

    allCatalogues(): EditorSearchItem[] {
      if (!this.includeCatalogues) {
        return [];
      }
      return getSearchCatalogues(this.catalogue);
    },

    includeSelections() {
      if (this.instanceOf && this.item.scope === "primary-catalogue") {
        return false;
      }
      if (this.instanceOf && this.item.scope === "primary-category") {
        return false;
      }

      return true;
    },

    includeCategories() {
      if (this.instanceOf && this.item.scope === "primary-catalogue") {
        return false;
      }

      if (this.item.field === "forces") {
        return false;
      }
      return true;
    },

    includeForces() {
      if (this.item.scope == "self") {
        return false;
      }
      if (this.item.scope == "parent") {
        return false;
      }
      if (this.item.scope == "ancestor") {
        return true;
      }
      if (this.instanceOf && this.item.scope === "primary-catalogue") {
        return false;
      }
      if (this.instanceOf && this.item.scope === "primary-category") {
        return false;
      }

      if (scopeIsId(this.item)) {
        return false;
      }

      return true;
    },

    includeCatalogues() {
      return this.instanceOf && this.item.scope === "primary-catalogue";
    },
  },
};
</script>

<style scoped lang="scss">
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
