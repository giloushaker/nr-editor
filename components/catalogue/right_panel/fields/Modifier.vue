<template>
  <fieldset>
    <legend>Modifier</legend>
    <div class="modifier">
      <select v-if="selectedOperation" v-model="selectedOperation" @change="changed">
        <option :value="operation" v-for="operation of operations">
          {{ operation.name }}
        </option>
      </select>

      <UtilIconSelect
        v-model="selectedField"
        :fetch="() => fieldData"
        @change="fieldChanged"
        class="modType min-w-200px"
      >
        <template #option="opt">
          <div class="flex align-items flex-row">
            <img class="mr-1 my-auto" :src="`assets/bsicons/${opt.option.modifierType}.png`" /><span class="inline">{{
              opt.option.name
            }}</span>
          </div>
        </template>
      </UtilIconSelect>

      <template v-if="selectedOperation?.id == 'replace'">
        <div>
          <input @change="changed" type="text" v-model="item.arg" placeholder="text to replace" />
          <span v-if="selectedOperation" class="mx-5px"> {{ selectedOperation.word }} </span>
          <input @change="changed" type="text" v-model="item.value" />
        </div>
      </template>
      <template v-else>
        <span v-if="selectedOperation"> {{ selectedOperation.word }} </span>
        <UtilNumberInput @change="changed" v-if="inputType === 'number'" v-model="(item.value as number)" />
        <select @change="changed" v-if="inputType == 'boolean'" v-model="item.value">
          <option :value="true">True</option>
          <option :value="false">False</option>
        </select>
        <input @change="changed" type="text" v-if="inputType.includes('string')" v-model="item.value" />

        <UtilAutocomplete
          v-if="inputType == 'category'"
          :options="allCategories"
          :filterField="(o) => o.getName()"
          valueField="id"
          v-model="item.value"
          @change="changed"
        >
          <template #option="{ option }">
            <div class="flex align-items flex-row" style="white-space: nowrap">
              <img class="mr-1 my-auto" :src="`assets/bsicons/${option.editorTypeName}.png`" /><span class="inline">
                {{ getName(option) }} <span class="grey">{{ getNameExtra(option) }}</span>
              </span>
            </div>
          </template>
        </UtilAutocomplete>
        <UtilAutocomplete
          v-if="inputType == 'defaultSelectionEntryId'"
          :options="allGroupEntries"
          :filterField="(o) => o.getName()"
          valueField="id"
          v-model="item.value"
          @change="changed"
        >
          <template #option="{ option }">
            <div class="flex align-items flex-row" style="white-space: nowrap">
              <img class="mr-1 my-auto" :src="`assets/bsicons/${option.editorTypeName}.png`" /><span class="inline">
                {{ getName(option) }} <span class="grey">{{ getNameExtra(option) }}</span>
              </span>
            </div>
          </template>
        </UtilAutocomplete>
      </template>
    </div>
    <div v-for="error in errors" class="mt-8px flex items-center">
      <img src="/assets/icons/error_exclamation.png" />
      <span class="ml-10px">{{ error.msg }}</span>
    </div>
  </fieldset>
</template>

