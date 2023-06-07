<template>
  <div>
    <p class="info">
      Associations are a New Recruit specific feature allowing you to associate an entry to another, such as a unit to a
      bataillon.
      <br />
      Be aware that associations are currently in the beta phase and may undergo modifications.
      <br />
      Feel free to offer feedback or ask questions on our <a href="https://discord.gg/cCtqGbugwb">Discord server</a>.
    </p>

    <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
    <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" class="section" />
    <FilterBy class="section" :item="item" @catalogueChanged="changed" :catalogue="catalogue" />
    <fieldset class="section">
      <legend>Temporary</legend>
      <table class="editorTable">
        <tr>
          <td>min: (may be moved to child constraints)</td
          ><td><input @input="changed" v-model="item.min" type="number" /></td>
        </tr>
        <tr>
          <td>max: (may be moved to child constraints)</td
          ><td><input @input="changed" v-model="item.max" type="number" /></td>
        </tr>
        <tr>
          <td>label: (will be moved to name)</td><td><input @input="changed" v-model="item.label" type="text" /></td>
        </tr>
        <tr>
          <td>labelMembers:</td><td><input @input="changed" v-model="item.labelMembers" type="text" /></td>
        </tr>
        <tr>
          <td>of: (may be moved to ChildID to reuse filterBy)</td
          ><td><input @input="changed" v-model="item.of" type="text" /></td>
        </tr>
        <tr>
          <td>type: (will be removed, only affects conditions)</td>
          <td>
            <select @change="changed" v-model="item.type">
              <option value="or">or</option>
              <option value="and">and</option>
            </select>
          </td>
        </tr>
        <tr>
          <td>scope: </td><td><input @input="changed" v-model="item.scope" type="text" /></td>
        </tr>
        <tr>
          <td
            class="underline"
            title="Ids are a string[], used by associationConstraints on entries, eg: to have a maximum number of commanders in a bataillion"
          >
            ids:
          </td>
          <td><input v-model="item.ids" @input="changed" type="text" /></td>
        </tr>
      </table>
    </fieldset>
  </div>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIRepeat } from "~/assets/shared/battlescribe/bs_types";
import FilterBy from "./fields/FilterBy.vue";
import { NRAssociation } from "~/assets/shared/battlescribe/bs_association";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<NRAssociation>,
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
