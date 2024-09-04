<template>
  <fieldset>
    <legend>Query</legend>
    <table class="editorTable">
      <tr>
        <td>Scope:</td>
        <td>
          <UtilAutocomplete
            v-model="scope"
            :placeholder="`Search Scope...`"
            :options="allScopes"
            valueField="value"
            filterField="name"
            :default="allScopes[0]"
            @change=""
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
        <td
          >Affects:
          <span class="imgBt">
            <img src="/assets/icons/i.png" class="align-text-bottom" @click="affectsPopup = true" />
          </span>
        </td>
        <td>
          <input type="text" v-model="obj.affects" placeholder="self" />
        </td>
      </tr>
    </table>
    <PopupDialog v-if="affectsPopup" v-model="affectsPopup">
      for ease of parsing this field only accepts selectors separated by a <code class="cost">.</code>

      <h5>selectors on nodes:</h5
      ><ul class="m-0">
        <li><span class="cost">all</span></li>
        <li><span class="cost">childs</span></li>
        <li><span class="cost">forces</span></li>
        <li><span class="cost">categories</span></li>
        <li><span class="cost">units</span></li>
        <li>
          <span class="cost">profiles</span>: May be followed by a typeName e.g
          <span class="cost">profiles.Weapon</span>.
        </li>
        <li>
          <span class="cost">{id}</span>: Used to filter the nodes, e.g
          <span class="cost">childs.recursive.model</span>.
        </li>
      </ul>

      <h5>Additional Selectors:</h5>
      <ul class="m-0">
        <li><span class="cost">.recursive</span> Recursively applies the previous selector.</li>
      </ul>

      <p class="mt-20px">
        <strong>Notes:</strong> This feature is a work in progress (WIP) and may undergo syntax changes, which could
        require you to re-input them. <br />There may be peformance issues if many modifiers affect a roster or force.
        <br />Added Modifiers are (currently) evaluated last, in the order they were added by the user, so don't expect
        a specific order if using multiple relative modifiers <br />Feel free to provide feedback on Discord.
      </p>
    </PopupDialog>
  </fieldset>
</template>
<script lang="ts">
import PopupDialog from "~/shared_components/PopupDialog.vue";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSICostType } from "~/assets/shared/battlescribe/bs_types";
import {
  EditorSearchItem,
  getParentUnitHierarchy,
  getSearchCategories,
  getSearchElements,
  getParentScopes,
} from "~/assets/ts/catalogue/catalogue_helpers";
import { getNameExtra } from "~/assets/shared/battlescribe/bs_editor";
import { Modifier } from "~/assets/shared/battlescribe/bs_main";
const scopes = {
  self: { value: "self", name: "Self" },
  parent: { value: "parent", name: "Parent" },
  roster: { value: "roster", name: "Roster" },
  force: { value: "force", name: "Force" },
  category: { value: "category", name: "Category" },
  ancestor: { value: "ancestor", name: "Ancestor" },
  parents: { value: "ancestor", name: "All Parents" },
  primaryCategory: { value: "primary-category", name: "Primary Category" },
  primaryCatalogue: { value: "primary-catalogue", name: "Primary Catalogue" },
  rootEntry: { value: "root-entry", name: "Root Entry" },
  unit: { value: "unit", name: "Type: Unit" },
  model: { value: "model", name: "Type: Model" },
  upgrade: { value: "upgrade", name: "Type: Upgrade" },
  modelOrUnit: { value: "model-or-unit", name: "Type: Model or Unit" },
} as const;
interface ScopeChoice {
  value: string;
  name: string;
  editorTypeName?: string;
  title?: string;
}
export default defineComponent({
  components: { PopupDialog },
  emits: ["catalogueChanged"],
  props: {
    obj: { type: Object as PropType<Modifier & EditorBase>, required: true },
  },
  data: () => ({
    affectsPopup: false,
  }),
  methods: {
    getNameExtra,
    showCatalogue(opt: EditorSearchItem): boolean {
      if (!opt.catalogue) {
        return false;
      }
      if (opt.catalogue === this.obj.catalogue?.getName()) {
        return false;
      }
      return true;
    },
  },
  computed: {
    scope: {
      get() {
        return this.obj.scope ?? "self";
      },
      set(val: string) {
        if (val === "self") delete this.obj.scope;
        else this.obj.scope = val;
      },
    },
    catalogue() {
      return this.obj.getCatalogue();
    },
    type() {
      return this.obj.editorTypeName;
    },
    costTypes() {
      let res: BSICostType[] = [];
      for (let elt of this.catalogue.iterateCostTypes()) {
        res.push(elt);
      }
      return res;
    },

    allSelections(): EditorSearchItem[] {
      return getParentUnitHierarchy(this.obj);
    },

    allCategories(): EditorSearchItem[] {
      return getSearchCategories(this.catalogue);
    },

    allForces(): EditorSearchItem[] {
      return getSearchElements(this.catalogue, "forcesIterator");
    },

    allParents(): EditorSearchItem[] {
      return getParentScopes(this.obj);
    },

    allScopes(): Array<ScopeChoice | EditorSearchItem> {
      const result = [scopes.self, scopes.parent, scopes.force, scopes.roster, scopes.primaryCatalogue] as Array<
        ScopeChoice | EditorSearchItem
      >;
      if (this.type !== "force") {
        result.push(scopes.rootEntry, scopes.unit, scopes.model, scopes.upgrade, scopes.modelOrUnit);
      }
      result.push(...this.allParents);
      if (this.type !== "force") {
        result.push(...this.allCategories);
      }
      result.push(...this.allForces);
      return result;
    },
  },
});
</script>
