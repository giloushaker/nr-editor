<template>
  <fieldset>
    <legend>Query</legend>
    <div class="query">
      <select v-model="item.field" @change="changed">
        <option value="selections">Selections</option>
        <option value="forces">Forces</option>
        <option v-for="costType of costTypes" :value="costType.id">
          {{ costType.name }}
        </option>
      </select>
      <span> in </span>

      <UtilAutocomplete
        v-model="item.scope"
        :placeholder="`Search Scope...`"
        :options="allScopes"
        valueField="id"
        filterField="name"
        @change="changed"
      >
        <template #option="opt">
          <div>
            <img class="mr-1 align-middle" :src="`./assets/bsicons/${opt.option.editorTypeName}.png`" />
            {{ opt.option.name }}
          </div>
        </template>
      </UtilAutocomplete>

      <div class="checks">
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
import { Category, Force } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSICondition, BSIConstraint, BSICostType } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIConstraint | BSICondition>,
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
  },

  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },

  computed: {
    parent() {
      return (this.item as any as EditorBase).parent;
    },

    costTypes(): BSICostType[] {
      if (this.catalogue.costTypes) {
        return this.catalogue.costTypes;
      }
      return [];
    },

    allCategories(): (Category & EditorBase)[] {
      let res: (Category & EditorBase)[] = [];
      for (let elt of this.catalogue.iterateCategoryEntries()) {
        res.push(elt as Category & EditorBase);
      }
      return res;
    },

    allForces(): (Force & EditorBase)[] {
      // TODO: add child forces
      let res: (Force & EditorBase)[] = [];
      for (let elt of this.catalogue.forcesIterator()) {
        res.push(elt as Force & EditorBase);
      }
      return res;
    },

    allScopes(): {
      id: string;
      name: string;
      editorTypeName: string;
    }[] {
      let res = [
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
      ];

      return res.concat(this.allCategories as any).concat(this.allForces as any);
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
</style>
