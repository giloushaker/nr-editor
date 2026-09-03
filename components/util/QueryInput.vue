<template>
  <div class="query" :class="{ 'all-selected': allSelected }" @click="focus" v-click-outside="{ handler: close, capture: true }">
    <span
      v-for="(pill, i) in pills"
      :key="i"
      class="pill"
      :class="{ bad: pill.bad.length }"
      :style="{ order: editAt !== null && i >= editAt ? i + 1 : i }"
      :title="pill.bad.length ? `Unknown key: ${pill.bad.join(', ')} — this term matches nothing` : pill.raw"
      @click.stop="edit(i)"
    >
      <span v-if="pill.negate" class="neg">{{ pill.raw[0] }}</span>
      <template v-if="pill.key">
        <span class="key">{{ pill.key }}</span>
        <span class="opwrap" v-click-outside="{ handler: () => opMenu === i && (opMenu = null), capture: true }">
          <span class="op" :class="{ not: pill.cmp[0] === '!' }" title="Change operator" @click.stop="opMenu = opMenu === i ? null : i">{{ pill.cmp }}</span>
          <div v-if="opMenu === i" class="opmenu" :class="up ? 'above' : 'below'">
            <div v-for="o in OPS" :key="o.cmp" :class="{ current: o.cmp === pill.cmp }" @click.stop="setOp(i, o.cmp)">
              <span class="op">{{ o.cmp }}</span><span class="s-hint">{{ o.label }}</span>
            </div>
          </div>
        </span>
      </template>
      <span class="val">
        <template v-for="(alt, j) in pill.value.split('|')" :key="j"><span v-if="j" class="or">|</span>{{ alt }}</template>
      </span>
      <span v-if="orable(pill.key)" class="oradd" title="Add another value (or)" @click.stop="addAlt(i)">+</span>
      <span class="x" @click.stop="remove(i)">×</span>
    </span>
    <span class="editing" :style="editStyle">
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
      <div v-if="open && suggestions.length" class="suggestions" :class="up ? 'above' : 'below'" ref="list">
        <div
          v-for="(s, i) in suggestions"
          :key="i"
          class="suggestion"
          :class="{ selected: i === active }"
          @mousedown.prevent="apply(s)"
        >
          <span class="s-label">
            <img v-if="s.icon" class="s-icon" :src="`assets/bsicons/${s.icon}.png`" @error="($event.target as HTMLImageElement).style.visibility = 'hidden'" />
            <template v-for="(part, j) in highlight(s.label, s.q)" :key="j">
              <mark v-if="j === 1">{{ part }}</mark>
              <template v-else>{{ part }}</template>
            </template>
          </span>
          <span v-if="s.hint" class="s-hint" :class="hintClass(s.hint)">{{ s.hint }}</span>
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
import { shortNames } from "~/assets/editor/bs_editor";
import { entries } from "~/assets/shared/battlescribe/entries";
import { validChildIds, validScopes } from "~/assets/shared/battlescribe/bs_condition";
import { idFields, isBalanced, isValues, keyHints, NEGATION, profileKinds, queryKeys, splitTerms, unknownKeys } from "~/assets/editor/bs_search";

interface Suggestion {
  label: string;
  hint?: string;
  /** An editorTypeName, for a bsicon in front of the label. */
  icon?: string;
  /** What was typed to get here, for highlighting it in the label. */
  q: string;
  /** The whole input text after applying. */
  insert: string;
  /** Whether applying finishes the term. Keys do not; values do. */
  commit: boolean;
}

