<template>
  <fieldset>
    <legend>
      <slot></slot>
    </legend>
    <div class="booleans">
      <div v-for="field of fields.filter((f) => f.status != -1)">
        <input
          :class="{ 'cursor-pointer': field.status !== 0 }"
          :id="(field.field as string)"
          type="checkbox"
          v-model="item[field.field]"
          @change="changed"
          :disabled="field.status == 0"
        />
        <label
          :class="{ 'cursor-pointer': field.status !== 0, gray: field.status == 0, hastooltip: Boolean(field.title) }"
          :for="(field.field as string)"
          :title="field.title"
        >
          {{ field.name }}
        </label>
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
interface BooleanField {
  name: string;
  status: number;
  field: keyof (Base & EditorBase);
  title?: string;
}
export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<Base & EditorBase>,
      required: true,
    },
  },

  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },

  computed: {
    fields() {
      return [
        {
          name: "Hidden",
          status: this.hidden,
          field: "hidden",
        },
        {
          name: "Collective",
          status: this.collective,
          field: "collective",
          title: "indicates that multiple instances of this entry may be combined into one entry with an amount",
        },
        {
          name: "Import",
          status: this.eimport,
          field: "import",
          title: "Indicates that this entry may be imported by other catalogues",
        },
        {
          name: "Flatten",
          status: this.flatten,
          field: "flatten",
          title: "If this is checked, the group box for this entry/group will not be visible in the New Recruit UI.",
        },
        {
          name: "Collapsible",
          status: this.collapsible,
          field: "collapsible",
          title:
            "If this is checked, the group box for this entry/group will show as a collapsible box even if it has less than 5 items.",
        },
      ] as BooleanField[];
    },

    hidden() {
      return true;
    },

    flatten() {
      if (this.item.editorTypeName === "selectionEntry") {
        return 1;
      }
      if (this.item.editorTypeName === "selectionEntryLink") {
        return 1;
      }
      if (this.item.editorTypeName === "selectionEntryGroup") {
        return 1;
      }
      if (this.item.editorTypeName === "selectionEntryGroupLink") {
        return 1;
      }
      return -1;
    },

    collapsible() {
      if (this.item.editorTypeName === "selectionEntry") {
        return 1;
      }
      if (this.item.editorTypeName === "selectionEntryLink") {
        return 1;
      }
      if (this.item.editorTypeName === "selectionEntryGroup") {
        return 1;
      }
      if (this.item.editorTypeName === "selectionEntryGroupLink") {
        return 1;
      }
      return -1;
    },

    collective() {
      if (this.item.parent?.isCatalogue()) {
        const parentkey = this.item.parentKey;
        if (parentkey === "selectionEntries" || parentkey === "entryLinks") return 0;
      }

      switch (this.item.editorTypeName) {
        case "selectionEntryLink":
          return 1;
        case "selectionEntryGroupLink":
          return 1;
        case "selectionEntry":
          return 1;
        case "selectionEntryGroup":
          return 1;

        case "categoryLink":
          return -1;

        case "infoLink":
          return -1;
        case "profileLink":
          return -1;
        case "ruleLink":
          return -1;
        case "infoGroupLink":
          return -1;
      }
      return 1;
    },

    eimport() {
      if (this.item.parent?.isCatalogue()) {
        return 1;
      }

      switch (this.item.editorTypeName) {
        case "selectionEntryLink":
          return 0;
        case "selectionEntryGroupLink":
          return 0;
        case "selectionEntry":
          return 0;
        case "selectionEntryGroup":
          return 0;

        case "categoryLink":
          return -1;

        case "infoLink":
          return -1;
        case "profileLink":
          return -1;
        case "ruleLink":
          return -1;
        case "infoGroupLink":
          return -1;
      }
      return 0;
    },
  },
};
</script>

<style scoped lang="scss">
.booleans {
  display: flex;

  > div {
    margin-right: 10px;

    &:last-child {
      margin-right: 0;
    }
  }
}
</style>
