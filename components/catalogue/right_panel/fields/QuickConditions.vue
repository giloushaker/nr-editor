<template>
  <fieldset>
    <legend><img src="assets/bsicons/condition.png" /> Quick Conditions</legend>
    <div class="columns">
      <div class="buttonList">
        <button
          class="bouton"
          @click="add('self', 'selections', 'instanceOf', 1)"
          v-if="item.editorTypeName === 'localConditionGroup'"
        >
          <img src="/assets/icons/iconeplus.png" />SELF INSTANCE OF
        </button>
        <button class="bouton" @click="add('parent', 'selections', 'atLeast', 1)">
          <img src="/assets/icons/iconeplus.png" />PARENT ATLEAST 1
        </button>
        <button class="bouton" @click="add('force', 'selections', 'atLeast', 1)">
          <img src="/assets/icons/iconeplus.png" />FORCE ATLEAST 1
        </button>
        <button class="bouton" @click="add('roster', 'selections', 'atLeast', 1)">
          <img src="/assets/icons/iconeplus.png" />ROSTER ATLEAST 1
        </button>
        <button class="bouton" @click="add('ancestor', 'selections', 'instanceOf', 1)">
          <img src="/assets/icons/iconeplus.png" />ANCESTOR INSTANCE OF
        </button>
      </div>
      <div class="buttonList">
        <button
          class="bouton"
          @click="add('self', 'selections', 'notInstanceOf', 1)"
          v-if="item.editorTypeName === 'localConditionGroup'"
        >
          <img src="/assets/icons/iconeplus.png" />SELF NOT INSTANCE OF
        </button>
        <button class="bouton" @click="add('parent', 'selections', 'lessThan', 1)">
          <img src="/assets/icons/iconeplus.png" />PARENT LESS THAN 1
        </button>
        <button class="bouton" @click="add('force', 'selections', 'lessThan', 1)">
          <img src="/assets/icons/iconeplus.png" />FORCE LESS THAN 1
        </button>
        <button class="bouton" @click="add('roster', 'selections', 'lessThan', 1)">
          <img src="/assets/icons/iconeplus.png" />ROSTER LESS THAN 1
        </button>
        <button class="bouton" @click="add('ancestor', 'selections', 'notInstanceOf', 1)">
          <img src="/assets/icons/iconeplus.png" />ANCESTOR NOT INSTANCE OF
        </button>
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { ItemTypes } from "~/assets/shared/battlescribe/bs_editor";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { scopeIsId } from "~/assets/ts/catalogue/catalogue_helpers";
import { useEditorStore } from "~/stores/editorStore";

export default {
  emits: ["catalogueChanged"],
  setup() {
    return { store: useEditorStore() };
  },
  props: {
    item: {
      type: Object as PropType<EditorBase>,
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
    add(scope: string, field: string, type: string, value: string | number) {
      if (field === "id") {
        field = (this.item as EditorBase).id;
      }

      let parent = this.item as EditorBase;
      this.store.create_child("conditions", parent, {
        scope: scope,
        field: field,
        type: type,
        value: value,
        childId: "any",
        includeChildSelections: ["roster"].includes(scope) ? true : false,
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
