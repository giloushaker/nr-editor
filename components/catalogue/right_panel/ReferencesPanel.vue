<template>
  <div class="mb-50px">
    <h2 class="text-center"><span class="gray">References to</span> {{ label }}</h2>
    <div v-if="links.length" class="mr-60px">
      <!-- <table class="mb-20px">
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
      </table> -->
      <div>
        <div v-for="link of links">
          <NodePath :path="path(link)" @click="store.goto(link)" class="hover-darken cursor-pointer p-1px" />
        </div>
      </div>
    </div>
    <div v-if="other_links.length" class="mr-60px">
      <h3> From conditions/constraints/modifiers/repeats </h3>
      <div>
        <div v-for="link of other_links">
          <NodePath
            :path="other_path(link)"
            @click="store.goto(link)"
            class="hover-darken cursor-pointer p-1px mb-3px"
          />
        </div>
      </div>
    </div>
  </div>
  <!-- <button class="bouton"> Load from all catalogues </button> -->
</template>
<script lang="ts">
import { PropType } from "vue";
import { findParentWhere, sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { getEntryPathInfo, getName } from "~/assets/shared/battlescribe/bs_editor";
import { ProfileType } from "~/assets/shared/battlescribe/bs_main";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";
import NodePath from "~/components/util/NodePath.vue";

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
    path(link: EditorBase, pop = true) {
      const path = getEntryPathInfo(link);
      if (pop) {
        path.pop();
      }
      return path;
    },
    other_path(link: EditorBase) {
      return getEntryPathInfo(link);
    },
  },
  computed: {
    show_link_name() {
      if (this.item instanceof ProfileType) return true;
      return false;
    },
    links() {
      return sortByAscending(this.item?.links || [], (o) => o.catalogue?.name);
    },
    other_links() {
      return sortByAscending(this.item?.other_links || [], (o) => o.catalogue?.name);
    },
    label() {
      return getName(this.item);
    },
  },
  components: { NodePath },
};
</script>
<style scope>
td {
  padding: 1px 4px 1px 4px !important;
  text-align: left !important;
}
</style>
