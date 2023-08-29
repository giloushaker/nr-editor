<template>
  <div>
    <h2 class="text-center"><span class="gray">References to</span> {{ label }}</h2>
    <!-- <p class="ml-10px info"> Click Load All to have refs from all other catalogues appear. </p> -->
    <table class="mb-20px">
      <tr>
        <th> Catalogue </th>
        <th> Name </th>
      </tr>
      <tr v-for="link of links">
        <td class="gray">
          {{ link.isCatalogue() ? link.getName() : link.catalogue?.getName() }}
        </td>
        <td>
          <template v-if="show_link_name">
            {{ link.getName() }}
          </template>
          <template v-else>
            {{ link.parent?.getName() }}
          </template>
        </td>
        <td>
          <button @click="store.goto(gotoTarget(link))">Goto</button>
        </td>
      </tr>
    </table>

    <div v-if="other_links.length">
      <h3> From conditions/constraints/modifiers/repeats: </h3>
      <table class="mb-20px">
        <tr>
          <th> Catalogue </th>
          <th> Name </th>
          <th> Type </th>
          <th> Details </th>
        </tr>
        <tr v-for="link of other_links">
          <td class="gray">
            {{ link.isCatalogue() ? link.getName() : link.catalogue?.getName() }}
          </td>
          <td>
            {{ parentEntry(link)?.getName() || "No parent (likely a bug)" }}
          </td>
          <td>
            {{ link.editorTypeName }}
          </td>
          <td> {{ link.type }} {{ link.value }} </td>
          <td>
            <button @click="store.goto(link)">Goto</button>
          </td>
        </tr>
      </table>
    </div>
  </div>
  <!-- <button class="bouton"> Load from all catalogues </button> -->
</template>
<script lang="ts">
import { PropType } from "vue";
import { findParentWhere } from "~/assets/shared/battlescribe/bs_helpers";
import { getName } from "~/assets/shared/battlescribe/bs_editor";
import { ProfileType } from "~/assets/shared/battlescribe/bs_main";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";

export default {
  props: {
    item: {
      type: Object as PropType<EditorBase>,
      required: true,
    },
  },
  setup() {
    return { store: useEditorStore() };
  },
  methods: {
    gotoTarget(link: EditorBase) {
      if (link.isCategory()) {
        return link.parent!;
      }
      return link;
    },
    parentEntry(link: EditorBase) {
      return findParentWhere(link, (o) => o.getName());
    },
  },
  computed: {
    show_link_name() {
      if (this.item instanceof ProfileType) return true;
      return false;
    },
    links() {
      return this.item?.links || [];
    },
    other_links() {
      return this.item?.other_links || [];
    },
    label() {
      return getName(this.item);
    },
  },
};
</script>
<style scope>
td {
  padding: 1px 4px 1px 4px !important;
  text-align: left !important;
}
</style>
