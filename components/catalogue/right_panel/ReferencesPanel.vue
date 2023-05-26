<template>
  <div>
    <h2 class="text-center"><span class="gray">References to</span> {{ label }}</h2>
    note: this tab is currently missing:
    <span class="gray">
      <div> conditions/constraints/repeats refering to (by id)</div>
      <div> categories given by modifiers </div>
      <div> profile type refs</div>
      <div> root entry / catalogue refs</div>
    </span>

    <table class="mb-20px">
      <tr>
        <th> Catalogue </th>
        <th> Name </th>
      </tr>
      <tr v-for="link of links">
        <td class="gray">
          {{ link.catalogue.getName() }}
        </td>
        <td>
          {{ link.getName() }}
        </td>
      </tr>
    </table>
  </div>
  <!-- <button class="bouton"> Load from all catalogues </button> -->
</template>
<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { getName } from "~/assets/shared/battlescribe/bs_editor";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  props: {
    item: {
      type: Object as PropType<EditorBase>,
      required: true,
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
