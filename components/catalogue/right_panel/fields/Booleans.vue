<template>
  <fieldset>
    <legend>
      <slot></slot>
    </legend>
    <div class="booleans">
      <div v-for="field of fields.filter((f) => f.status != -1)">
        <img v-if="isDifferentOnTarget(field)" :title="`${String(field.field)} is ${Boolean(item.target![field.field])} on target`" style="vertical-align: text-top; margin-left: 4px; margin-top: 1px" class="typeIcon" src="assets/bsicons/link.png" />
        <input :class="{ 'cursor-pointer': field.status !== 0 }" :id="(field.field as string)" type="checkbox" :checked="getCheckedValue(field)" @change="handleChange($event, field)" :disabled="field.status == 0" />
        <label :class="{ 'cursor-pointer': field.status !== 0, gray: field.status == 0, hastooltip: Boolean(field.title) }" :for="(field.field as string)" :title="field.title">
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

enum BOOLEAN_STATUS {
  UNAVAILABLE = -1,
  DISABLED = 0,
  AVAILABLE = 1,
}
interface BooleanField {
  name: string;
  status: BOOLEAN_STATUS;
  field: "hidden" | "exportable" | "import" | "flatten" | "collapsible" | "collective";
  title?: string;
  default?: boolean;
}
export default {
  props: {
    item: {
      type: Object as PropType<Base & EditorBase>,
      required: true,
    },
  },

  methods: {
    isDifferentOnTarget(field: BooleanField) {
      if (!this.item.target) return false;
      const selfValue = this.item[field.field] ?? field.default
      const targetValue = this.item.target[field.field] ?? field.default
      if (selfValue === targetValue) return false;
      return targetValue !== field.default
    },
    getCheckedValue(field: BooleanField) {
      if (this.item[field.field] === undefined) {
        return field.default ?? false
      }
      return Boolean(this.item[field.field]);
    },
    handleChange(event: Event, field: BooleanField) {
      const target = event.target as HTMLInputElement;
      if (target.checked === field.default) {
        delete this.item[field.field];
      } else {
        this.item[field.field] = target.checked;
      }
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
          default: false,
        },
        {
          name: "Import",
          status: this.import,
          field: "import",
          title: "If this is checked, may be imported by other catalogues",
          default: true,
        },
        {
          name: "Flatten",
          status: this.flatten,
          field: "flatten",
          title: "If this is checked, the group box will not be displayed.",
          default: false,
        },
        {
          name: "Collapsible",
          status: this.collapsible,
          field: "collapsible",
          title: "If this is checked, the group box will always be collapsible",
          default: false,
        },
        {
          name: "Exportable",
          status: this.exportable,
          field: "exportable",
          title: "prevents from showing up in various exports if unchecked",
          default: true,
        },
      ] as BooleanField[];
    },

    hidden() {
      return true;
    },

    flatten() {
      if (this.item.editorTypeName === "selectionEntryGroup") {
        return 1;
      }
      if (this.item.editorTypeName === "selectionEntryGroupLink") {
        return 1;
      }
      return BOOLEAN_STATUS.UNAVAILABLE;
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
      return BOOLEAN_STATUS.UNAVAILABLE;
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
      }
      return BOOLEAN_STATUS.UNAVAILABLE;
    },

    exportable() {
      return 1;
    },

    import() {
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
          return BOOLEAN_STATUS.UNAVAILABLE;
        case "infoLink":
          return BOOLEAN_STATUS.UNAVAILABLE;
        case "profileLink":
          return BOOLEAN_STATUS.UNAVAILABLE;
        case "ruleLink":
          return BOOLEAN_STATUS.UNAVAILABLE;
        case "infoGroupLink":
          return BOOLEAN_STATUS.UNAVAILABLE;
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
