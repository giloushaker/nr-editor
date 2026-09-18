/**
 * A recipe is what a template writes, as rows of the tree editor's own actions: create a node,
 * set a field, move, copy, remove, or run a script. Nothing here knows what a modifier or a
 * constraint is: kinds and fields come from the format (assets/editor/fields.ts).
 *
 * Every string in a row may hold `$` references, so rows are dynamic:
 *   $count $item $x …      a slot of the wording
 *   $line  $cost           the line as the book wrote it; the points read off it
 *   $costType              the system's first cost type id ("pts")
 *   $unit $model $target   the unit; the model the sentence is about; the option it is placed on
 *   $first                 the unit's first model
 *   $group                 what an earlier row created and named ("as group"); $row3 by number
 *   $link:item             the model's own link of the {item} name
 *   $find:x                a node found by the {x} name: an option, a model, a unit, a shared entry
 *   $shared:item           the shared entry of the {item} name, made as a stub when there is none
 * A reference may take a field of the node: $group.id, $itemMin.value, $target.name. A node's
 * constraints are nodes of their own: a Find row gets one by its fields. Expressions: + - * / ( ) and ?? for a
 * default: "$model.min + $count", "$n2 ?? 1". A plain text with a $ inside is filled in: "Replace $item".
 *
 * `describe` says a recipe in words (the dry run, pure); bs_write.ts runs it.
 */
import { kindLabel } from "~/assets/editor/fields";
import type { Match } from "./model";

// ---- rows ----------------------------------------------------------------------------------

export type Row =
  | { kind: "create"; type: string; under: string; props: Record<string, string>; as?: string; when?: string }
  /** A node of that kind under `under` whose fields match `where`. With orCreate, made from `where` plus those fields when there is none. */
  | { kind: "find"; type: string; under: string; where: Record<string, string>; orCreate?: boolean | Record<string, string>; as?: string; when?: string }
  /** A node of that kind under `under` whose fields match `where`; made from `where` when none and orCreate. */
  | { kind: "find"; type: string; under: string; where: Record<string, string>; orCreate?: boolean; as?: string; when?: string }
  | { kind: "set"; of: string; prop: string; value: string; when?: string }
  | { kind: "move"; what: string; under: string; as?: string; when?: string }
  | { kind: "copy"; what: string; under: string; as?: string; when?: string }
  | { kind: "remove"; what: string; when?: string }
  | { kind: "script"; code: string; as?: string; when?: string };

/** The names rows gave their outputs, in order, with the row that made each. */
export function outputs(recipe: Recipe): { name: string; row: number }[] {
  return recipe.flatMap((r, i) => ("as" in r && r.as ? [{ name: r.as, row: i + 1 }] : []));
}
export type Recipe = Row[];

/** The references a row may use besides the wording's slots. */
export const REF_WORDS = ["unit", "model", "target", "first", "line", "cost", "costType"];

// ---- expressions ------------------------------------------------------------------------------

export type Expr =
  | { kind: "num"; value: number }
  | { kind: "text"; text: string }
  | { kind: "bool"; value: boolean }
  | { kind: "var"; name: string; prop?: string }
  | { kind: "op"; op: "+" | "-" | "*" | "/" | "??"; a: Expr; b: Expr }
  | { kind: "template"; parts: (string | { name: string; prop?: string })[] };

const VAR = /\$([A-Za-z_][\w]*(?::[\w]+)?)(?:\.([A-Za-z_$][\w$]*))?/g;

/** Parses one value string. A bare number, true/false, an expression of $refs, or text with $refs filled in. */
export function parseValue(s: string): Expr {
  const t = s.trim();
  if (t === "") return { kind: "text", text: "" };
  if (/^-?\d+(\.\d+)?$/.test(t)) return { kind: "num", value: Number(t) };
  if (t === "true" || t === "false") return { kind: "bool", value: t === "true" };
  if (/^"[^"]*"$/.test(t)) return { kind: "text", text: t.slice(1, -1) };
  // an expression: only $refs, numbers, operators and parens
  if (/^[\s\d.$\w:()+\-*/?]+$/.test(t) && t.includes("$")) {
    try {
      return new Parser(t).parse();
    } catch {
      /* fall through to text */
    }
  }
  if (!t.includes("$")) return { kind: "text", text: t };
  const parts: (string | { name: string; prop?: string })[] = [];
  let last = 0;
  for (const m of t.matchAll(VAR)) {
    if (m.index! > last) parts.push(t.slice(last, m.index));
    parts.push({ name: m[1], prop: m[2] });
    last = m.index! + m[0].length;
  }
  if (last < t.length) parts.push(t.slice(last));
  return { kind: "template", parts };
}

