<template>
  <div class="query" :class="{ 'all-selected': allSelected }" @click="focus" v-click-outside="close">
    <span
      v-for="(pill, i) in pills"
      :key="i"
      class="pill"
      :class="{ negate: pill.negate, bad: pill.bad.length }"
      :title="pill.bad.length ? `Unknown key: ${pill.bad.join(', ')} — this term matches nothing` : pill.raw"
      @click.stop="edit(i)"
    >
      <span v-if="pill.negate" class="neg">{{ pill.raw[0] }}</span>
      <template v-if="pill.key">
        <span class="key">{{ pill.key }}</span>
        <span class="op">{{ pill.op }}</span>
      </template>
      <span class="val">{{ pill.value }}</span>
      <span class="x" @click.stop="remove(i)">×</span>
    </span>
    <span class="editing">
      <input
        ref="input"
        v-model="text"
        type="text"
        autocomplete="off"
        spellcheck="false"
        :placeholder="pills.length ? '' : placeholder"
        @keydown="keydown"
        @input="typed"
        @focus="open = true"
      />
      <div v-if="open && suggestions.length" class="suggestions" :class="up ? 'above' : 'below'">
        <div
          v-for="(s, i) in suggestions"
          :key="i"
          class="suggestion"
          :class="{ selected: i === active }"
          @mousedown.prevent="apply(s)"
        >
          <span class="s-label">
            <template v-for="(part, j) in highlight(s.label, s.q)" :key="j">
              <mark v-if="j === 1">{{ part }}</mark>
              <template v-else>{{ part }}</template>
            </template>
          </span>
          <span v-if="s.hint" class="s-hint">{{ s.hint }}</span>
        </div>
        <div class="suggestion help-row" @mousedown.prevent="help = true">Search syntax…</div>
      </div>
    </span>
    <span v-if="terms.length || text" class="clear" title="Clear (Ctrl+A, Backspace)" @click.stop="clear">×</span>
    <UtilQueryHelp v-if="help" @close="help = false" />
  </div>
</template>

<script lang="ts">
/**
 * The query language as pills. Committed terms render as `key:value` chips (ids shown as the
 * name they resolve to), the trailing input is the term being typed, and the dropdown offers
 * keys, then values for the key -- entries by name for the id fields, inserting the id.
 *
 * ponytail: a tag input, not Sentry's per-part editable tokens. Clicking a pill pulls its text
 * back into the input to edit; add in-place key/value editing if that ever feels clumsy.
 */
import type { PropType } from "vue";
import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { entries } from "~/assets/shared/battlescribe/entries";
import { validChildIds, validScopes } from "~/assets/shared/battlescribe/bs_condition";
import { idFields, isBalanced, isValues, NEGATION, profileKinds, queryKeys, splitTerms, unknownKeys } from "~/assets/editor/bs_search";

interface Suggestion {
  label: string;
  hint?: string;
  /** What was typed to get here, for highlighting it in the label. */
  q: string;
  /** The whole input text after applying. */
  insert: string;
  /** Whether applying finishes the term. Keys do not; values do. */
  commit: boolean;
}

const THEN_KEYS = ["by", "count", "sort", "files"];
const BOOLEANS = new Set(["shared", "link", "collective", "collapsible", "flatten", "hidden", "import", "exportable"]);
const ID_KEYS = new Set([...idFields, "id", "target"]);
const TYPES = [
  "min", "max", "set", "increment", "decrement", "append", "add", "remove",
  "atLeast", "atMost", "equalTo", "notEqualTo", "greaterThan", "lessThan", "instanceOf", "notInstanceOf",
];

/** Last index of `ch` outside quotes, or -1. */
function lastIndexOutside(s: string, ch: string): number {
  let quoted = false;
  let at = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"') quoted = !quoted;
    else if (!quoted && s[i] === ch) at = i;
  }
  return at;
}

