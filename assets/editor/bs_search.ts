/**
 * The editor's query language.
 *
 * One string in, matching nodes out. Everything about the language lives in this file: the
 * tokenizer, the parser, the field table and the four traversals. Kept separate from
 * `findOptionsByText` (the plain-substring search the roster app also uses) rather than
 * growing it, so nothing reading today's search box has to change.
 *
 *   power fist                      both words, in name/comment/description/text
 *   "power fist"                    that phrase
 *   is:*                            every node -- the whole tree, which is what to walk from
 *   is:constraint|condition         node kind, either of two
 *   -is:entryLink                   negated; `!is:entryLink` is the same
 *   name!=Scouts / name!:scout      not equal / not containing -- the ! rides the operator
 *   is:condition childId:any        field is present (`any`, `*`, or a bare `childId:`)
 *   is:entry id:none                field is absent -- `none` is the complement of `any`; `undefined`/`null` spell it too
 *   name=Scouts                     exact, not substring; same as `name:=Scouts`
 *   key:shared*                     wildcard, matched against the whole value
 *   name:/\s$/                      regular expression; case-insensitive unless flags are given
 *   parent.type:unit target.name:x  a dotted path steps through parent, target, catalogue, refs
 *   is:constraint type:max value:>0 numeric compare
 *   has:constraint[scope:force]     a descendant matches the bracketed query
 *   in:entry["bolt rifle"]          an ancestor matches
 *   child:profile[typeName:Model]   a direct child matches; parent:entry[has:entry] the direct parent
 *   child*:entry / parent*:entry    the same, a link standing in for its target
 *   has*:constraint / in*:entry     the same, with links expanded the way the builder sees them
 *   target:*[is:group]              a link's target matches
 *   refs:0                          nothing links here
 *   refs:*[is:entryLink]            something linking here matches
 *   shared:true                     lives in a shared* array, or carries shared="true"
 *   collective:false                the flag's effective value, on the types that have it
 *
 * Terms are ANDed; `|` ORs inside one term. Brackets nest, so the traversals compose:
 * `has:entry[has:profile[typeName:Weapon]]`.
 */
import { Base, goodJsonKeys, walkChildren } from "~/assets/shared/battlescribe/bs_main";
import { entries } from "~/assets/shared/battlescribe/entries";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { forEachParent, type MaybeArray } from "~/assets/shared/battlescribe/bs_helpers";
import { InfoIndex } from "~/assets/shared/battlescribe/bs_info_index";
import { getName, shortNames, siblingArray } from "./bs_editor";
import { types } from "~/assets/shared/battlescribe/entries";

// #region language

/**
 * One `key:value` alternative.
 *
 * `any` is the `*`/`any`/empty form -- the field merely has to be there. `none` is its exact
 * complement, so `id:none` reads as what it is rather than as `-id:*`.
 *
 * Both are spellings a real value could want, so both are off when the value is quoted or
 * forced with `=`: `name:any` asks whether there is a name, `name:"any"` looks for the word.
 */
interface Val {
  cmp?: ">" | ">=" | "<" | "<=" | "=";
  text: string;
  any?: boolean;
  none?: boolean;
  /** `key:shared*` -- an unquoted, operator-less value with a `*` in it, matched whole. */
  glob?: RegExp;
  /** `name:/\s$/` -- an unquoted `/.../` with optional flags; `i` unless flags are given. */
  regex?: RegExp;
}

interface Term {
  negate: boolean;
  /** "text" for a bare word, so plaintext is not a special case anywhere below. */
  key: string;
  alts: Val[];
  /** The `[...]` query, if any. */
  sub?: Query;
}

type Query = Term[];

/**
 * Splits on whitespace and brackets, with quotes protecting both. Brackets come out as their
 * own tokens, which is what lets the parser attach a `[...]` to whatever term preceded it
 * without the tokenizer knowing anything about fields.
 */
function tokenize(src: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  const push = () => {
    if (cur) out.push(cur);
    cur = "";
  };
  for (const c of src) {
    if (c === '"') {
      quoted = !quoted;
      cur += c;
    } else if (quoted) {
      cur += c;
    } else if (c === " " || c === "\t" || c === "\n") {
      push();
    } else if (c === "[" || c === "]") {
      push();
      out.push(c);
    } else {
      cur += c;
    }
  }
  push();
  return out;
}

/** Index of `ch` outside quotes, or -1. */
function indexOutside(s: string, ch: string): number {
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"') quoted = !quoted;
    else if (!quoted && s[i] === ch) return i;
  }
  return -1;
}

function splitOutside(s: string, ch: string): string[] {
  const out: string[] = [];
  let rest = s;
  for (let at = indexOutside(rest, ch); at !== -1; at = indexOutside(rest, ch)) {
    out.push(rest.slice(0, at));
    rest = rest.slice(at + 1);
  }
  out.push(rest);
  return out;
}