class Parser {
  private i = 0;
  constructor(private s: string) {}
  parse(): Expr {
    const e = this.coalesce();
    this.ws();
    if (this.i < this.s.length) throw new Error("trailing");
    return e;
  }
  private ws() {
    while (this.s[this.i] === " ") this.i++;
  }
  private coalesce(): Expr {
    let a = this.sum();
    this.ws();
    while (this.s.startsWith("??", this.i)) {
      this.i += 2;
      a = { kind: "op", op: "??", a, b: this.sum() };
      this.ws();
    }
    return a;
  }
  private sum(): Expr {
    let a = this.product();
    this.ws();
    while (this.s[this.i] === "+" || this.s[this.i] === "-") {
      const op = this.s[this.i++] as "+" | "-";
      a = { kind: "op", op, a, b: this.product() };
      this.ws();
    }
    return a;
  }
  private product(): Expr {
    let a = this.atom();
    this.ws();
    while (this.s[this.i] === "*" || this.s[this.i] === "/") {
      const op = this.s[this.i++] as "*" | "/";
      a = { kind: "op", op, a, b: this.atom() };
      this.ws();
    }
    return a;
  }
  private atom(): Expr {
    this.ws();
    if (this.s[this.i] === "(") {
      this.i++;
      const e = this.coalesce();
      this.ws();
      if (this.s[this.i] !== ")") throw new Error("paren");
      this.i++;
      return e;
    }
    const num = /^-?\d+(\.\d+)?/.exec(this.s.slice(this.i));
    if (num) {
      this.i += num[0].length;
      return { kind: "num", value: Number(num[0]) };
    }
    const v = /^\$([A-Za-z_][\w]*(?::[\w]+)?)(?:\.([A-Za-z_$][\w$]*))?/.exec(this.s.slice(this.i));
    if (v) {
      this.i += v[0].length;
      return { kind: "var", name: v[1], prop: v[2] };
    }
    // a bare word is text: "$scope ?? force"
    const w = /^[A-Za-z_][\w-]*/.exec(this.s.slice(this.i));
    if (w) {
      this.i += w[0].length;
      return w[0] === "true" || w[0] === "false" ? { kind: "bool", value: w[0] === "true" } : { kind: "text", text: w[0] };
    }
    throw new Error("atom");
  }
}

/** What an expression needs at run time. */
export interface Env {
  /** A `$name` (slot, sentence, cost, costType, unit, model, target, first, rowN, link:x, find:x, shared:x), with an optional property. */
  get(name: string, prop?: string): unknown;
}
export function evalExpr(e: Expr, env: Env): unknown {
  switch (e.kind) {
    case "num":
    case "bool":
      return e.value;
    case "text":
      return e.text;
    case "var":
      return env.get(e.name, e.prop);
    case "template":
      return e.parts.map((p) => (typeof p === "string" ? p : String(env.get(p.name, p.prop) ?? ""))).join("");
    case "op": {
      if (e.op === "??") {
        const a = evalExpr(e.a, env);
        return a === undefined || a === null || a === "" ? evalExpr(e.b, env) : a;
      }
      const a = evalExpr(e.a, env);
      const b = evalExpr(e.b, env);
      // Slots are strings: "2" + 4 is 6. Text that is not a number joins instead.
      const numeric = (v: unknown) => typeof v === "number" || (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)));
      if (e.op === "+" && !(numeric(a) && numeric(b))) return String(a) + String(b);
      const x = Number(a);
      const y = Number(b);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`not a number: ${JSON.stringify(a)} ${e.op} ${JSON.stringify(b)}`);
      return e.op === "+" ? x + y : e.op === "-" ? x - y : e.op === "*" ? x * y : x / y;
    }
  }
}
export function evalValue(s: string, env: Env): unknown {
  return evalExpr(parseValue(s), env);
}

