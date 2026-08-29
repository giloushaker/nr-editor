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
 *   -is:entryLink                   negated
 *   is:condition childId:any        field is present (`any`, `*`, or a bare `childId:`)
 *   is:entry id:none                field is absent -- `none` is the complement of `any`
 *   name=Scouts                     exact, not substring; same as `name:=Scouts`
 *   is:constraint type:max value:>0 numeric compare
 *   has:constraint[scope:force]     a descendant matches the bracketed query
 *   in:entry["bolt rifle"]          an ancestor matches
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
import { Base, walkChildren } from "~/assets/shared/battlescribe/bs_main";
import { entries } from "~/assets/shared/battlescribe/entries";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { forEachParent, type MaybeArray } from "~/assets/shared/battlescribe/bs_helpers";
import { getName, siblingArray } from "./bs_editor";

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
    if (text === "none") return { text, none: true };
  }
  return { cmp, text };
}

function parseTerm(tok: string): Term {
  const negate = tok.length > 1 && tok.startsWith("-");
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
  const alts = splitOutside(body.slice(at + 1), "|").map((alt) => parseVal(exact ? `=${alt}` : alt));
  return { negate, key: body.slice(0, at), alts };
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
      // Optional calls: the index can hold an entry parsed from malformed JSON that never got
      // a prototype, which findOptionsByText guards for too.
      n.isCatalogue?.() ? (n.isGameSystem?.() ? "gameSystem" : "catalogue") : undefined,
    ],
  },
  /** The raw array name, for when the shared/non-shared distinction `is` collapses matters. */
  key: { match: "equals", get: (n) => n.parentKey },
  id: { match: "equals", get: (n) => [n.id, (n as { targetId?: string }).targetId] },
  name: { get: (n) => n.getName?.() ?? n.name },
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
} satisfies Record<string, Field>);

function read(node: EditorBase, key: string): unknown {
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
  if (typeof value === "boolean") return value === (val.text.toLowerCase() !== "false");
  if (val.cmp && val.cmp !== "=") return NUMERIC.test(val.text) && compare(Number(value), val.cmp, Number(val.text));

  const text = String(value).toLowerCase();
  const wanted = val.text.toLowerCase();
  if (val.cmp === "=" || mode === "equals") return text === wanted;
  return text.includes(wanted);
}

// #endregion
// #region traversal

type Traversal = "has" | "has*" | "in" | "in*" | "target" | "refs" | "mentions";

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
  if (term.key === "has" || term.key === "in") return follow ? (`${term.key}*` as Traversal) : term.key;
  if (term.key === "has*" || term.key === "in*") return term.key;
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
  return universe.filter((node) => matches.has(node));
}

// #endregion
