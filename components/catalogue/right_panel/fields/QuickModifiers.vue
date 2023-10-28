<template>
  <fieldset>
    <legend><img src="assets/bsicons/modifier.png" /> Quick Modifiers</legend>
    <div class="columns">
      <template v-if="type === 'constraint'">
        <div class="buttonList">
          <button class="bouton" @click="add('id', 'increment', 1)">
            <img src="/assets/icons/iconeplus.png" />INCREMENT 1
          </button>
          <button class="bouton" @click="add('id', 'set', 1)"> <img src="/assets/icons/iconeplus.png" />SET 1 </button>
        </div>
        <div class="buttonList">
          <button class="bouton" @click="add('id', 'decrement', 1)">
            <img src="/assets/icons/iconeplus.png" />DECREMENT 1
          </button>
          <button class="bouton" @click="add('id', 'set', 0)"> <img src="/assets/icons/iconeplus.png" />SET 0 </button>
        </div>
      </template>
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
  computed: {
    type() {
      return this.item.editorTypeName;
    },
    parent() {
      return (this.item as EditorBase).parent;
    },
  },
  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
    add(field: string, type: string, value: string | number) {
      if (field === "id") {
        field = (this.item as EditorBase).id;
      }

      let parent = this.item as EditorBase;
      if (this.type === "constraint") {
        parent = this.parent!;
      }
      this.store.create_child("modifiers", parent, {
        field: field,
        type: type,
        value: value,
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
