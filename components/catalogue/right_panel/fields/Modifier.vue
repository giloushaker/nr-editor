<template>
  <fieldset>
    <legend>Modifier</legend>
    <div class="modifier">
      <select v-if="selectedOperation" v-model="selectedOperation" @change="changed">
        <option :value="operation" v-for="operation of operations">
          {{ operation.name }}
        </option>
      </select>

      <UtilIconSelect v-model="selectedField" :fetch="() => fieldData" @change="fieldChanged">
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
          <span v-if="selectedOperation" class="mx-5px whitespace-nowrap">
            {{ selectedOperation.word }}
            <input @change="changed" type="text" v-model="item.value" />
          </span>
        </div>
      </template>
      <template v-else-if="selectedOperation?.id === 'append' || selectedOperation?.id === 'prepend'">
        <div class="mx-5px">
          {{ selectedOperation.word }} <input @change="changed" type="text" v-model="item.value" />
        </div>
        <div>
          separate by:
          <input @change="changed" type="text" v-model="join" /> (<span
            class="cost !m-0 whitespace-pre"
            v-if="join.length"
            >{{ join }}</span
          >
          <span v-else>nothing</span>)
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
          class="!max-w-350px"
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
          class="!max-w-350px"
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
import { Category, Profile, ProfileType } from "~/assets/shared/battlescribe/bs_main";
import { type EditorBase, Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { BSIModifier, BSIModifierType } from "~/assets/shared/battlescribe/bs_types";
import ErrorIcon from "~/components/ErrorIcon.vue";
import { first } from "~/assets/shared/battlescribe/bs_helpers";
import { set } from "nuxt/dist/app/compat/capi";

type FieldTypes =
  | "string"
  | "number"
  | "category"
  | "boolean"
  | "string-or-number"
  | "defaultSelectionEntryId"
  | "defaultAmount"
  | "error";
const availableModifiers: Record<string, string[]> = {
  selectionEntry: ["costs", "name", "annotation", "page", "hidden", "category", "constraints", "defaultAmount"],
  selectionEntryLink: ["costs", "name", "annotation", "page", "hidden", "category", "constraints", "defaultAmount"],
  selectionEntryGroup: ["name", "annotation", "page", "hidden", "category", "constraints", "defaultSelectionEntryId"],
  selectionEntryGroupLink: [
    "name",
    "annotation",
    "page",
    "hidden",
    "category",
    "constraints",
    "defaultSelectionEntryId",
  ],
  anyProfile: ["name", "annotation", "page", "hidden"],
  anyEntry: ["name", "annotation", "page", "hidden"],
  profile: ["characteristics", "name", "annotation", "page", "hidden"],
  profileLink: ["characteristics", "name", "annotation", "description", "page", "hidden"],
  rule: ["name", "annotation", "description", "page", "hidden"],
  ruleLink: ["name", "annotation", "description", "page", "hidden"],
  infoLink: ["name", "annotation", "page", "hidden"],
  infoGroup: ["name", "annotation", "page", "hidden"],
  infoGroupLink: ["name", "annotation", "page", "hidden"],
  force: ["name", "annotation", "page", "hidden", "constraints"],
  category: ["name", "page", "hidden", "constraints"],
  categoryLink: ["name", "page", "hidden", "constraints"],
  costType: ["hidden"],
};
const availableTypes = {
  costs: "number",
  name: "string",
  annotation: "string",
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
type ModifierField = {
  id: string;
  name: string;
  type: FieldTypes;
  modifierType: string;
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
  error: [
    {
      id: "add",
      name: "Add",
      word: "message:",
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
          return ["string", "number"].includes(typeof currentValue) ? currentValue : "";
        case "boolean":
          return typeof currentValue === "boolean" ? currentValue : false;
        case "defaultSelectionEntryId":
          return first(this.allGroupEntries)?.id;
        case "defaultAmount":
          return "0";
        case "error":
          return "{this} is not allowed";
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
    join: {
      get() {
        return this.item.join ?? " ";
      },
      set(val: string) {
        if (val === " ") delete this.item.join;
        this.item.join = val;
      },
    },
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
    costs(): ModifierField[] {
      const result = [];
      for (const costType of this.catalogue.iterateCostTypes()) {
        result.push({
          id: costType.id,
          name: costType.name,
          type: "number" as const,
          modifierType: "cost",
        });
      }
      return result;
    },
    constraints(): ModifierField[] {
      const result = [];
      if (!this.parent) return [];
      for (const constraint of this.parent.constraintsIterator())
        result.push({
          id: constraint.id,
          name: getName(constraint),
          type: "number" as const,
          modifierType: "constraint",
        });
      return result;
    },
    type() {
      if (this.item.affects && this.item.affects !== "self") {
        const split = this.item.affects.split(".");
        const index = split.indexOf("profiles");
        if (index !== -1) {
          const which = split[index + 1];
          if (which === undefined || which === "all") {
            return { type: "anyProfile" };
          } else if (this.parent) {
            for (const type of this.parent.getCatalogue().iterateProfileTypes()) {
              if (type.getName().toLowerCase() === which.toLowerCase()) {
                return { type: "profile", value: type };
              }
            }
          }
          return { type: "invalid" };
        }
        return { type: "anyEntry" };
      } else if (this.item.scope) {
        const found = this.parent?.getCatalogue().findOptionById(this.item.scope) as EditorBase | null;
        if (found && found.editorTypeName) {
          return { type: found.editorTypeName };
        }
      }
    },
    fieldData() {
      if (!this.parent) {
        return [];
      }
      let available: string[] = availableModifiers[this.type?.type || this.parent.editorTypeName];
      const additional: ModifierField[] = [];
      if (!available) {
        return [];
      }
      if (available.includes("costs")) {
        additional.push(...this.costs);
      }
      if (available.includes("constraints")) {
        additional.push(...this.constraints);
      }
      if (available.includes("characteristics")) {
        let target: ProfileType | Profile | undefined = this.type?.value;
        if (!target && this.parent.isProfile()) {
          target = this.parent.isLink() ? this.parent.target : this.parent;
        }
        if (target) {
          if ((target as Profile)?.characteristics) {
            additional.push(
              ...(target as Profile).characteristics.map((o) => ({
                id: o.typeId,
                name: o.name,
                type: "string-or-number" as const,
                modifierType: "characteristic",
                value: o.$text,
              }))
            );
          }
          if ((target as ProfileType)?.characteristicTypes) {
            additional.push(
              ...(target as ProfileType).characteristicTypes.map((o) => ({
                id: o.id,
                name: o.name,
                type: "string-or-number" as const,
                modifierType: "characteristic",
              }))
            );
          }
        }
      }
      if (this.type?.type === "profile" && this.type.value) {
        if (this.type.value.characteristicTypes) {
          additional.push(
            ...this.type.value.characteristicTypes.map((o) => ({
              id: o.id,
              name: o.name,
              type: "string-or-number" as const,
              modifierType: "characteristic",
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
      if (true || available.includes("error")) {
        additional.push({
          id: "error",
          name: "Error",
          type: "error",
          modifierType: "error",
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
  display: flex;
  gap: 5px;
  align-items: center;
  flex-wrap: wrap;
}
</style>