/** Every `$name` a recipe reads, with any :slot part. */
export function refsUsed(recipe: Recipe): string[] {
  const out = new Set<string>();
  const scan = (s?: string) => {
    for (const m of (s ?? "").matchAll(VAR)) out.add(m[1]);
  };
  for (const row of recipe) {
    scan(row.when);
    switch (row.kind) {
      case "create":
        scan(row.under);
        Object.values(row.props).forEach(scan);
        break;
      case "find":
        scan(row.under);
        Object.values(row.where).forEach(scan);
        if (typeof row.orCreate === "object") Object.values(row.orCreate).forEach(scan);
        break;
      case "find":
        scan(row.under);
        Object.values(row.where).forEach(scan);
        break;
      case "set":
        scan(row.of);
        scan(row.value);
        break;
      case "move":
      case "copy":
        scan(row.what);
        scan(row.under);
        break;
      case "remove":
        scan(row.what);
        break;
      case "script":
        scan(row.code);
    }
  }
  return [...out];
}
/** Slot names a recipe reads: `$count`, and the x of `$link:x`, `$find:x`, `$shared:x`. */
export function slotsUsed(recipe: Recipe): string[] {
  const out = new Set<string>();
  const named = new Set(outputs(recipe).map((o) => o.name));
  for (const r of refsUsed(recipe)) {
    const [head, slot] = r.split(":");
    if (slot) out.add(slot);
    else if (!REF_WORDS.includes(head) && !/^row\d+$/.test(head) && !named.has(head)) out.add(head);
  }
  return [...out];
}

// ---- describe: the dry run, in words ------------------------------------------------------------

const PROP_WORDS: Record<string, string> = { id: "the id of", name: "the name of", targetId: "the target of", value: "the value of" };

export function describeRef(name: string, slots: Record<string, string>, recipe?: Recipe): string {
  const [head, slot] = name.split(":");
  const val = (s: string) => slots[s] ?? `{${s}}`;
  switch (head) {
    case "unit":
      return "the unit";
    case "model":
      return slots.model ? `the ${slots.model} model` : "the model";
    case "target":
      return "the option";
    case "first":
      return "the unit's first model";
    case "line":
      return "the line";
    case "cost":
      return "the points on the line";
    case "costType":
      return "the cost type";
    case "link":
      return `the model's ${val(slot)}`;
    case "find":
      return val(slot);
    case "shared":
      return `the shared ${val(slot)}`;
  }
  const row = /^row(\d+)$/.exec(head);
  if (row) {
    const r = recipe?.[Number(row[1]) - 1];
    return r?.kind === "create" || r?.kind === "find" ? `the ${kindLabel(r.type)} from row ${row[1]}` : `what row ${row[1]} made`;
  }
  if (recipe && outputs(recipe).some((o) => o.name === head)) return `the ${head}`;
  return val(head);
}
export function describeExpr(e: Expr, slots: Record<string, string>, cost?: number, recipe?: Recipe): string {
  switch (e.kind) {
    case "num":
      return String(e.value);
    case "bool":
      return e.value ? "yes" : "no";
    case "text":
      return e.text === "" ? "nothing" : e.text;
    case "var": {
      if (e.name === "cost" && cost !== undefined) return String(cost);
      if (!e.prop) return describeRef(e.name, slots, recipe);
      return `${PROP_WORDS[e.prop] ?? `${e.prop} of`} ${describeRef(e.name, slots, recipe)}`;
    }
    case "template":
      return e.parts.map((p) => (typeof p === "string" ? p : p.name in slots ? slots[p.name] : describeRef(p.name, slots, recipe))).join("");
    case "op": {
      const a = describeExpr(e.a, slots, cost, recipe);
      const b = describeExpr(e.b, slots, cost, recipe);
      return e.op === "??" ? `${a}, or ${b} if none` : `${a} ${e.op === "+" ? "plus" : e.op === "-" ? "minus" : e.op === "*" ? "times" : "over"} ${b}`;
    }
  }
}
export const describeValue = (s: string, slots: Record<string, string>, cost?: number, recipe?: Recipe) => describeExpr(parseValue(s), slots, cost, recipe);