function unquote(s: string): string {
  return s.length > 1 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

function parseVal(raw: string): Val {
  const cmp = /^(>=|<=|>|<|=)/.exec(raw)?.[1] as Val["cmp"];
  const body = cmp ? raw.slice(cmp.length) : raw;
  const text = unquote(body);
  if (!cmp && text === body) {
    if (text === "" || text === "*" || text === "any") return { text, any: true };
    if (text === "none" || text === "undefined" || text === "null") return { text, none: true };
    const re = /^\/(.+)\/([a-z]*)$/.exec(text);
    if (re) {
      try {
        return { text, regex: new RegExp(re[1], re[2] || "i") };
      } catch {
        // Not a regex after all: fall through and search it as text.
      }
    }
    if (text.includes("*")) {
      const glob = new RegExp(`^${text.split("*").map((s) => s.replace(/[.?+^$[\]\\(){}|-]/g, "\\$&")).join(".*")}$`, "i");
      return { text, glob };
    }
  }
  return { cmp, text };
}

/** A term starts with `-` or `!` to negate: one is what Gmail and GitHub taught, the other Sentry and Jira. */
export const NEGATION = /^[-!](?=.)/;

function parseTerm(tok: string): Term {
  let negate = NEGATION.test(tok);
  const body = negate ? tok.slice(1) : tok;
  const colon = indexOutside(body, ":");
  const equals = indexOutside(body, "=");
  /**
   * `name=Scouts` is `name:=Scouts`. `:` and `=` are both separators and whichever comes first
   * wins; `=` additionally forces every alternative to exact, so `name=a|b` is two exact matches
   * rather than one exact and one substring.
   *
   * The cost is that an unquoted bare word containing `=` is now read as key=value, so plaintext
   * `M=6` stops searching text. Quoting is the escape, exactly as it already is for a bare
   * `"scope:force"`, which is why `=` follows `:` here rather than getting a rule of its own.
   */
  const exact = colon < 0 || (equals >= 0 && equals < colon);
  const at = exact ? equals : colon;
  // A leading separator, or none at all, is plaintext.
  if (at <= 0) return { negate, key: "text", alts: [parseVal(body)] };
  // `name!=x` and `name!:x`: the ! rides the operator and negates the term, so with | it reads
  // as "none of these". Composes with a leading - by cancelling, for whoever writes -name!=x.
  const bang = at > 1 && body[at - 1] === "!";
  if (bang) negate = !negate;
  const alts = splitOutside(body.slice(at + 1), "|").map((alt) => parseVal(exact ? `=${alt}` : alt));
  return { negate, key: body.slice(0, bang ? at - 1 : at), alts };
}

function parseQuery(toks: string[], pos: { i: number }): Query {
  const terms: Query = [];
  while (pos.i < toks.length) {
    const tok = toks[pos.i++];
    if (tok === "]") break;
    if (tok === "[") {
      const sub = parseQuery(toks, pos);
      // Nothing in front of it: a stray bracket group just ANDs at this level.
      const prev = terms[terms.length - 1];
      if (prev) prev.sub = [...(prev.sub ?? []), ...sub];
      else terms.push(...sub);
      continue;
    }
    terms.push(parseTerm(tok));
  }
  return terms;
}

export function parse(query: string): Query {
  return parseQuery(tokenize(query), { i: 0 });
}

/**
 * The query as the search box shows it: one string per top-level term, `[...]` kept attached
 * to the term in front of it. `has:entry[has:profile[typeName:Weapon]] -is:link` is two.
 *
 * An unclosed quote or bracket swallows the rest, which is what the box wants too -- a term
 * being typed is not done until it balances.
 */
export function splitTerms(src: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  let depth = 0;
  for (const c of src) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && c === "[") depth++;
    else if (!quoted && c === "]") depth = Math.max(0, depth - 1);
    else if (!quoted && depth === 0 && /\s/.test(c)) {
      if (cur) out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

/** True once a term can be committed: quotes and brackets balance. */
export function isBalanced(src: string): boolean {
  let quoted = false;
  let depth = 0;
  for (const c of src) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && c === "[") depth++;
    else if (!quoted && c === "]") depth--;
  }
  return !quoted && depth === 0;
}

// #endregion
// #region fields

/**
 * Overrides for keys where reading the raw property would be wrong or useless.
 *
 * Any key *not* here reads the property of that name straight off the node, so every field in
 * `goodJsonKeys` -- scope, childId, field, type, typeName, hidden, page, collective... -- is
 * searchable without being registered, and a new one costs nothing. What an override adds is
 * the two things a raw read cannot know: where the value really lives, and how it compares.
 */
interface Field {
  get(node: EditorBase): unknown;
  /** How an operator-less value compares. Default `includes`: names want substrings, ids do not. */
  match?: "includes" | "equals";
}

/**
 * The kind an array holds by name: `categoryLinks` -> `categoryLink`, `infoLinks` -> `infoLink`.
 * Not `entryLinks`: that array mixes entry and group links, and `entryLink` is already the exact
 * short name of the former, so answering it for a group link would blur the two.
 */
const SHORT = new Set<string>(Object.values(shortNames));
function arrayKind(parentKey: string | undefined): string | undefined {
  const type = parentKey && (entries as Record<string, { type?: string }>)[parentKey]?.type;
  return type && !SHORT.has(type) ? type : undefined;
}

