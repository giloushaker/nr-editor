<template>
  <fieldset>
    <legend>Modifier</legend>
    <div class="modifier">
      <select
        v-if="selectedOperation"
        v-model="selectedOperation"
        @change="changed"
      >
        <option :value="operation" v-for="operation of operations">
          {{ operation.name }}
        </option>
      </select>

      <select v-model="selectedField" @change="fieldChanged">
        <option :value="field" v-for="field of fieldData">
          {{ field.name }}
        </option>
      </select>

      <span v-if="selectedOperation"> {{ selectedOperation.word }} </span>
      <UtilNumberInput
        @change="changed"
        v-if="selectedField && selectedField.type == 'number'"
        v-model="item.value"
      />
      <select
        @change="changed"
        v-if="selectedField && selectedField.type == 'boolean'"
        v-model="item.value"
      >
        <option :value="true">True</option>
        <option :value="false">False</option>
      </select>
      <input
        @change="changed"
        type="text"
        v-if="selectedField && selectedField.type == 'string'"
        v-model="item.value"
      />

      <select
        v-if="selectedField && selectedField.type == 'category'"
        v-model="item.value"
        @change="changed"
      >
        <option :value="cat.id" v-for="cat of allCategories">
          {{ cat.name }}
        </option>
      </select>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { ItemTypes, getName } from "~/assets/shared/battlescribe/bs_editor";
import { Base, Category, Link } from "~/assets/shared/battlescribe/bs_main";
import {
  Catalogue,
  EditorBase,
} from "~/assets/shared/battlescribe/bs_main_catalogue";
import {
  BSIConstraint,
  BSIModifier,
  BSIModifierType,
} from "~/assets/shared/battlescribe/bs_types";

type FieldTypes = "string" | "number" | "category" | "boolean";

export default {
  emits: ["catalogueChanged"],
  data() {
    return {
      value: "",
      selectedField: null as {
        id: string;
        name: string;
        type: FieldTypes;
      } | null,
      selectedOperation: null as {
        word: string;
        id: BSIModifierType;
        name: string;
      } | null,
      selectedValue: null as any,
      availableModifiers: {
        selectionEntry: [
          "costs",
          "name",
          "page",
          "hidden",
          "category",
          "constraints",
        ],
        entryLink: [
          "costs",
          "name",
          "page",
          "hidden",
          "category",
          "constraints",
        ],
        profile: ["name", "description", "page", "hidden"],
        rule: ["name", "description", "page", "hidden"],
        infoLink: ["name", "description", "page", "hidden"],
        force: ["name", "page", "hidden", "constraints"],
        category: ["name", "page", "hidden", "constraints"],
      } as any,

      availableTypes: {
        costs: "number",
        name: "string",
        page: "string",
        hidden: "boolean",
        description: "string",
        category: "category",
        constraints: "number",
      } as Record<string, FieldTypes>,
    };
  },

  created() {
    this.update();
  },

  props: {
    item: {
      type: Object as PropType<BSIModifier>,
      required: true,
    },

    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },

  methods: {
    changed() {
      if (this.selectedField) {
        this.item.field = this.selectedField.id;
      }
      if (this.selectedOperation) {
        this.item.type = this.selectedOperation.id;
      }
      this.$emit("catalogueChanged");
    },

    fieldChanged() {
      this.selectedOperation = this.operations[0];
      if (this.selectedField) {
        this.item.value = {
          number: 0,
          category: this.allCategories[0].id,
          string: "",
          boolean: false,
        }[this.selectedField.type];
      }
      this.changed();
    },

    update() {
      this.selectedField =
        this.fieldData.find((elt) => elt.id === this.item.field) || null;
      this.selectedOperation =
        this.operations.find((op) => op.id === this.item.type) || null;

      if (!this.selectedField) {
        this.selectedField = this.fieldData[0];
      }

      if (!this.selectedOperation) {
        this.selectedOperation = this.operations[0] || null;
      }
    },
  },

  watch: {
    item() {
      this.update();
    },
  },

  computed: {
    parent() {
      return (this.item as any as EditorBase).parent as ItemTypes;
    },

    allCategories(): Category[] {
      let res: Category[] = [];
      for (let elt of this.catalogue.iterateCategoryEntries()) {
        res.push(elt);
      }
      return res;
    },

    operations(): { id: BSIModifierType; name: string; word: string }[] {
      if (!this.selectedField) {
        return [];
      }

      let ops: Record<
        string,
        { id: BSIModifierType; name: string; word: string }[]
      > = {
        number: [
          {
            id: "set",
            name: "Set",
            word: "to",
          },
          {
            id: "increment",
            name: "Increment",
            word: "by",
          },
          {
            id: "decrement",
            name: "Decrement",
            word: "by",
          },
        ],
        string: [
          {
            id: "set",
            name: "Set",
            word: "to",
          },
          {
            id: "append",
            name: "Append",
            word: "to",
          },
        ],
        boolean: [
          {
            id: "set",
            name: "Set",
            word: "to",
          },
        ],

        category: [
          {
            id: "add",
            name: "Add",
            word: "",
          },
          {
            id: "remove",
            name: "Remove",
            word: "",
          },
          {
            id: "set-primary",
            name: "Set Primary",
            word: "to",
          },
          {
            id: "unset-primary",
            name: "Unset Primary",
            word: "to",
          },
        ],
      };
      return ops[this.selectedField.type];
    },

    fieldData() {
      let available: string[] =
        this.availableModifiers[this.parent.editorTypeName];

      const additional: { id: string; name: string; type: FieldTypes }[] = [];

      if (!available) {
        return [];
      }
      if (available.includes("costs")) {
        if (this.catalogue.costTypes) {
          additional.push(
            ...this.catalogue.costTypes.map((costType) => {
              return {
                id: costType.id,
                name: costType.name,
                type: "number" as FieldTypes,
              };
            })
          );
        }
      }

      if (available.includes("constraints")) {
        const constraints: BSIConstraint[] = (this.parent as any).constraints;

        if (constraints) {
          const mapped = constraints.map((constraint) => {
            return {
              id: constraint.id,
              name: getName(constraint),
              type: "number" as FieldTypes,
            };
          });
          additional.push(...mapped);
        }
      }

      if (available.includes("category")) {
        additional.push({
          id: "category",
          name: "Category",
          type: "category",
        });
      }

      // Filter out special fields
      available = available.filter(
        (elt) => ["costs", "constraints", "category"].includes(elt) == false
      );

      return available
        .map((elt) => {
          return {
            id: elt,
            name: elt,
            type: this.availableTypes[elt],
          };
        })
        .concat(additional);
    },
  },
};
</script>

<style scoped lang="scss">
.modifier {
  display: grid;
  grid-template-columns: auto auto auto 1fr;
  grid-gap: 5px;
  align-items: center;
}
</style>
