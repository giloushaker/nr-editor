<template>
  <input
    v-if="type === 'checkbox'"
    type="checkbox"
    :checked="Boolean(current)"
    :disabled="disabled"
    @change="commit(($event.target as HTMLInputElement).checked)"
  />

  <select v-else-if="type === 'select'" :disabled="disabled" @change="commit(readSelect($event))">
    <option v-for="option of normalizedOptions" :key="String(option.value)" :selected="option.value === current">
      {{ option.label }}
    </option>
  </select>

  <textarea
    v-else-if="type === 'textarea'"
    :value="(current as string) ?? ''"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="commit(read($event))"
    @blur="store.end_field_edit()"
  />

  <input
    v-else
    :type="type"
    :value="current ?? ''"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="commit(read($event))"
    @blur="store.end_field_edit()"
  />
</template>

<script lang="ts">
import { useEditorStore } from "~/stores/editorStore";
import { fieldControlProps, fieldValue } from "./props";

export type { FieldOption } from "./props";

/**
 * The control half of an editable field. Split from EditorField so the row wrapper and the
 * bare form share one implementation -- and so a grid can reuse it as a cell.
 *
 * Writes go to store.set_field, never to the node, which is what gives the edit an undo
 * entry and triggers revalidation.
 */
export default {
  name: "EditorFieldControl",
  setup() {
    return { store: useEditorStore() };
  },
  props: fieldControlProps,

  computed: {
    current(): unknown {
      const value = fieldValue(this.item, this.field);
      return value === undefined ? this.default : value;
    },
    normalizedOptions(): Array<{ value: unknown; label: string }> {
      return this.options.map((o) =>
        typeof o === "object" && o !== null
          ? { value: o.value, label: o.label ?? String(o.value) }
          : { value: o, label: String(o) },
      );
    },
  },

  methods: {
    commit(value: unknown) {
      this.store.set_field(this.item, this.field, value, { default: this.default });
      // Toggles and picks are discrete: each one is its own undo step.
      if (this.type === "checkbox" || this.type === "select") this.store.end_field_edit();
    },
    read(event: Event): unknown {
      const value = (event.target as HTMLInputElement).value;
      if (value === "") return undefined;
      return this.type === "number" ? Number(value) : value;
    },
    /** Options render their label as text, so map the picked index back to the real value. */
    readSelect(event: Event): unknown {
      return this.normalizedOptions[(event.target as HTMLSelectElement).selectedIndex]?.value;
    },
  },
};
</script>