export function describeRow(row: Row, slots: Record<string, string>, cost?: number, recipe?: Recipe): string {
  const ref = (s: string) => (s.startsWith("$") ? describeRef(s.slice(1), slots, recipe) : s);
  const val = (s: string) => describeValue(s, slots, cost, recipe);
  const when = row.when ? ` (only if ${val(row.when)})` : "";
  switch (row.kind) {
    case "create": {
      const props = Object.entries(row.props)
        .filter(([k]) => !["hidden", "import", "shared"].includes(k))
        .map(([k, v]) => `${k} ${val(v)}`)
        .join(", ");
      const label = kindLabel(row.type);
      return `Create ${/^[aeiou]/.test(label) ? "an" : "a"} ${label} under ${ref(row.under)}${props ? `: ${props}` : ""}${when}`;
    }
    case "find": {
      const where = Object.entries(row.where)
        .map(([k, v]) => `${k} ${val(v)}`)
        .join(", ");
      const extra = typeof row.orCreate === "object" ? Object.entries(row.orCreate).map(([k, v]) => `${k} ${val(v)}`).join(", ") : "";
      return `Find the ${kindLabel(row.type)} under ${ref(row.under)}${where ? ` where ${where}` : ""}${row.orCreate ? `, or create it${extra ? ` with ${extra}` : ""}` : ""}${when}`;
    }
    case "set":
      return `Set ${row.prop} of ${ref(row.of)} to ${val(row.value)}${when}`;
    case "move":
      return `Move ${ref(row.what)} under ${ref(row.under)}${when}`;
    case "copy":
      return `Copy ${ref(row.what)} under ${ref(row.under)}${when}`;
    case "remove":
      return `Remove ${ref(row.what)}${when}`;
    case "script":
      return `Run a script (${row.code.split(/\r?\n/).length} lines)${when}`;
  }
}
export function describe(recipe: Recipe, m: Pick<Match, "slots" | "cost">): string[] {
  return recipe.map((row, i) => `${i + 1}. ${describeRow(row, m.slots, m.cost, recipe)}`);
}

// ---- outline: the tree a recipe makes ------------------------------------------------------------

export interface OutlineNode {
  /** "constraint", or the reference a root stands for ("the model"). */
  label: string;
  /** Kind of a created node; none for a root reference. */
  kind?: string;
  /** The name the row gave it, for later rows: $group. */
  as?: string;
  /** A Find row: the node exists already (or is made when absent). */
  found?: string;
  /** Field name and its value in words; slots kept as {slot}. */
  fields: [string, string][];
  /** Rows that act on this node without creating: "set max = …", "move under …". */
  notes: string[];
  when?: string;
  row?: number;
  children: OutlineNode[];
}
const QUIET = new Set(["hidden", "import", "shared"]);

/** What a recipe creates, nested under what. Roots are the references rows build on. */
export function outline(recipe: Recipe, slots: Record<string, string>, cost?: number): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const byRow = new Map<number, OutlineNode>();
  const val = (v: string) => describeValue(v, slots, cost, recipe);
  const named = new Map(outputs(recipe).map((o) => [o.name, o.row]));
  const at = (ref: string): OutlineNode => {
    const m = /^\$row(\d+)$/.exec(ref.trim());
    if (m && byRow.has(Number(m[1]))) return byRow.get(Number(m[1]))!;
    const n = /^\$(\w+)$/.exec(ref.trim());
    if (n && named.has(n[1]) && byRow.has(named.get(n[1])!)) return byRow.get(named.get(n[1])!)!;
    const label = ref.startsWith("$") ? describeRef(ref.slice(1), slots, recipe) : ref;
    let root = roots.find((r) => r.label === label);
    if (!root) roots.push((root = { label, fields: [], notes: [], children: [] }));
    return root;
  };
  recipe.forEach((row, i) => {
    const when = row.when ? `only if ${val(row.when)}` : undefined;
    switch (row.kind) {
      case "create": {
        const node: OutlineNode = {
          label: kindLabel(row.type),
          kind: row.type,
          as: row.as,
          fields: Object.entries(row.props)
            .filter(([k]) => !QUIET.has(k))
            .map(([k, v]) => [k, val(v)] as [string, string]),
          notes: [],
          when,
          row: i + 1,
          children: [],
        };
        at(row.under).children.push(node);
        byRow.set(i + 1, node);
        break;
      }
      case "find": {
        const node: OutlineNode = {
          label: kindLabel(row.type),
          kind: row.type,
          as: row.as,
          found: row.orCreate ? "found, or made" : "found",
          fields: Object.entries(row.where)
            .filter(([k]) => !QUIET.has(k))
            .map(([k, v]) => [k, val(v)] as [string, string]),
          notes: [],
          when,
          row: i + 1,
          children: [],
        };
        at(row.under).children.push(node);
        byRow.set(i + 1, node);
        break;
      }
      case "set":
        at(row.of).notes.push(`set ${row.prop} = ${val(row.value)}${when ? ` (${when})` : ""}`);
        break;
      case "move":
      case "copy":
        at(row.under).notes.push(`${row.kind} ${row.what.startsWith("$") ? describeRef(row.what.slice(1), slots, recipe) : row.what} here${when ? ` (${when})` : ""}`);
        break;
      case "remove":
        at(row.what).notes.push(`removed${when ? ` (${when})` : ""}`);
        break;
      case "script":
        roots.push({ label: `script (${row.code.split(/\r?\n/).length} lines)`, fields: [], notes: [], when, row: i + 1, children: [] });
    }
  });
  return roots;
}
