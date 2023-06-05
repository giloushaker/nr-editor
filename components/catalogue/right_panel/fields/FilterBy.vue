<template>
  <fieldset>
    <legend>Filter By</legend>
    <table class="editorTable">
      <tr>
        <td>Of:</td>
        <td>
          <span v-if="child">
            <img class="mr-1 align-middle" :src="`./assets/bsicons/${child.editorTypeName}.png`" />
            {{ child.name }}</span
          >
        </td>
      </tr>
      <tr>
        <td>Child ID:</td>
        <td><input type="text" v-model="item.childId" @change="changed" /></td>
      </tr>
      <tr>
        <td>Child:</td>
        <td>
          <UtilAutocomplete
            v-model="item.childId"
            :placeholder="`Search Child...`"
            :options="availableTargets"
            valueField="id"
            filterField="name"
            @change="changed"
          >
            <template #option="opt">
              <div>
                <template v-if="opt.option.indent >= 2 && !opt.selected"
                  ><span v-for="n of opt.option.indent - 1">&nbsp;&nbsp;&nbsp;</span></template
                >
                <img class="mr-1 align-middle" :src="`./assets/bsicons/${opt.option.editorTypeName}.png`" />

                {{ opt.option.name }}
              </div>
            </template>
          </UtilAutocomplete>
        </td>
      </tr>
    </table>
    <input type="checkbox" v-model="item.shared" id="shared" @change="chaged" />
    <label for="shared">Shared?</label>
  </fieldset>
</template>

<script lang="ts">
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSICondition } from "~/assets/shared/battlescribe/bs_types";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

import { EditorSearchItem, getSearchElements, getSearchCategories } from "@/assets/ts/catalogue/catalogue_helpers";

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

  data() {
    return {
      baseItems: [
        {
          id: "any",
          name: "Anything",
          editorTypeName: "bullet",
          indent: 1,
        },
        {
          id: "unit",
          name: "Unit",
          editorTypeName: "bullet",
          indent: 1,
        },
        {
          id: "model",
          name: "Model",
          editorTypeName: "bullet",
          indent: 1,
        },
        {
          id: "upgrade",
          name: "Upgrade",
          editorTypeName: "bullet",
          indent: 1,
        },
      ],
    };
  },

  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },

  watch: {
    child() {
      this.catalogue.updateCondition(this.item);
    },
  },

  computed: {
    child() {
      if (!this.item.childId) {
        return null;
      }

      const base = this.baseItems.find((elt) => elt.id === this.item.childId);
      if (base) {
        return base;
      }

      return this.catalogue.findOptionById(this.item.childId) as any as EditorSearchItem;
    },

    allEntries(): EditorSearchItem[] {
      return getSearchElements(this.catalogue, "iterateSelectionEntries");
    },

    allCategories(): EditorSearchItem[] {
      return getSearchCategories(this.catalogue);
    },

    allForces(): EditorSearchItem[] {
      return getSearchElements(this.catalogue, "forcesIterator");
    },

    availableTargets() {
      let res: EditorSearchItem[] = this.baseItems;

      return res.concat(this.allCategories).concat(this.allEntries).concat(this.allForces);
    },
  },
};
</script>
