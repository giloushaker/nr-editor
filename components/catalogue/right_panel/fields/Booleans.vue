<template>
  <fieldset>
    <legend><slot></slot></legend>
    <div class="booleans">
      <div v-for="field of fields.filter((f) => f.status != -1)">
        <input
          :id="field.field"
          type="checkbox"
          v-model="item[field.field]"
          @change="changed"
          :disabled="field.status == 0"
        />
        <label :class="{ gray: field.status == 0 }" :for="field.field">{{ field.name }}</label>
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

type PossibleFields = "hidden" | "collective" | "import";

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
        },
        {
          name: "Import",
          status: this.eimport,
          field: "import",
        },
      ] as {
        name: string;
        status: number;
        field: keyof (Base & EditorBase);
      }[];
    },

    hidden() {
      return true;
    },

    collective() {
      if (this.item.parentKey === "selectionEntries" && this.item.parent?.isCatalogue()) {
        return 0;
      }

      switch (this.item.editorTypeName) {
        case "categoryLink":
          return -1;
        case "selectionEntryLink":
          return 0;
        case "selectionEntryGroupLink":
          return 1;
        case "selectionEntry":
          return 1;
        case "selectionEntryGroup":
          return 1;
      }
      return 1;
    },

    eimport() {
      switch (this.item.editorTypeName) {
        case "categoryLink":
          return -1;
        case "selectionEntryLink":
          return 1;
        case "selectionEntryGroupLink":
          return 1;
        case "selectionEntry":
          return 0;
        case "selectionEntryGroup":
          return 0;
      }
      return 1;
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