const fields: Record<string, Field> = {
  /**
   * Equality, not substring -- `is:entry` must not also match `entryLink`. Both spellings are
   * accepted so `is:group` and `is:selectionEntryGroup` both work, and the catalogue root
   * answers too, which it cannot do from parentKey alone.
   */
  is: {
    match: "equals",
    get: (n) => [
      n.is,
      n.editorTypeName,
      // A resolved link is named after its target -- a categoryLink reads as categoryEntryLink,
      // an infoLink as profileLink -- so the array's own kind answers too, or `is:categoryLink`
      // would only find the dead ones.
      arrayKind(n.parentKey),
      // Every kind of link at once, so `is:link` needs no list of the link kinds.
      n.isLink?.() ? "link" : undefined,
      // Optional calls: the index can hold an entry parsed from malformed JSON that never got
      // a prototype, which findOptionsByText guards for too.
      n.isCatalogue?.() ? (n.isGameSystem?.() ? "gameSystem" : "catalogue") : undefined,
    ],
  },
  /** The raw array name, for when the shared/non-shared distinction `is` collapses matters. */
  key: { match: "equals", get: (n) => n.parentKey },
  id: { match: "equals", get: (n) => [n.id, (n as { targetId?: string }).targetId] },
  /**
   * The stored name first. getName() renders a characteristic as "Description = <text>" and a
   * cost as "pts = 5", so reading it first made `name=Description` match nothing while
   * `name:Description` matched everything -- the rendered form is what `label:` is for. Nodes
   * with no name of their own (conditions, modifiers) still fall back to it.
   */
  name: { get: (n) => n.name ?? n.getName?.() },
  /** What a bare word searches. */
  text: {
    get: (n) => [n.getName?.() ?? n.name, n.comment, (n as { description?: string }).description, (n as { $text?: string }).$text],
  },
  /**
   * "Is this a shared thing" -- which for entries and profiles is the array it sits in, and for
   * modifiers and constraints is the boolean of the same name. Exactly what the override table
   * is for: one question, two places to read it from.
   */
  shared: { get: (n) => n.parentKey?.startsWith("shared") || (n as { shared?: unknown }).shared === true },
  link: { get: (n) => n.isLink?.() === true },
  /** Non-empty on a resolved link; `is:entryLink -target:*` finds the dead ones. */
  target: { get: (n) => (n.target ? [n.target.id, n.target.getName?.()] : undefined) },
  refs: { get: (n) => n.refs },
  error: { get: (n) => n.errors?.map((e) => e.msg) },
};

/**
 * Boolean attributes stored only when they differ from their default, on the node types they
 * mean anything for -- the same rules the right panel greys them out by, in Booleans.vue.
 *
 * Reading the raw property gets these wrong twice over. Unchecking Collective in the editor
 * *deletes* the attribute (set_field drops any value equal to its default), so the entries you
 * are looking for carry nothing to match on; and a profile carries nothing either, for the
 * entirely different reason that the flag does not exist there. Filling the default in on the
 * types it applies to and reporting absent on the rest keeps those two apart, which is the
 * whole point: `collective:false` is every entry that is not collective, and `-collective:*`
 * is everything the question cannot be asked of.
 *
 * The whole table is here, but only the three flags with a real "does not apply" rule become
 * query fields. `hidden`/`import`/`exportable` are left as raw reads for querying: they have
 * defaults too, but filling those in would make `hidden:false` match every node in the file,
 * which is worse than what it does now. Reading ONE node is the opposite case -- "what is this
 * node" wants the effective value -- so nr_read uses effectiveFlags() below instead.
 */
const ENTRIES_AND_GROUPS = new Set(["entry", "group", "entryLink", "groupLink"]);
const ANY_NODE = undefined;

export interface Flag {
  default: boolean;
  /** Node kinds (`is`) the flag means anything for; undefined for "all of them". */
  on?: ReadonlySet<string>;
  read?: (node: EditorBase) => unknown;
  /** Whether this flag is also exposed as a query field; see the note above. */
  queryable?: boolean;
}

/** Defaults and applicability, matching the right panel's own table in Booleans.vue. */
export const FLAGS: Record<string, Flag> = {
  // Not raw: a link is collective when either it or its target is, which is what isCollective
  // answers. No modifier can set this field, so that pair really is the whole story.
  collective: { default: false, on: ENTRIES_AND_GROUPS, read: (n) => n.isCollective?.(), queryable: true },
  collapsible: { default: false, on: ENTRIES_AND_GROUPS, queryable: true },
  flatten: { default: false, on: new Set(["group", "groupLink"]), queryable: true },
  hidden: { default: false, on: ANY_NODE },
  import: { default: true, on: ANY_NODE },
  exportable: { default: true, on: ANY_NODE },
};

/**
 * Every flag that applies to this node, with the default filled in where the attribute was
 * deleted for matching it. Absent keys are the ones the question cannot be asked of.
 *
 * The node's OWN value, deliberately -- `read` is skipped here. isCollective() answers whether a
 * link is collective *or* its target is, which is the right answer for a query and the wrong one
 * for "what does this node say": it silently merges two nodes into one boolean, so a link that
 * sets nothing is indistinguishable from one that sets it itself. The right panel keeps them
 * apart -- own value on the checkbox, a marker when the target differs -- and so does nr_read,
 * by reading the target separately and diffing.
 */
export function effectiveFlags(node: EditorBase): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [key, flag] of Object.entries(FLAGS)) {
    if (flag.on && !flag.on.has(node.is)) continue;
    out[key] = Boolean((node as unknown as Record<string, unknown>)[key] ?? flag.default);
  }
  return out;
}

for (const [key, flag] of Object.entries(FLAGS)) {
  if (!flag.queryable) continue;
  fields[key] = {
    get: (node) => {
      if (flag.on && !flag.on.has(node.is)) return undefined;
      return flag.read?.(node) ?? (node as unknown as Record<string, unknown>)[key] ?? flag.default;
    },
  };
}

/**
 * Fields holding an id. Answering with the id alone makes them unusable by hand -- nobody
 * knows a condition's scope is `a1b2-...`. Answering with the name alone loses the ability to
 * paste an id in. Both, so `scope:force`, `scope:a1b2-...` and `scope:"Infantry Squad"` all
 * land, and `field:hidden` still works because an id that resolves to nothing stays itself.
 */
export const idFields = ["scope", "childId", "field", "targetId", "typeId", "publicationId", "categoryEntryId", "defaultSelectionEntryId", "of"];
for (const key of idFields) {
  fields[key] = {
    get: (node) => {
      const raw = (node as unknown as Record<string, unknown>)[key];
      if (raw === undefined || raw === null) return undefined;
      const found = node.catalogue?.findOptionById?.(String(raw));
      return found ? [raw, found.getName?.()] : raw;
    },
  };
}

