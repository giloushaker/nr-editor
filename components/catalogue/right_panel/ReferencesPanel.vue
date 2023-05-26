<template>
  <div>
    <h2 class="text-center"><span class="gray">References to</span> {{ label }}</h2>
    <span class="gray">
      note: this tab is currently missing:
      <div> conditions/constraints/repeats refering to (by id)</div>
      <div> categories given by modifiers </div>
      <div> profile related refs</div>
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
    label() {
      return getName(this.item);
    },
  },
};
</script>
