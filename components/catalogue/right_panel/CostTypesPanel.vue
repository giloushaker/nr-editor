<template>
  <div>
    <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
    <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" class="section" />
    <CatalogueRightPanelFieldsHidden :item="item" @catalogueChanged="changed" class="section">
      Cost Types
    </CatalogueRightPanelFieldsHidden>

    <div class="section">
      <fieldset>
        <legend>Limit</legend>
        <table class="editorTable">
          <tr>
            <td>Default Cost Limit: </td>
            <td>
              <input type="number" v-model="item.defaultCostLimit" @change="changed" />
              <span class="gray ml-10px">-1 = No limit</span>
            </td>
          </tr>
        </table>
      </fieldset>
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { BSICostType } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSICostType>,
      required: true,
    },
  },

  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },
};
</script>
