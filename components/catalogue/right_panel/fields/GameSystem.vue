<template>
  <fieldset>
    <legend>System</legend>
    <div class="mr-8px">
      <table class="editorTable">
        <EditorField :item="item" field="categoriesLabel" label="Categories Label" />
        <EditorField :item="item" field="forceLabel" label="Force Label" />
      </table>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { GameSystem } from "~/assets/shared/battlescribe/bs_main_catalogue";
import EditorField from "./EditorField.vue";

export default {
  components: { EditorField },
  props: {
    item: {
      type: Object as PropType<GameSystem>,
      required: true,
    },
  },
};
</script>