const THEN_KEYS = ["by", "count", "sort", "files"];
/** `group` -> `selectionEntryGroup`: the icons are named by the long type names. */
const LONG_NAMES: Record<string, string> = Object.fromEntries(Object.entries(shortNames).map(([long, short]) => [short, long]));
const OPS = [
  { cmp: ":", label: "contains" },
  { cmp: "=", label: "equals" },
  { cmp: "!:", label: "doesn't contain" },
  { cmp: "!=", label: "is not" },
  { cmp: ">", label: "more than" },
  { cmp: ">=", label: "at least" },
  { cmp: "<", label: "less than" },
  { cmp: "<=", label: "at most" },
];
/** Keys whose value is a count: offer the comparisons rather than nothing. */
const NUMERIC = new Set(["refs", "mentions", "textRefs", "value", "page", "min", "max"]);
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
    /** What `catalogue:` offers. Defaults to the catalogue and its imports; a whole-system page passes every file. */
    catalogues: { type: Array as PropType<string[]>, required: false },
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
      OPS,
      /** Which pill's operator menu is open. */
      opMenu: null as number | null,
      active: -1,
      lastEmitted: this.modelValue,
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
      /** Which slot the input sits in: the edited pill's, or null for the end of the row. */
      editAt: null as number | null,
      /** Just clicked a pill: offer every value for its key, not just what the old value matches. */
      fresh: false,
    };
  },
  computed: {
    pills() {
      return this.terms.map((raw) => {
        const negate = NEGATION.test(raw);
        const body = negate ? raw.slice(1) : raw;
        const m = /^([^:="[\]]+?)(!?)([:=])(.*)$/s.exec(body);
        if (!m) return { raw, negate, key: "", op: "", cmp: "", value: body, bad: [] as string[] };
        const [, key, bang, op, value] = m;
        // The operator as one glyph: `=` whether spelled name=x or name:=x, else the compare,
        // else `:`; a ! before the separator shows as != or !:.
        const valCmp = op === ":" ? (/^(>=|<=|>|<|=)/.exec(value)?.[1] ?? "") : "";
        const base = op === "=" || valCmp === "=" ? "=" : valCmp || ":";
        const cmp = bang ? (base === "=" ? "!=" : "!:") : base;
        return { raw, negate, key, op, cmp, value: this.display(value.slice(valCmp.length)), bad: unknownKeys(raw, this.then) };
      });
    },
    editStyle(): Record<string, string> {
      if (this.editAt === null) return { order: String(this.terms.length + 1) };
      return { order: String(this.editAt), flex: "0 1 auto", width: `${Math.max(this.text.length + 2, 6)}ch` };
    },
    suggestions(): Suggestion[] {
      try {
        // A computed, so a property read, not a call.
        return this.buildSuggestions;
      } catch (e) {
        // A bad lookup must not break rendering for whatever component sits around the box.
        console.error("suggestions failed", e);
        return [];
      }
    },
    buildSuggestions(): Suggestion[] {
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
        // After `characteristics.` the keys are the system's own characteristic names.
        if (!this.then && q.startsWith("characteristics.")) {
          const part = q.slice("characteristics.".length);
          const names = [...new Set(this.files_of().flatMap((c) => (c.profileTypes ?? []).flatMap((t) => (t.characteristicTypes ?? []).map((ct) => ct.name ?? ""))))];
          return names
            .filter((n) => n && n.toLowerCase().includes(part))
            .map((n) => ({
              label: n,
              hint: "characteristic",
              q: part,
              insert: `${prefix}characteristics.${/[\s"[\]|:=]/.test(n) ? `"${n}"` : n}:`,
              commit: false,
            }));
        }
        const keys: Suggestion[] = (this.then ? THEN_KEYS : queryKeys)
          .filter((k) => k.startsWith(q))
          .map((k) => ({ label: k, hint: keyHints[k] ?? "", q, insert: `${prefix}${k}:`, commit: false }));
        // Discovery for the dotted form: picking it re-opens the dropdown with the names.
        if (!this.then && "characteristics".startsWith(q)) {
          const at = keys.findIndex((k) => k.label === "characteristics");
          keys.splice(at + 1, 0, {
            label: "characteristics.…",
            hint: "one characteristic by name",
            q,
            insert: `${prefix}characteristics.`,
            commit: false,
          });
        }
        return keys;
      }
      const [, rawKey, op, rest] = m;
      const key = rawKey.replace(/!$/, "");
      const pipe = rest.lastIndexOf("|");
      const alt = rest.slice(pipe + 1);
      if (/^\/|[[\]"]/.test(alt)) return [];
      const head = `${prefix}${key}${op}${rest.slice(0, pipe + 1)}`;
      const q = this.fresh ? "" : alt.replace(/^[<>=]+/, "").toLowerCase();
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
    /** Type-ish hints get a color, the way Sentry types do; prose stays muted. */
    hintClass(hint: string): string {
      if (hint === "true/false") return "t-bool";
      if (hint === "number") return "t-num";
      if (hint === "id or name" || hint.startsWith("id")) return "t-id";
      if (hint === "kind") return "t-kind";
      return "";
    },
    /** `label` split as [before, match, after] around the first occurrence of `q`. */
    highlight(label: string, q: string): string[] {
      const at = q ? label.toLowerCase().indexOf(q) : -1;
      return at < 0 ? [label, "", ""] : [label.slice(0, at), label.slice(at, at + q.length), label.slice(at + q.length)];
    },
    /** The catalogue and everything it imports -- `imports` does not include the catalogue itself. */
    files_of(): Catalogue[] {
      return [...new Set([this.catalogue, ...(this.catalogue.imports ?? [])])];
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
      if (["is", "has", "in", "has*", "in*", "child", "parent", "child*", "parent*"].includes(key)) {
        return words(isValues, "kind").map((v) => ({ ...v, icon: LONG_NAMES[v.label] ?? v.label }));
      }
      if (key === "key") {
        return words(Object.keys(entries), "array").map((v) => ({
          ...v,
          icon: (entries as Record<string, { type?: string }>)[v.label]?.type,
        }));
      }
      if (key === "type") return words(TYPES);
      if (key === "kind") return words(profileKinds);
      if (key === "typeName") {
        return words(this.files_of().flatMap((c) => (c.profileTypes ?? []).map((t) => t.name ?? "")), "profile type").map((v) => ({
          ...v,
          icon: "profileType",
        }));
      }
      if (NUMERIC.has(key)) return words(["any", "none", "0", ">0", ">1", ">5"], "count");
      if (key === "textMentions") {
        // A count, or the name of what the text mentions -- rules and profiles are what texts link.
        const named = this.catalogue
          .findOptionsByText(q)
          .filter((n) => !n.isLink() && ["rule", "profile", "categoryEntry", "infoGroup"].includes(n.is))
          .slice(0, 20)
          .map((node) => ({ label: node.getName(), icon: node.editorTypeName, hint: node.is, insert: node.getName() }));
        return [...words(["any", "0", ">=1", ">1"], "count"), ...named];
      }
      if (BOOLEANS.has(key)) return words(["true", "false"], "boolean");
      if (key === "catalogue") {
        return words(this.catalogues ?? [this.catalogue, ...(this.catalogue.imports ?? [])].map((c) => c.name), "file");
      }
      if (!ID_KEYS.has(key)) return [];

      const keywords =
        key === "scope"
          ? validScopes
          : key === "childId"
            ? validChildIds
            : key === "field"
              ? ["selections", "forces", "associations", ...this.files_of().flatMap((c) => (c.costTypes ?? []).map((t) => t.id))]
              : [];
      const found = this.catalogue.findOptionsByText(q).slice(0, 30);
      return [
        ...words(["any", "none", "undefined", ...keywords], "keyword"),
        ...found.map((node) => ({
          label: node.getName(),
          icon: node.editorTypeName,
          hint: `${node.editorTypeName}${node.catalogue !== this.catalogue ? ` · ${node.catalogue?.name}` : ""}`,
          insert: node.id,
        })),
      ];
    },

    emit() {
      const at = this.editAt ?? this.terms.length;
      const value = [...this.terms.slice(0, at), this.text.trim(), ...this.terms.slice(at)].filter(Boolean).join(" ");
      this.lastEmitted = value;
      this.$emit("update:modelValue", value);
    },
    clear() {
      this.terms = [];
      this.text = "";
      this.editAt = null;
      this.allSelected = false;
      this.emit();
      this.focus();
    },
    typed() {
      this.fresh = false;
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
      const at = this.editAt ?? this.terms.length;
      this.terms.splice(at, 0, ...terms);
      if (this.editAt !== null) this.editAt = text.trim() ? this.editAt + terms.length : null;
      this.text = text;
      this.active = -1;
      this.emit();
    },
    /** Rewrites one pill's operator, keeping key, negation and every | alternative. */
    setOp(i: number, cmp: string) {
      this.opMenu = null;
      const raw = this.terms[i];
      const negate = NEGATION.test(raw) ? raw[0] : "";
      const body = negate ? raw.slice(1) : raw;
      const m = /^([^:="[\]]+?)(!?)([:=])(.*)$/s.exec(body);
      if (!m) return;
      const [, key, , , value] = m;
      const alts = value.split("|").map((a) => a.replace(/^(>=|<=|>|<|=)/, ""));
      const term =
        cmp === "="
          ? `${key}=${alts.join("|")}`
          : cmp === ":"
            ? `${key}:${alts.join("|")}`
            : cmp === "!="
              ? `${key}!=${alts.join("|")}`
              : cmp === "!:"
                ? `${key}!:${alts.join("|")}`
                : `${key}:${alts.map((a) => cmp + a).join("|")}`;
      this.terms[i] = negate + term;
      this.emit();
    },
    /** OR-able: alternatives make sense for names and kinds, not for counts. */
    orable(key: string): boolean {
      // The then box's keys (by, count, sort, files) take one value each; | means nothing there.
      return Boolean(key) && !this.then && !NUMERIC.has(key) && !key.endsWith(".length");
    },
    /** The pill goes back to text with a trailing |, cursor after it, the value list open. */
    addAlt(i: number) {
      this.opMenu = null;
      if (this.text.trim()) {
        this.editAt = null;
        this.commit();
      }
      const [term] = this.terms.splice(i, 1);
      this.editAt = i;
      this.text = term + "|";
      this.open = true;
      this.emit();
      this.focus();
      this.$nextTick(() => {
        const el = this.$refs.input as HTMLInputElement | undefined;
        el?.setSelectionRange(this.text.length, this.text.length);
      });
    },
    edit(i: number) {
      this.opMenu = null;
      if (this.text.trim()) {
        this.editAt = null;
        this.commit();
      }
      const [term] = this.terms.splice(i, 1);
      this.editAt = i;
      this.text = term;
      this.fresh = true;
      this.open = true;
      this.emit();
      this.focus();
      // Select the value part so the dropdown offers every choice and typing overwrites.
      const sep = /^[-!]?[^:="[\]]+?!?[:=](>=|<=|>|<|=)?/.exec(term)?.[0].length ?? 0;
      this.$nextTick(() => (this.$refs.input as HTMLInputElement)?.setSelectionRange(sep, term.length));
    },
    remove(i: number) {
      this.opMenu = null;
      this.terms.splice(i, 1);
      if (this.editAt !== null && i < this.editAt) this.editAt--;
      this.emit();
    },
    apply(s: Suggestion) {
      this.fresh = false;
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
          // And only at the end of the text: a space typed inside -- editing a pill, or with the
          // cursor moved back between quotes -- is an edit, not a commit.
          if (!this.text.trim()) e.preventDefault();
          else if (input.selectionStart === this.text.length && /[:=]/.test(this.text) && isBalanced(this.text)) {
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
      // Clicking away commits what was typed, like Enter would -- unless it is mid-bracket or
      // mid-quote, which a stray click should not cut in half.
      if (this.text.trim() && isBalanced(this.text)) this.commit();
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
    /** Keep the keyboard-selected row in view; the list scrolls, the selection does not on its own. */
    active(i: number) {
      if (i < 0) return;
      this.$nextTick(() => (this.$refs.list as HTMLElement | undefined)?.children[i]?.scrollIntoView({ block: "nearest" }));
    },
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
    // The pills and the input carry explicit flex orders; without one the clear would sort first.
    order: 9999;
    margin-left: auto;
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
  max-width: 100%;
  cursor: pointer;
  .val {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  &:hover {
    background-color: $hoverColor;
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
    font-weight: bold;
  }
  .key {
    color: $blue;
  }
  .op {
    font-weight: bold;
    padding: 0 3px;
    border-radius: 2px;
    // Dotted underline as the "this is clickable" hint the colon alone cannot give.
    text-decoration: underline dotted;
    text-underline-offset: 2px;
    &:hover {
      color: $blue;
      background-color: $hoverColor;
    }
  }
  .opwrap {
    position: relative;
  }
  .opmenu {
    position: absolute;
    left: 0;
    z-index: 20;
    background-color: $input_background;
    border: 1px solid $box_border;
    box-shadow: $box_shadow;
    white-space: nowrap;
    font-size: 0.95em;
    cursor: pointer;
    &.above {
      bottom: 100%;
      margin-bottom: 3px;
    }
    &.below {
      top: 100%;
      margin-top: 3px;
    }
    > div {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 3px 10px 3px 8px;
      line-height: 1.6;
      &:hover {
        background-color: $light_blue;
      }
      &.current {
        background-color: rgba(45, 156, 225, 0.15);
      }
      .op {
        opacity: 1;
        color: $blue;
        font-family: monospace;
        font-weight: bold;
        min-width: 20px;
        text-align: center;
        text-decoration: none;
        background: none;
      }
      .s-hint {
        color: inherit;
        opacity: 0.85;
        font-size: inherit;
      }
    }
  }
  .val {
    font-weight: 500;
    .or {
      opacity: 0.55;
      font-weight: normal;
      padding: 0 3px;
      color: $blue;
    }
  }
  .oradd {
    margin-left: 2px;
    padding: 0 3px;
    opacity: 0.5;
    font-weight: bold;
    &:hover {
      opacity: 1;
      color: $blue;
    }
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
  // scrollIntoView stops short of the sticky help row at the bottom instead of under it.
  scroll-padding-bottom: 2em;
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
.s-icon {
  width: 14px;
  height: 14px;
  vertical-align: middle;
  margin-right: 5px;
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
  color: $gray;
  font-size: 0.85em;
  // Sentry-style type colors, own palette: one shade for light, one for dark (html.dark is
  // what appearance.ts toggles). Not theme tokens on purpose -- these are types, not chrome.
  &.t-bool {
    color: #b5387f;
  }
  &.t-num {
    color: #a8730a;
  }
  &.t-id {
    color: #6a3fbf;
  }
  &.t-kind {
    color: #2e7d32;
  }
  html.dark &.t-bool {
    color: #ec87c0;
  }
  html.dark &.t-num {
    color: #e5c07b;
  }
  html.dark &.t-id {
    color: #b48ee0;
  }
  html.dark &.t-kind {
    color: #8fce8f;
  }
}
// On the highlighted row the type colors fight the selection background; step back to neutral.
.suggestion:hover .s-hint,
.suggestion.selected .s-hint {
  color: inherit;
  opacity: 0.85;
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