Object.assign(fields, {
  /**
   * What the tree shows. For anything with a name that is the name, but a condition, constraint
   * or modifier has none -- their label is built from their ids, and it is what a person or a
   * script is actually looking for: `label:"at least 1 Sergeant"`. Not folded into the bare-word
   * search, which stays a property read: this one renders a string per node.
   */
  label: { get: (n) => getName(n) },
  /** Which file a node lives in, for a query spanning a system and its catalogues. */
  catalogue: { get: (n) => n.catalogue?.name },
  /**
   * Referrers that are not links: conditions, modifiers and constraints naming this node by id
   * in scope/childId/field. `refs:0 mentions:0` is the real "nothing uses this" query -- refs
   * alone calls a shared entry unused while a condition still counts it.
   */
  mentions: { get: (n) => n.other_refs },
  /**
   * A profile's characteristics as one line, `AP=2; S=4`, rather than the raw array of objects
   * nothing could compare. Searchable as text, and the key that makes `by:name,characteristics`
   * mean "the same profile twice".
   */
  characteristics: {
    get: (n) =>
      (n as { characteristics?: Array<{ name?: string; $text?: string }> }).characteristics
        ?.map((c) => `${c.name ?? ""}=${c.$text ?? ""}`)
        .join("; "),
  },
  /**
   * A modifier, constraint or condition with everything under it, as one canonical line, so
   * `by:logic count:>1` is "this exact logic, pasted more than once". Attributes only -- no ids,
   * names or comments of the nodes themselves -- and children sorted, so order does not matter.
   * scope/childId keep their ids: the same shape aimed at a different node is different logic.
   */
  logic: { get: (n) => (LOGIC_KINDS.has(n.is) ? logicOf(n) : undefined) },
  /**
   * The profile type's `kind` -- model, weapon, spell, ability... -- read through a profile's
   * typeId, so `is:profile kind:model` is "model stats" in any system whatever the type is called.
   * A profile type answers for itself.
   */
  kind: {
    match: "equals",
    get: (n) => {
      const own = (n as { kind?: string }).kind;
      if (own !== undefined) return own;
      const typeId = (n as { typeId?: string }).typeId;
      return typeId ? (n.catalogue?.findOptionById?.(typeId) as { kind?: string } | undefined)?.kind : undefined;
    },
  },
} satisfies Record<string, Field>);

/** What a profile type's `kind` may be; the right panel's own list. */
export const profileKinds = ["model", "weapon", "spell", "ability", "rule", "tag", "summary"];

const LOGIC_KINDS = new Set(["modifier", "modifierGroup", "constraint", "condition", "conditionGroup", "localConditionGroup", "repeat"]);
const LOGIC_CHILDREN = ["conditions", "conditionGroups", "localConditionGroups", "repeats", "modifiers", "modifierGroups"];
const LOGIC_SKIP = new Set(["id", "name", "comment"]);

function logicOf(node: EditorBase): string {
  const record = node as unknown as Record<string, unknown>;
  const attrs: string[] = [];
  for (const key of goodJsonKeys) {
    const value = record[key];
    if (LOGIC_SKIP.has(key) || value === undefined || value === null || typeof value === "object") continue;
    attrs.push(`${key}=${value}`);
  }
  attrs.sort();
  const children: string[] = [];
  for (const key of LOGIC_CHILDREN) {
    const list = record[key];
    if (Array.isArray(list)) for (const child of list) children.push(logicOf(child as EditorBase));
  }
  children.sort();
  return `${node.is}(${attrs.join(" ")}${children.length ? `{${children.join(" ")}}` : ""})`;
}

/** What `is:` can hold, for the search box's suggestions. */
export const isValues: string[] = [
  ...new Set(Object.keys(types).map((t) => shortNames[t as keyof typeof shortNames] ?? t)),
  "link",
  "catalogue",
  "gameSystem",
];

/** Every key worth suggesting: the field table, the traversals, and the raw reads people reach for. */
export const queryKeys: string[] = [
  ...new Set([
    "is",
    "name",
    "id",
    "has",
    "in",
    "has*",
    "in*",
    "child",
    "parent",
    "child*",
    "parent*",
    ...Object.keys(fields),
    ...idFields,
    "type",
    "typeName",
    "value",
    "hidden",
    "import",
    "exportable",
    "page",
    "comment",
    "description",
    "$text",
    "min",
    "max",
    "affects",
    "kind",
    "textRefs",
    "textMentions",
  ]),
];

/**
 * `parent.type`, `target.name`, `target.catalogue`, `refs.name`: every segment but the last is a
 * raw property holding a node or nodes (parent, target, catalogue, refs, mentions), and the last
 * is read like any key. A list along the way answers with the values of all its members.
 */
const TRAVERSALS = new Set(["has", "has*", "in", "in*", "child", "child*", "parent", "parent*", "text"]);
const PATH_STEPS = new Set(["parent", "target", "catalogue", "refs", "mentions"]);
const THEN = new Set(["by", "count", "files", "sort"]);

/**
 * Keys a query cannot be reading anything with, for the box to underline. A query fails quietly
 * otherwise -- `catalogue!=catalogue` is the key `catalogue!` and matches nothing -- and a person
 * (or a model writing a query from the cheat sheet) cannot tell a typo from an empty result.
 * Raw attributes are all fair game, so only what is in no table at all is reported.
 */
export function unknownKeys(query: string, then = false): string[] {
  const out: string[] = [];
  const known = (key: string): boolean => {
    if (then) return THEN.has(key);
    const dot = key.indexOf(".");
    if (dot > 0) {
      if (key.endsWith(".length")) return known(key.slice(0, -".length".length));
      // characteristics.<any name> is legal; the name is data, not vocabulary.
      if (key.slice(0, dot) === "characteristics") return true;
      return PATH_STEPS.has(key.slice(0, dot)) && known(key.slice(dot + 1));
    }
    return key in fields || goodJsonKeys.has(key) || TRAVERSALS.has(key) || key === "textRefs" || key === "textMentions";
  };
  const walk = (terms: Query) => {
    for (const term of terms) {
      if (!known(term.key) && !out.includes(term.key)) out.push(term.key);
      if (term.sub) walk(term.sub);
    }
  };
  walk(parse(query));
  return out;
}

