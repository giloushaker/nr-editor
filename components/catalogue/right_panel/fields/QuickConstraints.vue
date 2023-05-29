<template>
  <fieldset>
    <legend>Quick Constraints</legend>
    <div class="columns">
      <div class="buttonList">
        <button class="bouton" @click="add('min', 'parent')">
          <img src="./assets/icons/iconeplus.png" />MIN IN PARENT
        </button>
        <button class="bouton" v-if="withCategory" @click="add('min', 'parent')">
          <img src="./assets/icons/iconeplus.png" />MIN IN CATEGORY
        </button>
        <button class="bouton" @click="add('min', 'force')">
          <img src="./assets/icons/iconeplus.png" />MIN IN FORCE
        </button>
        <button class="bouton" @click="add('min', 'roster')">
          <img src="./assets/icons/iconeplus.png" />MIN IN ROSTER
        </button>
      </div>
      <div class="buttonList">
        <button class="bouton" @click="add('max', 'parent')">
          <img src="./assets/icons/iconeplus.png" />MAX IN PARENT
        </button>
        <button class="bouton" v-if="withCategory" @click="add('max', 'parent')">
          <img src="./assets/icons/iconeplus.png" />MAX IN CATEGORY
        </button>
        <button class="bouton" @click="add('max', 'force')">
          <img src="./assets/icons/iconeplus.png" />MAX IN FORCE
        </button>
        <button class="bouton" @click="add('max', 'roster')">
          <img src="./assets/icons/iconeplus.png" />MAX IN ROSTER
        </button>
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { ItemTypes } from "~/assets/shared/battlescribe/bs_editor";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";

export default {
  emits: ["catalogueChanged"],
  setup() {
    return { store: useEditorStore() };
  },
  props: {
    item: {
      type: Object as PropType<ItemTypes>,
      required: true,
    },

    withCategory: {
      type: Boolean,
      default: false,
    },
  },

  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
    add(type: string, scope: string) {
      this.store.create("constraints", {
        type: type,
        scope: scope,
        value: 1,
        select: false,
      });
    },
  },
};
</script>

<style scoped>
.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 10px;
}

.bouton {
  width: 100%;
}

.buttonList {
  display: grid;
  grid-gap: 10px;
}
</style>
