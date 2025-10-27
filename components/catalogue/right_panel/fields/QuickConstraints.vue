<template>
  <fieldset>
    <legend><img src="assets/bsicons/constraint.png" /> Quick Constraints</legend>
    <div class="columns">
      <div class="column">
        <button class="bouton" @click="add('min', 'parent')">
          <img src="/assets/icons/iconeplus.png" /><span class="text">MIN 1 IN PARENT</span>
        </button>
        <button class="bouton" v-if="withCategory" @click="add('min', 'parent')">
          <img src="/assets/icons/iconeplus.png" /><span class="text">MIN 1 IN CATEGORY</span>
        </button>
        <button class="bouton" @click="add('min', 'force')">
          <img src="/assets/icons/iconeplus.png" /><span class="text">MIN 1 IN FORCE</span>
        </button>
        <button class="bouton" @click="add('min', 'roster')">
          <img src="/assets/icons/iconeplus.png" /><span class="text">MIN 1 IN ROSTER</span>
        </button>
      </div>
      <div class="column">
        <button class="bouton" @click="add('max', 'parent')">
          <img src="/assets/icons/iconeplus.png" /><span class="text">MAX 1 IN PARENT</span>
        </button>
        <button class="bouton" v-if="withCategory" @click="add('max', 'parent')">
          <img src="/assets/icons/iconeplus.png" /><span class="text">MAX 1 IN CATEGORY</span>
        </button>
        <button class="bouton" @click="add('max', 'force')">
          <img src="/assets/icons/iconeplus.png" /><span class="text">MAX 1 IN FORCE</span>
        </button>
        <button class="bouton" @click="add('max', 'roster')">
          <img src="/assets/icons/iconeplus.png" /><span class="text">MAX 1 IN ROSTER</span>
        </button>
      </div>
      <div class="column">
        <button class="bouton" @click="add('exactly', 'parent')">
          <img src="/assets/icons/iconeplus.png" /><span class="text">EXACTLY 1 IN PARENT</span>
        </button>
        <button class="bouton" v-if="withCategory" @click="add('exactly', 'parent')">
          <img src="/assets/icons/iconeplus.png" /><span class="text">EXACTLY 1 IN CATEGORY</span>
        </button>
        <button class="bouton" @click="add('exactly', 'force')">
          <img src="/assets/icons/iconeplus.png" /><span class="text">EXACTLY 1 IN FORCE</span>
        </button>
        <button class="bouton" @click="add('exactly', 'roster')">
          <img src="/assets/icons/iconeplus.png" /><span class="text">EXACTLY 1 IN ROSTER</span>
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
    add(type: string, scope: string) {
      this.store.create_child("constraints", this.item as EditorBase, {
        type: type,
        scope: scope,
        value: 1,
        select: false,
        includeChildSelections: ["roster"].includes(scope) ? true : false
      });
    },
  },
};
</script>

<style scoped>
.columns {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 10px;
}

.column {
  flex: 1;
  flex-wrap: wrap;
}

.bouton {
  width: 100%;
  font-size: 15px !important;
  text-align: left !important;
}

.text {
  margin-left: 28px;
}
</style>