/** A few words per suggestible key, for the box's dropdown. Unlisted raw attributes fall back by kind. */
export const keyHints: Record<string, string> = {
  is: "kind",
  name: "stored name",
  label: "tree label",
  id: "id, or target id",
  text: "what bare words search",
  comment: "text",
  description: "rule/profile text",
  $text: "characteristic value",
  characteristics: "stat line",
  logic: "logic as one line",
  kind: "profile type kind",
  type: "min/max, set/append, unit/model",
  catalogue: "file",
  key: "array name",
  target: "link target",
  refs: "links here",
  mentions: "named by logic",
  shared: "true/false",
  link: "true/false",
  collective: "true/false",
  collapsible: "true/false",
  flatten: "true/false",
  hidden: "true/false",
  import: "true/false",
  exportable: "true/false",
  error: "error message text",
  has: "below, any depth",
  in: "above, any depth",
  "has*": "below, through links",
  "in*": "above, through links",
  child: "direct child",
  parent: "direct parent",
  "child*": "child, through links",
  "parent*": "parent, through links",
  value: "number",
  page: "number",
  min: "number",
  max: "number",
  affects: "self/entries/…",
  textRefs: "times named in texts",
  textMentions: "names its own text uses",
  typeName: "profile type name",
  by: "group by field(s)",
  count: "group size",
  files: "files spanned",
  sort: "count / key / files, or a column when flat",
};
for (const key of idFields) keyHints[key] = keyHints[key] ?? "id or name";

function read(node: EditorBase, key: string): unknown {
  const dot = key.indexOf(".");
  if (dot > 0) {
    const head = key.slice(0, dot);
    const next = head === "mentions" ? node.other_refs : (node as unknown as Record<string, unknown>)[head];
    const rest = key.slice(dot + 1);
    // `description.length:>100` -- the one dotted step that lands on a string rather than a node.
    if (rest === "length" && typeof next === "string") return next.length;
    // `characteristics.S:>4`, `characteristics."Unit Strength":1`: ONE characteristic's value,
    // by name -- unlike `characteristics:"S=4"`, which substring-matches the whole line and
    // catches BS=4 too. Quotes around the name protect a spaced one from the tokenizer.
    if (head === "characteristics" && Array.isArray(next)) {
      const wanted = unquote(rest).toLowerCase();
      const found = (next as Array<{ name?: string; $text?: string }>).find((c) => c.name?.toLowerCase() === wanted);
      return found?.$text;
    }
    if (!next || typeof next !== "object") return undefined;
    return Array.isArray(next) ? next.map((n) => read(n as EditorBase, rest)) : read(next as EditorBase, rest);
  }
  const field = fields[key];
  return field ? field.get(node) : (node as unknown as Record<string, unknown>)[key];
}

// #endregion
// #region matching

const NUMERIC = /^-?\d+(\.\d+)?$/;

function compare(a: number, cmp: Val["cmp"], b: number): boolean {
  switch (cmp) {
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    default:
      return a === b;
  }
}

function present(value: unknown): boolean {
  if (value === undefined || value === null || value === false || value === "") return false;
  return Array.isArray(value) ? value.some(present) : true;
}

function matchValue(value: unknown, val: Val, mode: Field["match"]): boolean {
  if (val.none) return !present(value);
  if (val.any) return present(value);
  if (value === undefined || value === null) return false;

  // An array answers about its length for a number and about its elements for anything else, so
  // `refs:0` and `refs:>2` mean what they look like while `error:target` still searches text.
  if (Array.isArray(value)) {
    if (NUMERIC.test(val.text)) return compare(value.filter(present).length, val.cmp, Number(val.text));
    return value.some((v) => matchValue(v, val, mode));
  }
  // A node answers to has:/child:/dotted paths, not to text -- String(node) is "[object Object]",
  // which would make `constraints:object` match everything that has constraints.
  if (typeof value === "object") return false;
  // A number is a quantity, not digits: `value:1` must not match 13 the way "bolter" matches
  // "bolter link". Non-numeric text (globs, regexes, "6\"") still reads it as a string below.
  if (typeof value === "number" && NUMERIC.test(val.text)) return compare(value, val.cmp, Number(val.text));
  if (typeof value === "boolean") {
    // Only the words true/false address a boolean; any other text must not match it, or
    // `value:"Scouts 6"` matches every `set hidden true` in the file.
    const wanted = val.text.toLowerCase();
    return (wanted === "true" || wanted === "false") && value === (wanted === "true");
  }
  if (val.cmp && val.cmp !== "=") return NUMERIC.test(val.text) && compare(Number(value), val.cmp, Number(val.text));

  if (val.regex) return val.regex.test(String(value));
  const text = String(value).toLowerCase();
  const wanted = val.text.toLowerCase();
  if (val.glob) return val.glob.test(text);
  if (val.cmp === "=" || mode === "equals") return text === wanted;
  return text.includes(wanted);
}

// #endregion
// #region aggregation

export interface Group {
  /** One value per `by` key, as text. */
  key: string[];
  nodes: EditorBase[];
  /** Distinct `is` of the members, and distinct catalogue names, for the results table. */
  kinds: string[];
  files: string[];
}

/**
 * What a node contributes to a `by:` key: the same read a query makes. A field that answers
 * with a list of nodes (refs, mentions) groups by how many; one that answers with spellings of
 * the same thing (`is`, the id fields) groups by the first it has.
 */