const quote = (s: string) => (/[\s"[\]|:=]/.test(s) ? `"${s}"` : s);

/** Key terms (and negations) become pills; free words stay in the input as the phrase they were typed as. */
function partition(src: string): { terms: string[]; text: string } {
  const isTerm = (t: string) => /[:=]/.test(t) || NEGATION.test(t);
  const parts = splitTerms(src);
  return { terms: parts.filter(isTerm), text: parts.filter((t) => !isTerm(t)).join(" ") };
}

export default defineComponent({
  emits: ["update:modelValue", "submit"],
  props: {
    modelValue: { type: String, default: "" },
    catalogue: { type: Object as PropType<Catalogue>, required: true },
    placeholder: { type: String, default: "search... ctrl+f" },
    /** Open the suggestions above the box, for one that sits at the bottom of its panel. */
    up: { type: Boolean, default: false },
    /** The aggregation box: same pills, the `by:` / `count:` / `sort:` / `files:` vocabulary. */
    then: { type: Boolean, default: false },
    /** How an id in a pill becomes a name. Defaults to the catalogue; a whole-system page passes the system's. */
    resolve: { type: Function as PropType<(id: string) => { getName?: () => string } | undefined>, required: false },
  },
  data() {
    return {
      ...partition(this.modelValue),
      open: false,
      help: false,
      /** Ctrl+A on an empty input: the whole query is selected, for Ctrl+C or Backspace. */
      allSelected: false,
      active: -1,
      lastEmitted: this.modelValue,
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
  },
  computed: {
    pills() {
      return this.terms.map((raw) => {
        const negate = NEGATION.test(raw);
        const body = negate ? raw.slice(1) : raw;
        const m = /^([^:="[\]]+)([:=])(.*)$/s.exec(body);
        if (!m) return { raw, negate, key: "", op: "", value: body, bad: [] as string[] };
        const [, key, op, value] = m;
        return { raw, negate, key, op, value: this.display(value), bad: unknownKeys(raw, this.then) };
      });
    },
    suggestions(): Suggestion[] {
      const text = this.text;
      // The term being typed is the last one -- free words may sit in front of it -- and within
      // it, what follows the last `[`, since a sub-query starts a term over.
      const last = /\s$/.test(text) ? "" : (splitTerms(text).pop() ?? "");
      const fragStart = lastIndexOutside(last, "[") + 1;
      const frag = last.slice(fragStart);
      const body = /^[-!]/.test(frag) ? frag.slice(1) : frag;
      const prefix = text.slice(0, text.length - body.length);
      const m = /^([^:="]*)([:=])(.*)$/s.exec(body);
      if (!m) {
        const q = body.toLowerCase();
        return (this.then ? THEN_KEYS : queryKeys)
          .filter((k) => k.startsWith(q))
          .map((k) => ({ label: k, hint: "key", q, insert: `${prefix}${k}:`, commit: false }));
      }
      const [, key, op, rest] = m;
      const pipe = rest.lastIndexOf("|");
      const alt = rest.slice(pipe + 1);
      if (/^\/|[[\]"]/.test(alt)) return [];
      const head = `${prefix}${key}${op}${rest.slice(0, pipe + 1)}`;
      const q = alt.replace(/^[<>=]+/, "").toLowerCase();
      return this.values(key, q)
        .slice(0, 30)
        .map((v) => ({ ...v, q, insert: head + quote(v.insert), commit: true }));
    },
  },
  methods: {
    /** What a pill shows for a value: the name of whatever an id resolves to, else the text. */
    display(value: string): string {
      return value
        .split("|")
        .map((alt) => {
          const bracket = alt.indexOf("[");
          const id = bracket >= 0 ? alt.slice(0, bracket) : alt;
          const clean = id.replace(/^"|"$/g, "");
          const name = (this.resolve ? this.resolve(clean) : this.catalogue.findOptionById?.(clean))?.getName?.();
          return name ? `${name}${bracket >= 0 ? alt.slice(bracket) : ""}` : alt;
        })
        .join("|");
    },
    /** `label` split as [before, match, after] around the first occurrence of `q`. */
    highlight(label: string, q: string): string[] {
      const at = q ? label.toLowerCase().indexOf(q) : -1;
      return at < 0 ? [label, "", ""] : [label.slice(0, at), label.slice(at, at + q.length), label.slice(at + q.length)];
    },
    values(key: string, q: string): Array<{ label: string; hint?: string; insert: string }> {
      const words = (list: Iterable<string>, hint = "value") =>
        [...list].filter((v) => v.toLowerCase().includes(q)).map((v) => ({ label: v, hint, insert: v }));
      if (this.then) {
        if (key === "by") return words(queryKeys, "field");
        if (key === "sort") return words(["-count", "count", "-files", "files", "key", "-key"]);
        if (key === "count" || key === "files") return words([">1", ">2", ">5"]);
        return [];
      }
      if (["is", "has", "in", "has*", "in*", "child", "parent", "child*", "parent*"].includes(key)) return words(isValues, "kind");
      if (key === "key") return words(Object.keys(entries), "array");
      if (key === "type") return words(TYPES);
      if (key === "kind") return words(profileKinds);
      if (BOOLEANS.has(key)) return words(["true", "false"], "boolean");
      if (key === "catalogue") return words([this.catalogue, ...(this.catalogue.imports ?? [])].map((c) => c.name), "file");
      if (!ID_KEYS.has(key)) return [];

      const keywords =
        key === "scope"
          ? validScopes
          : key === "childId"
            ? validChildIds
            : key === "field"
              ? ["selections", "forces", "associations", ...[...this.catalogue.iterateCostTypes()].map((c) => c.id)]
              : [];
      const found = this.catalogue.findOptionsByText(q).slice(0, 30);
      return [
        ...words(["any", "none", "undefined", ...keywords], "keyword"),
        ...found.map((node) => ({
          label: node.getName(),
          hint: `${node.editorTypeName}${node.catalogue !== this.catalogue ? ` · ${node.catalogue?.name}` : ""}`,
          insert: node.id,
        })),
      ];
    },

    emit() {
      const value = [...this.terms, this.text.trim()].filter(Boolean).join(" ");
      this.lastEmitted = value;
      this.$emit("update:modelValue", value);
    },
    clear() {
      this.terms = [];
      this.text = "";
      this.allSelected = false;
      this.emit();
      this.focus();
    },
    typed() {
      this.active = -1;
      this.allSelected = false;
      this.open = true;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.emit(), 150);
    },
    commit() {
      clearTimeout(this.timer);
      const term = this.text.trim();
      if (!term) return;
      const { terms, text } = partition(term);
      this.terms.push(...terms);
      this.text = text;
      this.active = -1;
      this.emit();
    },
    edit(i: number) {
      if (this.text.trim()) this.commit();
      const [term] = this.terms.splice(i, 1);
      this.text = term;
      this.emit();
      this.focus();
    },
    remove(i: number) {
      this.terms.splice(i, 1);
      this.emit();
    },
    apply(s: Suggestion) {
      this.text = s.insert;
      this.active = -1;
      if (s.commit && isBalanced(this.text)) this.commit();
      this.focus();
    },
    keydown(e: KeyboardEvent) {
      const n = this.suggestions.length;
      const input = e.target as HTMLInputElement;
      const wholeInput = !this.text || (input.selectionStart === 0 && input.selectionEnd === this.text.length);
      if (e.ctrlKey && e.key.toLowerCase() === "a" && wholeInput && this.terms.length) {
        // Second Ctrl+A (or the first on an empty input) reaches past the input to the pills.
        e.preventDefault();
        this.allSelected = true;
        return;
      }
      if (this.allSelected) {
        if (e.ctrlKey && e.key.toLowerCase() === "c") {
          e.preventDefault();
          navigator.clipboard?.writeText(this.lastEmitted);
          return;
        }
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          this.clear();
          return;
        }
        if (e.key === "Escape" || e.key === "ArrowLeft" || e.key === "ArrowRight") this.allSelected = false;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          this.open = true;
          this.active = n ? (this.active + 1) % n : -1;
          break;
        case "ArrowUp":
          e.preventDefault();
          this.active = n ? (this.active - 1 + n) % n : -1;
          break;
        case "Tab":
          if (n) {
            e.preventDefault();
            this.apply(this.suggestions[Math.max(0, this.active)]);
          }
          break;
        case "Enter":
          e.preventDefault();
          if (this.active >= 0) this.apply(this.suggestions[this.active]);
          else {
            this.commit();
            this.$emit("submit");
          }
          break;
        case " ":
          // Only a key term ends on space; plain words stay free text, "feel no pain" is one phrase.
          if (!this.text.trim()) e.preventDefault();
          else if (/[:=]/.test(this.text) && isBalanced(this.text)) {
            e.preventDefault();
            this.commit();
          }
          break;
        case "Backspace":
          if (!this.text && this.terms.length) {
            e.preventDefault();
            this.edit(this.terms.length - 1);
          }
          break;
        case "Escape":
          this.open = false;
          break;
      }
    },
    close() {
      this.open = false;
    },
    focus() {
      (this.$refs.input as HTMLInputElement)?.focus();
    },
    blur() {
      this.open = false;
      (this.$refs.input as HTMLInputElement)?.blur();
    },
  },
  watch: {
    modelValue(v: string) {
      if (v === this.lastEmitted) return;
      Object.assign(this, partition(v));
      this.lastEmitted = v;
    },
  },
});
</script>

<style lang="scss" scoped>
@use "@/shared_components/css/vars.scss" as *;

.query {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
  // Sized by the caller (w-full, w-400px...); the input inside must not grow the box.
  min-width: 0;
  box-sizing: border-box;
  padding: 2px 4px;
  background-color: $input_background;
  border: 1px solid $box_border;
  border-radius: 4px;
  cursor: text;
  &:focus-within {
    border-color: $input_highlights;
  }
  &.all-selected .pill {
    background-color: $light_blue;
  }
  .clear {
    padding: 0 6px;
    opacity: 0.5;
    cursor: pointer;
    &:hover {
      opacity: 1;
    }
  }
  .editing {
    position: relative;
    flex: 1 1 60px;
    min-width: 60px;
  }
  input {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    padding: 2px;
  }
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  padding: 0 2px 0 5px;
  border: 1px solid $box_border;
  border-radius: 3px;
  font-size: 0.9em;
  line-height: 1.5;
  white-space: nowrap;
  cursor: pointer;
  &:hover {
    background-color: $hoverColor;
  }
  &.negate {
    border-color: $red;
  }
  &.bad {
    border-style: dashed;
    border-color: $red;
    .key {
      color: $red;
      text-decoration: underline wavy;
    }
  }
  .neg {
    color: $red;
    font-weight: bold;
  }
  .key {
    color: $blue;
  }
  .op {
    opacity: 0.6;
  }
  .val {
    font-weight: 500;
  }
  .x {
    margin-left: 3px;
    padding: 0 3px;
    opacity: 0.5;
    &:hover {
      opacity: 1;
    }
  }
}

.suggestions {
  position: absolute;
  left: 0;
  width: max-content;
  min-width: 200px;
  max-width: 380px;
  max-height: 300px;
  border-radius: 4px;
  &.above {
    bottom: 100%;
    margin-bottom: 3px;
  }
  &.below {
    top: 100%;
    margin-top: 3px;
  }
  overflow-y: auto;
  z-index: 10;
  background-color: $input_background;
  border: 1px solid $box_border;
  box-shadow: $box_shadow;
  cursor: pointer;
}
.suggestion {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 4px 10px;
  white-space: nowrap;
  &:hover,
  &.selected {
    background-color: $light_blue;
  }
}
.s-label {
  overflow: hidden;
  text-overflow: ellipsis;
  mark {
    background: none;
    color: inherit;
    font-weight: bold;
  }
}
.s-hint {
  color: $blue;
  font-size: 0.85em;
}
.help-row {
  position: sticky;
  bottom: 0;
  justify-content: center;
  background-color: $input_background;
  border-top: 1px solid $box_border;
  font-size: 0.85em;
  opacity: 0.8;
}
</style>
