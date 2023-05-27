<template>
  <div>
    <h2 class="text-center"><span class="gray">References to</span> {{ label }}</h2>
    note: this tab is currently missing:
    <span class="gray">
      <div> conditions/constraints/repeats</div>
      <div> categories given by modifiers </div>
      <div> refs to profileType</div>
      <div> imports from importRootEntries</div>
    </span>

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
          {{ link.parent?.getName() || "No parent (likely a bug)" }}
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
import { PropType } from "nuxt/dist/app/compat/capi";
import { findParentWhere, getName } from "~/assets/shared/battlescribe/bs_editor";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorState";

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