function groupValue(node: EditorBase, key: string): string {
  const value = read(node, key);
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    const first = value.find((v) => v !== undefined && v !== null && v !== "");
    return typeof first === "object" ? String(value.length) : first === undefined ? "" : String(first);
  }
  // A node-valued field (`by:parent`) groups by the node itself. The id is the key -- names
  // repeat across files -- and the search page renders an id back as its name, the same way it
  // does for `by:target`. Without this every node landed in one "(none)" group.
  if (typeof value === "object") {
    const node = value as { id?: string; getName?: () => string };
    return node.id ?? node.getName?.() ?? "";
  }
  return String(value);
}

/**
 * The second box: `by:id count:>1 sort:-count` over a result set.
 *
 * The same term syntax as a query, so the same pills and parser serve both; only the keys differ.
 * `by` names one or more fields (comma-separated) and is the only required one -- without it
 * there is nothing to group and undefined comes back. `count` and `files` keep groups whose size
 * or catalogue spread compares as asked, with the query's own operators. `sort` is `count`,
 * `files` or `key`, `-` for descending; the default is the biggest group first.
 */
export function aggregate(nodes: EditorBase[], then: string): Group[] | undefined {
  const terms = parse(then);
  const by = terms
    .find((t) => t.key === "by")
    ?.alts.flatMap((a) => a.text.split(","))
    .map((k) => k.trim())
    .filter(Boolean);
  if (!by?.length) return undefined;
  const count = terms.find((t) => t.key === "count")?.alts[0];
  const files = terms.find((t) => t.key === "files")?.alts[0];
  const sortText = terms.find((t) => t.key === "sort")?.alts[0]?.text ?? "-count";
  const desc = sortText.startsWith("-");
  const sortKey = desc ? sortText.slice(1) : sortText;

  // The text keys live outside the field table; their values come from the one scan, made over
  // the universe the nodes were found in when it is known.
  const wantsText = by.some((k) => k === "textRefs" || k === "textMentions");
  const textRefs = wantsText
    ? textRefsOf((nodes as EditorBase[] & { $universe?: EditorBase[] }).$universe ?? nodes)
    : undefined;

  /**
   * The keys one node contributes to. Usually one; `textMentions` EXPLODES -- a text naming
   * three rules joins three groups, which is what "group by what they mention" means. A node
   * can therefore sit in several groups, and the counts sum past the node count, like tags.
   */
  const keysOf = (node: EditorBase): string[][] => {
    let variants: string[][] = [[]];
    for (const k of by) {
      const values =
        k === "textMentions"
          ? [...new Set(textRefs!.mentions.get(node) ?? [])]
          : [k === "textRefs" ? String(textRefs!.counts.get(node) ?? 0) : groupValue(node, k)];
      const parts = values.length ? values : [""];
      variants = variants.flatMap((v) => parts.map((value) => [...v, value]));
    }
    return variants;
  };

  const groups = new Map<string, Group>();
  for (const node of nodes) {
    for (const key of keysOf(node)) {
      const id = key.join("\t");
      let group = groups.get(id);
      if (!group) groups.set(id, (group = { key, nodes: [], kinds: [], files: [] }));
      group.nodes.push(node);
      if (node.is && !group.kinds.includes(node.is)) group.kinds.push(node.is);
      const file = node.catalogue?.name ?? "";
      if (!group.files.includes(file)) group.files.push(file);
    }
  }

  const measure = (g: Group) => (sortKey === "files" ? g.files.length : sortKey === "key" ? g.key.join(" ") : g.nodes.length);
  return [...groups.values()]
    .filter(
      (g) =>
        (!count || matchValue(g.nodes.length, count, undefined)) && (!files || matchValue(g.files.length, files, undefined))
    )
    .sort((a, b) => {
      const x = measure(a);
      const y = measure(b);
      const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return desc ? -order : order;
    });
}

// #endregion
// #region traversal

type Traversal = "has" | "has*" | "in" | "in*" | "child" | "child*" | "parent" | "parent*" | "target" | "refs" | "mentions";

// #region text references

/**
 * How often each indexable node's name appears in OTHER rules' and characteristics' text --
 * the references the roster app auto-links, which no id records, so refs/mentions cannot see
 * them. Indexes what the engine's indexInfo() does: rules, profiles, categories and infoGroups,
 * minus noindex. Built over the whole universe, only when a query says `textRefs`, and
 * remembered per universe so the other terms get it for free.
 */
interface TextRefs {
  /** target -> how many texts name it. */
  counts: Map<EditorBase, number>;
  /** text owner -> the names its text mentions, one entry per mention. */
  mentions: Map<EditorBase, string[]>;
}
const textRefCache = new WeakMap<EditorBase[], TextRefs>();

export function textRefCounts(universe: EditorBase[]): Map<EditorBase, number> {
  return textRefsOf(universe).counts;
}

function textRefsOf(universe: EditorBase[]): TextRefs {
  const cached = textRefCache.get(universe);
  if (cached) return cached;
  const index = new InfoIndex<EditorBase>();
  const INDEXED = new Set(["rule", "profile", "categoryEntry", "infoGroup"]);
  for (const node of universe) {
    if (node.isLink?.()) continue;
    if (!INDEXED.has(node.is)) continue;
    // Like the engine: noindex suppresses the name, aliases are indexed regardless.
    if (!(node as { noindex?: boolean }).noindex) index.add(node.getName?.(), node);
    for (const alias of (node as { alias?: string[] }).alias ?? []) index.add(alias, node);
  }
  const counts = new Map<EditorBase, number>();
  const mentions = new Map<EditorBase, string[]>();
  const scan = (owner: EditorBase | undefined, text: unknown) => {
    if (typeof text !== "string" || !text || !owner) return;
    for (const part of index.match(text)) {
      for (const target of part.match ?? []) {
        if (target === owner) continue;
        counts.set(target, (counts.get(target) ?? 0) + 1);
        let out = mentions.get(owner);
        if (!out) mentions.set(owner, (out = []));
        out.push(target.getName?.() ?? "");
      }
    }
  };
  for (const node of universe) {
    if (node.is === "rule") scan(node, (node as { description?: string }).description);
    // A characteristic's owner is its profile: a profile naming itself in its own text is not a ref.
    if (node.is === "characteristic") scan(node.parent, (node as { $text?: string }).$text);
  }
  const result = { counts, mentions };
  textRefCache.set(universe, result);
  return result;
}

