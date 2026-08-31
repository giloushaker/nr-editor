<template>
  <!--
    `compact` lays the label beside the control instead of above it, for the run cards, where a
    row of arguments has to fit on one line next to the Run button. The controls are identical.
  -->
  <div
    class="script-arg"
    :class="{ compact, 'is-check': type === 'boolean' || type === 'toggle', 'has-col': !!labelWidth }"
  >
    <span class="label" :style="labelWidth ? { width: labelWidth, textAlign: 'right', flex: 'none' } : undefined">
      <span class="p-2px">{{ arg.name ?? type }}</span
      ><span v-if="!arg.optional">*</span>
      <span class="muted" v-if="arg.description && !compact">{{ arg.description }}</span>
    </span>

    <template v-if="type === 'catalogue[]'">
      <UtilAutocomplete
        v-model="value"
        :options="[{ label: 'All Catalogues' }, ...system.getAllCatalogueFiles()]"
        :valueField="(o: Record<string, string> & BSIData) => o.label ?? catalogueName(o)"
        :filterField="(o: Record<string, string> & BSIData) => o.label ?? catalogueName(o)"
        class="max-w-300px w-100%"
      >
        <template #option="{ option }">
          <div style="white-space: nowrap">
            <template v-if="option.label">
              <img class="mr-1 align-middle" src="/assets/bsicons/bullet.png" />{{ option.label }}
            </template>
            <template v-else>
              <img class="mr-1 align-middle" src="/assets/bsicons/catalogue.png" />
              {{ catalogueName(option) }}
            </template>
          </div>
        </template>
      </UtilAutocomplete>
    </template>

    <template v-else-if="type === 'catalogue'">
      <UtilAutocomplete
        v-model="value"
        :options="system.getAllCatalogueFiles()"
        :valueField="(o: Record<string, string> & BSIData) => o.label ?? catalogueName(o)"
        :filterField="(o: Record<string, string> & BSIData) => o.label ?? catalogueName(o)"
        class="max-w-300px w-100%"
      >
        <template #option="{ option }">
          <div style="white-space: nowrap">
            <img class="mr-1 align-middle" src="/assets/bsicons/catalogue.png" />
            {{ catalogueName(option) }}
          </div>
        </template>
      </UtilAutocomplete>
    </template>

    <!-- A fixed list of choices. `options` may be strings or {label, value}, or a function
         returning either, for choices that depend on what is loaded. -->
    <template v-else-if="type === 'select'">
      <select v-model="value" class="w-100% max-w-300px">
        <option v-if="arg.optional" :value="undefined"></option>
        <option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
      </select>
    </template>

    <template v-else-if="type === 'number'">
      <input type="number" v-model.number="value" :min="arg.min" :max="arg.max" :step="arg.step ?? 'any'" />
    </template>

    <template v-else-if="type === 'boolean' || type === 'toggle'">
      <input type="checkbox" v-model="value" :id="inputId" />
      <label :for="inputId">{{ arg.name }}</label>
    </template>

    <!-- Multi-line. EditableDiv is a contenteditable, so it cannot carry a placeholder or a
         row count; a textarea is the native control for this and needs no help. -->
    <template v-else-if="type === 'text'">
      <textarea v-model="value" :placeholder="arg.placeholder" spellcheck="false" rows="5" class="w-100% mono" />
    </template>

    <template v-else-if="type === 'file'">
      <input type="file" @input="onFileSelected" />
    </template>

    <!-- Whatever is selected in the tree right now, resolved when Run is pressed rather than
         when the panel rendered. -->
    <template v-else-if="type === 'selection' || type === 'selection[]'">
      <span class="muted">{{ selectionLabel }}</span>
    </template>

    <template v-else>
      <EditableDiv v-model="value" spellcheck="false" style="font-family: monospace" />
    </template>
  </div>
</template>
<script lang="ts">
import type { PropType } from "vue";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import type { BSIData } from "~/assets/shared/battlescribe/bs_types";
import type { ScriptArg } from "~/stores/scriptsStore";
import { useEditorStore } from "~/stores/editorStore";
import EditableDiv from "../util/EditableDiv.vue";

let ids = 0;

