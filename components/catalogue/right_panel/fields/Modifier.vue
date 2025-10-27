<template>
  <fieldset>
    <legend>Modifier</legend>
    <div class="modifier">
      <select v-if="selectedOperation" v-model="selectedOperation" @change="changed">
        <option :value="operation" v-for="operation of operations">
          {{ operation.name }}
        </option>
      </select>
      <UtilIconSelect class="select" v-model="selectedField" :fetch="() => fieldData" @change="fieldChanged">
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
          {{ selectedOperation.word }}
          <UtilEditableDiv class="inline-block" @change="changed" type="text" v-model="item.value" />
        </div>
        <div>
          separate by:
          <UtilEditableDiv class="inline-block" @change="changed" type="text" v-model="join" />
          (<span class="cost !m-0 whitespace-pre" v-if="join.length">{{ join.replace("\n", "\\n") }}</span>
          <span v-else>nothing</span>)
        </div>
      </template>
      <template v-else>
        <span v-if="selectedOperation"> {{ selectedOperation.word }} </span>
        <UtilNumberInput
          @change="changed"
          v-if="inputType === 'number'"
          v-model="(item.value as number)"
          style="width: 60px; margin-left: 3px"
        />
        <select @change="changed" v-if="inputType == 'boolean'" v-model="item.value">
          <option :value="true">True</option>
          <option :value="false">False</option>
        </select>
        <UtilEditableDiv
          @change="changed"
          type="text"
          v-if="inputType.includes('string')"
          v-model="item.value"
          style="min-width: 200px"
        />

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
      <template
        v-if="
          selectedOperation?.id &&
          selectedField?.type &&
          ['replace', 'increment', 'decrement', 'multiply', 'divide', 'modulo', 'floor', 'ceil'].includes(
            selectedOperation.id
          ) &&
          ['string', 'string-or-number'].includes(selectedField.type)
        "
      >
        <div>
          <span>
            <span class="hastooltip" title="1-Based index of the match to affect. supports negative indexes. 0 = All">
              position:
            </span>
            <input @change="changed" type="number" v-model="item.position" style="width: 60px; margin-left: 3px" />
          </span>
        </div>
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
import { Category, deconstruct_affects_query, Profile, ProfileType } from "~/assets/shared/battlescribe/bs_main";
import { type EditorBase, Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { BSIModifier, BSIModifierType } from "~/assets/shared/battlescribe/bs_types";
import ErrorIcon from "~/components/ErrorIcon.vue";
import { first } from "~/assets/shared/battlescribe/bs_helpers";
import { set } from "nuxt/dist/app/compat/capi";
import EditableDiv from "~/components/util/EditableDiv.vue";

type FieldTypes =
  | "string"
  | "number"
  | "category"
  | "boolean"
  | "string-or-number"
  | "defaultSelectionEntryId"
  | "defaultAmount"
  | "error"
  | "warning"
  | "info";
const availableModifiers: Record<string, string[]> = {
  selectionEntry: [
    "costs",
    "name",
    "annotation",
    "page",
    "hidden",
    "category",
    "constraints",
    "defaultAmount",
    "error",
    "warning",
    "info",
  ],
  selectionEntryLink: [
    "costs",
    "name",
    "annotation",
    "page",
    "hidden",
    "category",
    "constraints",
    "defaultAmount",
    "error",
    "warning",
    "info",
  ],
  selectionEntryGroup: [
    "name",
    "annotation",
    "page",
    "hidden",
    "category",
    "constraints",
    "defaultSelectionEntryId",
    "error",
    "warning",
    "info",
  ],
  selectionEntryGroupLink: [
    "name",
    "annotation",
    "page",
    "hidden",
    "category",
    "constraints",
    "defaultSelectionEntryId",
    "error",
    "warning",
    "info",
  ],
  anyProfile: ["name", "annotation", "page", "hidden"],
  anyEntry: ["name", "costs", "category", "annotation", "page", "hidden", "error", "warning", "info"],
  profile: ["characteristics", "name", "annotation", "page", "hidden"],
  profileLink: ["characteristics", "name", "annotation", "description", "page", "hidden"],
  rule: ["name", "annotation", "description", "page", "hidden"],
  ruleLink: ["name", "annotation", "description", "page", "hidden"],
  infoLink: ["name", "annotation", "page", "hidden"],
  infoGroup: ["name", "annotation", "page", "hidden"],
  infoGroupLink: ["name", "annotation", "page", "hidden"],
  forceEntry: ["name", "annotation", "page", "hidden", "constraints", "costs", "error", "warning", "info", "readme"],
  forceEntryLink: [
    "name",
    "annotation",
    "page",
    "hidden",
    "constraints",
    "costs",
    "error",
    "warning",
    "info",
    "readme",
  ],
  categoryEntry: ["name", "page", "hidden", "constraints"],
  categoryEntryLink: ["name", "page", "hidden", "constraints"],
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
  error: "string",
  warning: "string",
  info: "string",
} as Record<string, FieldTypes>;
const nonBullet = new Set(["cost", "categories", "constraints", "characteristics", "error", "warning", "info"]);

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

// Operation constants
const OPERATION_SET: Operation = { id: "set", name: "Set", word: "to" };
const OPERATION_MULTIPLY: Operation = { id: "multiply", name: "Multiply", word: "by" };
const OPERATION_DIVIDE: Operation = { id: "divide", name: "Divide", word: "by" };
const OPERATION_MODULO: Operation = { id: "modulo", name: "Modulo", word: "by" };
const OPERATION_INCREMENT: Operation = { id: "increment", name: "Increment", word: "by" };
const OPERATION_DECREMENT: Operation = { id: "decrement", name: "Decrement", word: "by" };
const OPERATION_CEIL: Operation = { id: "ceil", name: "Ceil", word: "to" };
const OPERATION_FLOOR: Operation = { id: "floor", name: "Floor", word: "to" };
const OPERATION_APPEND: Operation = { id: "append", name: "Append", word: "with" };
const OPERATION_PREPEND: Operation = { id: "prepend", name: "Prepend", word: "with" };
const OPERATION_REPLACE: Operation = { id: "replace", name: "Replace", word: "with" };
const OPERATION_ADD: Operation = { id: "add", name: "Add", word: "" };
const OPERATION_ADD_ERROR: Operation = { id: "add", name: "Add", word: "message:" };
const OPERATION_ADD_WARNING: Operation = { id: "add", name: "Add", word: "message:" };
const OPERATION_ADD_INFO: Operation = { id: "add", name: "Add", word: "message:" };
const OPERATION_REMOVE: Operation = { id: "remove", name: "Remove", word: "" };
const OPERATION_SET_PRIMARY: Operation = { id: "set-primary", name: "Set Primary", word: "to" };
const OPERATION_UNSET_PRIMARY: Operation = { id: "unset-primary", name: "Unset Primary", word: "to" };
const OPERRATION_HIDE: Operation = { id: "hide", name: "Hide", word: "" };

const operations = {
  number: [
    OPERATION_SET,
    OPERATION_INCREMENT,
    OPERATION_DECREMENT,
    OPERATION_MULTIPLY,
    OPERATION_DIVIDE,
    OPERATION_MODULO,
    OPERATION_CEIL,
    OPERATION_FLOOR,
  ],
  string: [OPERATION_SET, OPERATION_APPEND, OPERATION_PREPEND, OPERATION_REPLACE],
  "string-or-number": [
    OPERATION_SET,
    OPERATION_APPEND,
    OPERATION_PREPEND,
    OPERATION_REPLACE,
    OPERATION_INCREMENT,
    OPERATION_DECREMENT,
    OPERATION_MULTIPLY,
    OPERATION_DIVIDE,
    OPERATION_MODULO,
    OPERATION_CEIL,
    OPERATION_FLOOR,
  ],
  boolean: [OPERATION_SET],
  defaultSelectionEntryId: [OPERATION_SET],
  category: [OPERATION_ADD, OPERATION_REMOVE, OPERATION_SET_PRIMARY, OPERATION_UNSET_PRIMARY],
  defaultAmount: [OPERATION_SET],
  error: [OPERATION_ADD_ERROR],
  warning: [OPERATION_ADD_WARNING],
  info: [OPERATION_ADD_INFO],
} as Record<string, Operation[]>;

type PossibleTypes = keyof typeof availableTypes;

export default {
  components: { ErrorIcon },

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
          return typeof currentValue === "number" ? String(currentValue) : "0";
        case "error":
        case "warning":
        case "info":
          return currentValue && typeof currentValue === "string" ? currentValue : "{this} is not allowed";
        default:
          throw Error(`fieldType "${fieldType}" has no default value set"`);
      }
    },
    fieldChanged() {
      this.selectedOperation = this.operations.find((o) => o.id === this.selectedOperation?.id) || this.operations[0];
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
    position: {
      get() {
        return this.item.position;
      },
      set(val: number | string) {
        this.item.position = val === "" ? undefined : Number(val);
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
      return operations[this.selectedField.type] || [];
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
        const what = deconstruct_affects_query(this.item.affects).affectsWhat || "entries";
        const split = what.split(".");
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
      if (available.includes("category")) {
        additional.push({
          id: "category",
          name: "Category",
          type: "category",
          modifierType: "category",
        });
      }
      if (available.includes("error")) {
        additional.push({
          id: "error",
          name: "Error",
          type: "error",
          modifierType: "error",
        });
      }
      if (available.includes("warning")) {
        additional.push({
          id: "warning",
          name: "Warning",
          type: "warning",
          modifierType: "warning",
        });
      }
      if (available.includes("info")) {
        additional.push({
          id: "info",
          name: "Info",
          type: "info",
          modifierType: "info",
        });
      }
      // Filter out special fields
      available = available.filter((elt) => !nonBullet.has(elt));
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

.select {
  min-width: 200px;
  max-width: fit-content;
}
</style>