// #endregion


/**
 * Which keys run their `[...]` somewhere other than on the node itself. `has`/`in` are the two
 * tree directions; `target`/`refs` are the same idea across links, and cost nothing extra
 * because the sub-query machinery is already here.
 *
 * `has`/`in` are traversals always -- they mean nothing as fields. `target`/`refs` stay
 * ordinary fields until a bracket asks them to be a step, so `refs:0` still counts referrers
 * and `target:e1` still reads the id, rather than being read as a sub-query naming a type.
 *
 * A bare `has:constraint` is `has:*[is:constraint]`: the value slot folds into the sub-query.
 */
function traversalOf(term: Term, follow: boolean): Traversal | undefined {
  // `followLinks` is the same switch as the `*` suffix, thrown for the whole query at once.
  if (term.key === "has" || term.key === "in" || term.key === "child" || term.key === "parent") {
    return follow ? (`${term.key}*` as Traversal) : term.key;
  }
  if (term.key === "has*" || term.key === "in*" || term.key === "child*" || term.key === "parent*") return term.key;
  if (term.sub && (term.key === "target" || term.key === "refs" || term.key === "mentions")) return term.key;
  return undefined;
}

function innerQuery(term: Term): Query {
  const inner = [...(term.sub ?? [])];
  if (!term.alts.every((a) => a.any)) inner.unshift({ negate: false, key: "is", alts: term.alts });
  return inner;
}

/**
 * `has`/`in` as set relations rather than a walk per node: the sub-query runs once over the
 * whole universe, then `has` marks its matches' ancestors on the way up. Both passes are
 * O(matches x depth); testing each node's own subtree instead would be O(nodes x subtree),
 * which is the difference between instant and unusable on a full game system.
 */
function traverse(term: Term, kind: Traversal, universe: EditorBase[], follow: boolean): (node: EditorBase) => boolean {
  const matches = run(innerQuery(term), universe, follow);
  if (!matches.size) return () => false;

  switch (kind) {
    case "has":
      return hasDescendant(matches, false);
    case "has*":
      return hasDescendant(matches, true);
    case "in":
      return (node) => {
        let found = false;
        forEachParent(node, (parent) => (matches.has(parent) ? ((found = true), false) : true));
        return found;
      };
    case "in*":
      return isInside(matches);
    // One level of has/in. The starred forms let a link stand in for its target: a unit whose
    // models are links to shared entries still has those models as children.
    case "child":
    case "child*": {
      const parents = new Set<EditorBase>();
      for (const match of matches) {
        if (match.parent) parents.add(match.parent);
        if (kind === "child*") for (const ref of match.refs ?? []) if (ref.parent) parents.add(ref.parent);
      }
      return (node) => parents.has(node);
    }
    case "parent":
      return (node) => Boolean(node.parent && matches.has(node.parent));
    case "parent*":
      return (node) =>
        Boolean(node.parent && (matches.has(node.parent) || node.parent.refs?.some((ref) => ref.parent && matches.has(ref.parent))));
    case "target":
      return (node) => Boolean(node.target && matches.has(node.target as EditorBase));
    case "mentions":
      return (node) => Boolean(node.other_refs?.some((ref) => matches.has(ref)));
    default:
      return (node) => Boolean(node.refs?.some((ref) => matches.has(ref)));
  }
}

/**
 * Nodes with a match somewhere below them. Walks up from each match, sharing one visited set
 * across all of them: once a node is known to have a match under it, its own ancestors have
 * been marked too, so the whole pass is linear no matter how many matches there are.
 *
 * `follow` adds the builder's view. A link stands in for its target, so everything the target
 * contains, the link contains -- which upward means: from any node, also continue through the
 * links pointing at it. The target itself is reached the ordinary way, as the authored parent
 * of its own children, so it is never treated as a child of the link.
 */
function hasDescendant(matches: Set<EditorBase>, follow: boolean): (node: EditorBase) => boolean {
  const marked = new Set<EditorBase>();
  const stack: EditorBase[] = [];
  for (const match of matches) if (match.parent) stack.push(match.parent);
  while (stack.length) {
    const node = stack.pop()!;
    if (marked.has(node)) continue;
    marked.add(node);
    if (node.parent) stack.push(node.parent);
    if (follow && node.refs?.length) stack.push(...node.refs);
  }
  return (node) => marked.has(node);
}

/**
 * Nodes somewhere below a match, links expanded -- the mirror of has*, and the direction where
 * walkChildren already says exactly the right thing: `includeTargets` descends into a link's
 * target to reach its children without ever visiting the target itself. Shared visited set
 * again, which also stops a link cycle from looping.
 */
function isInside(matches: Set<EditorBase>): (node: EditorBase) => boolean {
  const inside = new Set<EditorBase>();
  for (const match of matches) {
    walkChildren(
      match,
      (child) => {
        if (inside.has(child as EditorBase)) return false;
        inside.add(child as EditorBase);
      },
      { includeTargets: true },
    );
  }
  return (node) => inside.has(node);
}