export default defineComponent({
  components: { EditableDiv },
  props: {
    arg: {
      type: Object as PropType<ScriptArg>,
      required: true,
    },
    args: {
      type: Array,
      required: true,
    },
    system: {
      type: GameSystemFiles,
      required: true,
    },
    index: {
      type: Number,
      required: true,
    },
    /** Label beside the control rather than above it; see the template. */
    compact: Boolean,
    /**
     * Fixed label column, right-aligned -- what the expanded argument panel uses so several
     * arguments line their controls up. Without it a compact label is only as wide as its text.
     */
    labelWidth: { type: String, default: "" },
    /** The value this argument was last run with; beats `arg.default`. */
    initial: { default: undefined as any },
  },

  setup() {
    return { store: useEditorStore() };
  },

  data() {
    return { value: undefined as any, inputId: `script-arg-${ids++}` };
  },

  created() {
    this.value = this.getDefaultValue();
  },

  methods: {
    catalogueName(catalogue: BSIData) {
      return getDataObject(catalogue).name;
    },
    async getArgument() {
      return await this.store.scripts.resolve_arg(this.system, this.type, this.value);
    },
    async updateArgument() {
      const val = await this.getArgument();
      this.args[this.index] = val;
      return val;
    },
    /** The raw widget value, for remembering what the script was last run with. */
    rawValue() {
      // A file's value is its whole text; remembering that would bloat localStorage for nothing,
      // and the file picker cannot be prefilled anyway.
      return this.type === "file" ? undefined : this.value;
    },
    getDefaultValue() {
      if (this.initial !== undefined) return this.initial;
      if (this.arg.default !== undefined) return this.arg.default;
      if (this.type === "catalogue[]") return "All Catalogues";
      if (this.type === "boolean" || this.type === "toggle") return false;
      // A select with no default lands on its first choice, so Run never passes undefined for
      // a required argument just because nobody touched the dropdown.
      if (this.type === "select" && !this.arg.optional) return this.options[0]?.value;
      return undefined;
    },
    onFileSelected(event: any) {
      const input_files = [...((event.target?.files as any | null) || [])];
      // `file.text()` returns a promise; the value used to be the promise itself, so a script
      // asking for a file got a Promise it never awaited.
      for (const file of input_files) {
        file.text().then((text: string) => (this.value = text));
      }
    },
  },
  computed: {
    /**
     * The editor to render. An array used to render *every* type at once, all bound to the same
     * value, while getArgument only ever read the first -- so `type: ["string", "boolean"]` drew
     * a textbox and a checkbox that fought over one value. The first entry wins, once.
     */
    type(): string {
      return Array.isArray(this.arg.type) ? this.arg.type[0] : this.arg.type;
    },
    options(): Array<{ label: string; value: any }> {
      const raw = typeof this.arg.options === "function" ? this.arg.options() : this.arg.options;
      return (raw ?? []).map((o) => (o && typeof o === "object" ? o : { label: String(o), value: o }));
    },
    selectionLabel(): string {
      const selections = this.store.get_selections();
      if (!selections.length) return "nothing selected";
      if (this.type === "selection") return this.store.label(selections[0]);
      return `${selections.length} selected`;
    },
  },
});
</script>
<style lang="scss" scoped>
@use "@/shared_components/css/vars.scss" as *;

.script-arg {
  margin-bottom: 4px;

  textarea,
  select,
  input[type="number"] {
    max-width: 300px;
  }

  &.compact {
    margin-bottom: 0;
    display: flex;
    align-items: center;
    gap: 6px;

    .label {
      white-space: nowrap;
      font-size: 13px;
    }

    /* A boolean already draws its own label after the box, so the leading one is a duplicate. */
    &.is-check > .label {
      display: none;
    }

    /* Except in an aligned column, where it still has to hold the column open. */
    &.is-check.has-col > .label {
      display: block;
      visibility: hidden;
    }

    input[type="number"] {
      width: 70px;
    }

    :deep(.autocomplete),
    :deep(.autocomplete-input) {
      width: 180px;
    }
  }
}

.mono {
  font-family: monospace;
}

/* opacity, not the global `.gray`: that is a hardcoded #808080 and fails on the dark theme. */
.muted {
  opacity: 0.75;
}
</style>
