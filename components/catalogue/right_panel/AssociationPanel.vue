<template>
  <div>
    <p class="info">
      Associations are a New Recruit specific feature allowing you to associate an entry to another, such as a unit to a
      bataillon.
      <br />
      Feel free to offer feedback or ask questions on our <a href="https://discord.gg/cCtqGbugwb">Discord server</a>.
    </p>

    <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
    <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" class="section" />
    <CatalogueRightPanelFieldsQuery
      :catalogue="catalogue"
      childSelctions
      :item="item"
      @catalogueChanged="changed"
      class="section"
      childSelections
    />
    <FilterBy class="section" :item="item" @catalogueChanged="changed" :catalogue="catalogue" hideshared />
    <fieldset class="section">
      <legend>Constraints</legend>
      <table class="editorTable">
        <tr>
          <td>Min</td>
          <td><input @input="changed" v-model="item.min" type="number" /></td>
        </tr>
        <tr>
          <td>Max</td>
          <td><input @input="changed" v-model="item.max" type="number" /></td>
        </tr>
      </table>
    </fieldset>
    <!-- <fieldset class="section">
      <legend>Association</legend>
      <table class="editorTable">
        <tr>
          <td class="underline"
            title="split by `,`; used by associationConstraints on entries, eg: to have a maximum number of commanders in a bataillion">
            ids:
          </td>
          <td><input v-model="item.ids" @input="changed" type="text" /></td>
        </tr>
      </table>
    </fieldset> -->
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import FilterBy from "./fields/FilterBy.vue";
import { NRAssociation } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<NRAssociation & EditorBase>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
  computed: {
    ids: {
      get(): string {
        return this.item.ids?.join(", ") || "";
      },
      set(v: string) {
        this.item.ids = v.split(",").map((o) => o.trim());
      },
    },
  },
  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },
  components: { FilterBy },
};
</script>