// #endregion
// #region evaluation

function compile(term: Term, universe: EditorBase[], follow: boolean): (node: EditorBase) => boolean {
  if (term.key === "textRefs") {
    const counts = textRefCounts(universe);
    const test = (node: EditorBase) => term.alts.some((alt) => matchValue(counts.get(node) ?? 0, alt, undefined));
    return term.negate ? (node) => !test(node) : test;
  }
  // The same scan, read the other way: what this node's own text names. A rule's mentions sit
  // on the rule; a characteristic's on its profile. Numbers compare the count, text matches names.
  if (term.key === "textMentions") {
    const { mentions } = textRefsOf(universe);
    const test = (node: EditorBase) => term.alts.some((alt) => matchValue(mentions.get(node) ?? [], alt, undefined));
    return term.negate ? (node) => !test(node) : test;
  }
  const kind = traversalOf(term, follow);
  const test = kind
    ? traverse(term, kind, universe, follow)
    : (node: EditorBase) => {
        const value = read(node, term.key);
        const mode = fields[term.key]?.match;
        return term.alts.some((alt) => matchValue(value, alt, mode));
      };
  return term.negate ? (node) => !test(node) : test;
}

function run(query: Query, universe: EditorBase[], follow: boolean): Set<EditorBase> {
  const tests = query.map((term) => compile(term, universe, follow));
  const result = new Set<EditorBase>();
  for (const node of universe) {
    if (tests.every((test) => test(node))) result.add(node);
  }
  return result;
}

/**
 * Every node the query can see: each catalogue given, what each imports, and all their children.
 *
 * Imports come along because the language reaches across links -- `target:*[...]`, `has*:` and
 * `refs:` all ask about nodes on the other side of one, and in a catalogue those are mostly in
 * the game system. Deduplicated by catalogue, since any two catalogues of a system share it.
 *
 * The whole tree, not `catalogue.index` -- the index is keyed by id, so it holds none of the
 * conditions, modifiers or repeats this language is largely for.
 *
 * ponytail: rebuilt per search. It is one walk over nodes already in memory, the same order as
 * the index scan today's search box does per keystroke. Cache it on the catalogue behind the
 * revalidation counter if a big system ever feels slow while typing.
 */
function collect(catalogues: Catalogue[], { path, includeImports = true }: SearchOptions): EditorBase[] {
  const universe: EditorBase[] = [];
  const seen = new Set<Base>();
  const paths = path === undefined ? undefined : Array.isArray(path) ? path : [path];
  for (const key of paths ?? []) {
    // The one place a typo can be caught: unlike a query, this is passed by a caller, and
    // silently searching nothing is a worse answer than saying the key does not exist.
    if (!(key in entries)) throw new Error(`Unknown path "${key}". Expected one of the arrays in entries.ts.`);
  }

  const add = (node: Base) => {
    if (seen.has(node)) return;
    seen.add(node);
    universe.push(node as EditorBase);
    walkChildren(node, (child) => void universe.push(child as EditorBase));
  };

  for (const catalogue of catalogues) {
    for (const root of includeImports ? [catalogue, ...(catalogue.imports ?? [])] : [catalogue]) {
      if (!root || seen.has(root)) continue;
      if (!paths) {
        add(root);
        continue;
      }
      // Named arrays only: the roots move, the walk below each is the same.
      seen.add(root);
      for (const key of paths) for (const node of siblingArray(root, key) ?? []) add(node);
    }
  }
  return universe;
}

export interface SearchOptions {
  /**
   * Start from these arrays on each catalogue instead of the whole file -- `path:
   * "sharedProfiles"` is every shared profile and nothing else. Distinct from the query's
   * `key:sharedProfiles`, which walks everything and then filters: this narrows what is walked,
   * so it is both faster and what `has:`/`in:` sub-queries see. Throws on a key entries.ts
   * does not define.
   */
  path?: MaybeArray<string>;
  /** Walk each catalogue's imports too. On by default; see collect for why. */
  includeImports?: boolean;
  /**
   * Make every `has:`/`in:` behave as `has*:`/`in*:`. The same switch as the `*` suffix, for a
   * caller that wants the builder's view of the whole query rather than of one term.
   */
  followLinks?: boolean;
}

/**
 * Matching nodes, in tree order.
 *
 * Takes one catalogue or many. Many is a single query over the union, not a query per file:
 * a `has*:` that leaves one catalogue through a link and lands in another still matches, which
 * is the point of passing them together rather than concatenating separate searches. Narrow the
 * results back down with `catalogue:` when that is not what you wanted.
 *
 * A query with no terms matches nothing, unless `path` was given -- then it is everything under
 * that path, since narrowing the scope is itself the question being asked.
 *
 * Whatever is passed must already be loaded -- this stays synchronous, so filling in a system's
 * unloaded catalogues is the caller's job.
 */
export function search(catalogues: MaybeArray<Catalogue>, query: string, options: SearchOptions = {}): EditorBase[] {
  const parsed = parse(query);
  if (!parsed.length && options.path === undefined) return [];
  const universe = collect(Array.isArray(catalogues) ? catalogues : [catalogues], options);
  if (!parsed.length) return universe;
  const matches = run(parsed, universe, options.followLinks === true);
  const result = universe.filter((node) => matches.has(node));
  // For aggregate(): a by:textRefs/textMentions over the RESULT has to scan the texts of the
  // whole universe, or every mention whose owner or target fell outside the matches is lost.
  // configurable, or reading it through a Vue reactive proxy (a page storing the results in
  // data) violates the Proxy invariant for non-configurable properties and throws.
  Object.defineProperty(result, "$universe", { value: universe, configurable: true });
  return result;
}

// #endregion