<script lang="ts">
import type { PropType } from "vue";
import { getModifierOrConditionParent } from "~/assets/shared/battlescribe/bs_modifiers";
import { getName, getNameExtra } from "~/assets/shared/battlescribe/bs_editor";
import { Category, Profile } from "~/assets/shared/battlescribe/bs_main";
import { type EditorBase, Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { BSIModifier, BSIModifierType } from "~/assets/shared/battlescribe/bs_types";
import ErrorIcon from "~/components/ErrorIcon.vue";
import { first } from "~/assets/shared/battlescribe/bs_helpers";

type FieldTypes =
  | "string"
  | "number"
  | "category"
  | "boolean"
  | "string-or-number"
  | "defaultSelectionEntryId"
  | "defaultAmount";
const availableModifiers: Record<string, string[]> = {
  selectionEntry: ["costs", "name", "page", "hidden", "category", "constraints", "defaultAmount"],
  selectionEntryLink: ["costs", "name", "page", "hidden", "category", "constraints", "defaultAmount"],
  selectionEntryGroup: ["name", "page", "hidden", "category", "constraints", "defaultSelectionEntryId"],
  selectionEntryGroupLink: ["name", "page", "hidden", "category", "constraints", "defaultSelectionEntryId"],
  profile: ["characteristics", "name", "description", "page", "hidden"],
  profileLink: ["characteristics", "name", "description", "page", "hidden"],
  rule: ["name", "description", "page", "hidden"],
  ruleLink: ["name", "description", "page", "hidden"],
  infoLink: ["name", "page", "hidden"],
  infoGroup: ["name", "page", "hidden"],
  infoGroupLink: ["name", "page", "hidden"],
  force: ["name", "page", "hidden", "constraints"],
  category: ["name", "page", "hidden", "constraints"],
  categoryLink: ["name", "page", "hidden", "constraints"],
  costType: ["hidden"],
};
const availableTypes = {
  costs: "number",
  name: "string",
  page: "string",
  hidden: "boolean",
  description: "string",
  category: "category",
  defaultSelectionEntryId: "defaultSelectionEntryId",
  defaultAmount: "defaultAmount",
  constraints: "number",
} as Record<string, FieldTypes>;

type Operation = {
  id: BSIModifierType;
  name: string;
  word: string;
};
const operations = {
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
      word: "with",
    },
    {
      id: "prepend",
      name: "Prepend",
      word: "with",
    },
    {
      id: "replace",
      name: "Replace",
      word: "with",
    },
  ],
  "string-or-number": [
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
    {
      id: "prepend",
      name: "Prepend",
      word: "to",
    },
    {
      id: "replace",
      name: "Replace",
      word: "with",
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
  boolean: [
    {
      id: "set",
      name: "Set",
      word: "to",
    },
  ],
  defaultSelectionEntryId: [
    {
      id: "set",
      name: "Set",
      word: "",
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
  defaultAmount: [
    {
      id: "set",
      name: "Set",
      word: "to",
    },
  ],
} as Record<string, Operation[]>;

type PossibleTypes = keyof typeof availableTypes;

export default {
  components: { ErrorIcon },

  emits: ["catalogueChanged"],
  data() {
    return {
      value: "",
      selectedField: null as {
        id: string;
        name: string;
        type: FieldTypes;
        modifierType: string;
        value?: string | number | boolean;
      } | null,
      selectedOperation: null as {
        word: string;
        id: BSIModifierType;
        name: string;
      } | null,
      selectedValue: null as any,
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
    getName,
    getNameExtra,
    changed() {
      if (this.selectedField) {
        this.item.field = this.selectedField.id;
      }
      if (this.selectedOperation) {
        this.item.type = this.selectedOperation.id;
      }
      this.$emit("catalogueChanged");
    },
    getDefaultFieldValue(
      fieldType: PossibleTypes,
      fieldTypeName: PossibleTypes,
      currentValue: string | number | boolean | undefined
    ) {
      switch (fieldType) {
        case "number":
          return typeof currentValue === "number" ? currentValue : 0;
        case "category":
          return this.allCategories[0].id;
        case "string":
          let _default: string;
          if (fieldTypeName === "name") {
            const _item = this.item as { getName?: () => string };
            _default = _item.getName ? _item.getName() || "" : "";
          } else {
            _default = "";
          }
          return typeof currentValue === "string" ? currentValue : _default;
        case "string-or-number":
          return ["strint", "number"].includes(typeof currentValue) ? currentValue : "";
        case "boolean":
          return typeof currentValue === "boolean" ? currentValue : false;
        case "defaultSelectionEntryId":
          return first(this.allGroupEntries)?.id;
        case "defaultAmount":
          return "0";
        default:
          throw Error(`fieldType "${fieldType}" has no default value set"`);
      }
    },
    fieldChanged() {
      this.selectedOperation = this.operations[0];
      if (this.selectedField) {
        this.item.value = this.getDefaultFieldValue(this.selectedField.type, this.selectedField.name, this.item.value)!;
      }
      this.changed();
    },
    update() {
      this.selectedField = this.fieldData.find((elt) => elt.id === this.item.field) || null;
      this.selectedOperation = this.operations.find((op) => op.id === this.item.type) || null;
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
    inputType() {
      if (!this.selectedField) {
        return "";
      }
      if (this.selectedField.type === "category") {
        return "category";
      }
      if (this.selectedField.type === "defaultSelectionEntryId") {
        return "defaultSelectionEntryId";
      }
      if (this.selectedField.type === "number") {
        return "number";
      }
      if (this.selectedField.type === "boolean") {
        return "boolean";
      }
      if (this.selectedOperation?.id === "increment" || this.selectedOperation?.id === "decrement") {
        return "number";
      }
      return "string";
    },
    parent() {
      return getModifierOrConditionParent(this.item as any as EditorBase);
    },
    allCategories(): Category[] {
      let res: Category[] = [];
      for (let elt of this.catalogue.iterateCategoryEntries()) {
        res.push(elt);
      }
      return res;
    },
    allGroupEntries() {
      return [...(this.parent?.selectionsIterator() || [])];
    },
    operations(): {
      id: BSIModifierType;
      name: string;
      word: string;
    }[] {
      if (!this.selectedField) {
        return [];
      }

      return operations[this.selectedField.type];
    },
    errors() {
      return [];
    },
    fieldData() {
      if (!this.parent) {
        return [];
      }
      let available: string[] = availableModifiers[this.parent.editorTypeName];
      const additional: {
        id: string;
        name: string;
        type: FieldTypes;
        modifierType: string;
      }[] = [];
      if (!available) {
        return [];
      }
      if (available.includes("costs")) {
        for (const costType of this.catalogue.iterateCostTypes()) {
          additional.push({
            id: costType.id,
            name: costType.name,
            type: "number" as FieldTypes,
            modifierType: "cost",
          });
        }
      }
      if (available.includes("constraints")) {
        for (const constraint of this.parent.constraintsIterator())
          additional.push({
            id: constraint.id,
            name: getName(constraint),
            type: "number" as FieldTypes,
            modifierType: "constraint",
          });
      }
      if (available.includes("characteristics")) {
        const target = (this.parent.isLink() ? this.parent.target : this.parent) as Profile & EditorBase;
        if (target?.characteristics) {
          additional.push(
            ...target.characteristics.map((o) => ({
              id: o.typeId,
              name: o.name,
              type: "string-or-number" as FieldTypes,
              modifierType: "characteristic",
              value: o.$text,
            }))
          );
        }
      }
      if (available.includes("category")) {
        additional.push({
          id: "category",
          name: "Category",
          type: "category",
          modifierType: "category",
        });
      }
      // Filter out special fields
      available = available.filter((elt) => !["costs", "constraints", "category", "characteristics"].includes(elt));
      return available
        .map((elt) => {
          return {
            id: elt,
            name: elt,
            type: availableTypes[elt],
            modifierType: "bullet",
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

.modType {
  width: 100%;
}
</style>
