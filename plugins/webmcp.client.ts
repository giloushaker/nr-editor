// Declares the editor's tools to the browser's WebMCP API, so an MCP client (Claude Code via the
// WebMCP bridge extension or local relay) can drive the editor that is already open in front of you.
import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";
import { effectiveFlags, idFields, search, type SearchOptions } from "~/assets/editor/bs_search";
import { DIAGNOSTICS, OPTIONAL_DIAGNOSTICS, diagnosticById } from "~/assets/editor/bs_diagnostics";
import { getName } from "~/assets/editor/bs_editor";
import { validChildIds, validScopes, selfableScopes } from "~/assets/shared/battlescribe/bs_condition";
import { db } from "~/assets/shared/battlescribe/cataloguesdexie";
import type { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { getFolderFolders, readFile } from "~/electron/node_helpers";
import { permissionState } from "~/electron/web_fs";
import { useSettingsStore } from "~/stores/settingsState";
import type { ScriptDef } from "~/stores/scriptsStore";
import * as helpers from "~/assets/shared/battlescribe/bs_helpers";
import { arrayKeys, Base, getDataObject, goodJsonKeys } from "~/assets/shared/battlescribe/bs_main";
import type { Catalogue, EditorBase, IErrorMessage } from "~/assets/shared/battlescribe/bs_main_catalogue";

/**
 * What the options panel shows under "Enable MCP". Runtime only -- it dies with the page, so it
 * is a plain reactive object rather than a store.
 *
 * There is no connection API to ask: the relay's embed talks to its widget iframe over
 * postMessage and never reports the socket either way. What it does do is ask the page for its
 * tool list, and only after the relay accepted its handshake -- so that message arriving is the
 * signal that something is on the other end. A tool actually running is the same signal, and it
 * is the only one available on the browser-extension route, which has no widget at all.
 *
 * Nothing sets it back to false: a dropped socket is not observable from here either. "Connected"
 * therefore means "something reached the editor at least once this page load".
 */
export const mcpStatus = reactive({
  connected: false,
  /** Where it reached us, in terms someone can act on: "localhost port 9333". */
  address: "",
  /** The relay's own refusal, when it sends one. */
  rejected: "",
});

/** Arguments arrive as JSON from an MCP client, so they are read defensively rather than trusted. */
type ToolArgs = Record<string, unknown>;

interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: ToolArgs) => Promise<unknown> | unknown;
}

interface ModelContext {
  registerTool: (tool: WebMcpTool) => void;
}

/** Diagnostics live on the catalogue at runtime (refreshErrors writes them); only EditorBase declares them. */
type WithErrors = { errors?: IErrorMessage[] };

/** What row()/pathOf() need: any engine node, whether or not it has been processed for the editor. */
type NodeLike = Base & { parent?: NodeLike; catalogue?: { name?: string } };

const REVISION_MODES = ["yes", "no", "github"] as const;
type RevisionMode = (typeof REVISION_MODES)[number];

/** Links back up or across the tree; following them turns any walk into a full-catalogue walk. */
const BACK_REFERENCES = new Set([
  "parent",
  "catalogue",
  "refs",
  "other_refs",
  "target",
  "index",
  "manager",
  "gameSystem",
  "imports",
  "importsWithEntries",
  "links",
  "costIndex",
  "categoryIndex",
  "associationIndex",
]);

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function requireString(value: unknown, name: string): string {
  const found = asString(value);
  if (!found) throw new Error(`"${name}" is required and must be a string`);
  return found;
}

function store(): typeof globalThis.$store {
  const found = globalThis.$store;
  if (!found) throw new Error("The editor is still starting up — open a system first.");
  return found;
}

// Every loaded catalogue across every open system; tools read this at call time so they stay
// correct as you navigate, rather than capturing whatever was open at registration.
function catalogues(): Catalogue[] {
  const systems = Object.values(store().gameSystems ?? {});
  return systems.flatMap((system) => [...system.getAllLoadedCatalogues()]);
}

/**
 * Exact id, then exact name, then a UNIQUE substring. Anything looser throws and lists the hits.
 *
 * This used to be a plain substring filter, and "Renegades v2.0" matched two forked factions at
 * once: three edits landed in the wrong file before anything noticed. A name that could mean two
 * files is a question to bounce back, not a set to write into.
 */
function resolveOne<T>(
  items: T[],
  wanted: string,
  idOf: (item: T) => string | undefined,
  nameOf: (item: T) => string,
  what: string,
): T {
  const byId = items.find((item) => idOf(item) === wanted);
  if (byId) return byId;
  const lower = wanted.toLowerCase();
  const exact = items.filter((item) => nameOf(item).toLowerCase() === lower);
  if (exact.length === 1) return exact[0] as T;
  const hits = exact.length ? exact : items.filter((item) => nameOf(item).toLowerCase().includes(lower));
  if (hits.length === 1) return hits[0] as T;
  if (!hits.length) throw new Error(`No ${what} matching "${wanted}". Have: ${items.map(nameOf).join(", ")}`);
  throw new Error(
    `"${wanted}" is ambiguous, it matches ${hits.length} ${what}s: ${hits
      .map((item) => `${nameOf(item)} [${idOf(item) ?? "?"}]`)
      .join(", ")}. Pass the id, or the exact name.`,
  );
}

function pickOne(name: string): Catalogue {
  return resolveOne(
    catalogues(),
    name,
    (c) => c.id,
    (c) => c.name ?? "",
    "loaded catalogue",
  );
}

/** Every loaded catalogue when no name is given; exactly one when it is. Never a fuzzy several. */
function pick(name?: string): Catalogue[] {
  return name ? [pickOne(name)] : catalogues();
}

/**
 * What the left panel would show for a node.
 *
 * Conditions, modifiers, constraints and repeats have no `name`. Falling back to the id printed
 * paths like "Anointed Armour / ? / ?", which named neither the node asked about nor the one
 * beside it -- and those are exactly the node kinds worth looking at. getName renders the same
 * label the tree does ("at least 1 Sergeant").
 *
 * Guarded because the index can hold a node parsed from malformed JSON that never got a
 * prototype (see nr_uninitialized), and a row that throws takes the whole tool call with it.
 */
function labelOf(node: NodeLike): string {
  if (node.name) return node.name;
  try {
    return getName(node as Base) || node.id || "?";
  } catch {
    return node.id ?? "?";
  }
}

function pathOf(node: NodeLike): string {
  const parts: string[] = [];
  for (let cur: NodeLike | undefined = node; cur; cur = cur.parent) parts.push(labelOf(cur));
  return parts.reverse().slice(1).join(" / ");
}

/**
 * The two node kinds that ARE their value. "M" and "pts" say nothing without it, so reading a
 * profile used to return a statline with no stats in it. Everything else already carries its
 * value in the label a constraint or modifier renders, so this stays off them.
 */
const VALUED = new Set(["characteristic", "cost"]);

// Engine nodes carry parent/catalogue/refs back-references, so everything a tool returns has to be
// projected to plain data or JSON.stringify blows up on the cycle.
function row(node: NodeLike) {
  const valued = node.editorTypeName && VALUED.has(node.editorTypeName);
  // Only when the node cannot be addressed on its own. An entry IS its own handle, so repeating
  // its parent on every row would be noise; a condition has no id at all, and without this the
  // row names a thing there is no way to get back to.
  const owner = node.id ? undefined : ownerOf(node);
  return {
    id: node.id,
    name: labelOf(node),
    type: node.editorTypeName,
    value: valued
      ? ((node as { $text?: unknown; value?: unknown }).$text ?? (node as { value?: unknown }).value)
      : undefined,
    catalogue: node.catalogue?.name,
    path: pathOf(node),
    in: owner && { id: owner.id, name: labelOf(owner), type: owner.editorTypeName },
  };
}

/** Only the parts these helpers touch: the engine types do not describe modifier internals. */
type ModifierNode = NodeLike & {
  type?: string;
  field?: string;
  value?: unknown;
  conditions?: NodeLike[];
  conditionGroups?: Array<{ conditions?: NodeLike[] }>;
  /** Repeat redeclares `repeats` as a count, so it does not structurally overlap Condition's array. */
  repeats?: unknown[];
};
type WithModifiers = {
  modifiers?: ModifierNode[];
  modifierGroups?: WithModifiers[];
  refs?: Array<WithModifiers & NodeLike & { isLink?: () => boolean }>;
};

/**
 * A node's own modifiers, including those nested in modifierGroups.
 *
 * The raw arrays, deliberately, NOT modifiersIterator(): on a Link that iterator yields
 * `this.target.modifiersIterator()` first, which does two wrong things here. It throws outright
 * on a dead link -- the node most worth reading -- and on a live one it reports the target's own
 * modifiers as if they rode in on the link, so a node with modifiers of its own had them listed
 * twice, once correctly and once blamed on a referrer.
 */
function* ownModifiers(node: WithModifiers | undefined): Iterable<ModifierNode> {
  yield* node?.modifiers ?? [];
  for (const group of node?.modifierGroups ?? []) yield* ownModifiers(group);
}

/**
 * Every modifier that can actually reach `node`.
 *
 * Deliberately walked rather than looked up in the reference index. A modifier names its
 * constraint by id, but a constraint id is only unique inside the entry that owns it --
 * duplicate an entry and you duplicate its constraint ids -- so an id keyed globally collects
 * modifiers that cannot touch this node at all. The two places one CAN act from are the node
 * itself and any link pointing at it, and both are right here.
 *
 * `only` narrows the second place to one link. A shared entry can have dozens of links -- Full
 * Plate Armour has 65 -- and listing every one of their modifiers when the question was "what
 * does THIS link give me" buries the handful that apply in the ones that never will.
 */
function* modifiersFor(
  node: WithModifiers | undefined,
  only?: NodeLike,
): Iterable<{ modifier: ModifierNode; viaLink?: NodeLike }> {
  for (const modifier of ownModifiers(node)) yield { modifier };
  for (const ref of node?.refs ?? []) {
    if (only && ref !== only) continue;
    if (!ref?.isLink?.()) continue;
    for (const modifier of ownModifiers(ref)) yield { modifier, viaLink: ref };
  }
}

/**
 * What a modifier does and what gates it, rendered the way the tree renders it.
 *
 * `does` is getName's job, not one to redo here: every renderer in bs_editor passes
 * getModifierOrConditionParent(node) as the base, and fieldToText called with the modifier
 * itself silently returns the bare id instead -- constraintToText checks
 * `base.constraintsIterator()`, which on a modifier is empty.
 *
 * repeats are listed apart from conditions because they are not a gate but a multiplier
 * ("+1 for every 3 Skink Handlers"). Collapsing them into "when" -- or worse, reporting
 * `always` because the conditions array happened to be empty -- says the modifier applies
 * flatly when it does not, which is the exact misreading a bare `max 0` already invites.
 */
function modifierRow(modifier: ModifierNode, viaLink?: NodeLike) {
  const conditions = [
    ...(modifier.conditions ?? []),
    ...(modifier.conditionGroups ?? []).flatMap((group) => group.conditions ?? []),
  ];
  const repeats = modifier.repeats ?? [];
  return {
    does: labelOf(modifier),
    when: conditions.length ? conditions.map((condition) => labelOf(condition)) : undefined,
    // Double cast, the same clash bs_editor's "repeats" renderer suppresses: Repeat redeclares
    // `repeats` as the count while Condition.repeats is the array of them.
    repeat: repeats.length ? repeats.map((repeat) => labelOf(repeat as unknown as NodeLike)) : undefined,
    // Only with neither. Stated positively because an absent "when" and an unrendered one look
    // the same to a reader, and the difference decides whether a base value is really the value.
    unconditional: conditions.length + repeats.length === 0 || undefined,
    on: viaLink ? `link "${labelOf(viaLink)}"` : undefined,
  };
}

function errorRow(error: IErrorMessage, catalogue: Catalogue) {
  return {
    msg: (error.msg ?? "").replace(/<[^>]+>/g, ""),
    severity: error.severity ?? "error",
    catalogue: catalogue.name,
    at: error.source ? row(error.source as NodeLike) : undefined,
  };
}

function errorsOf(catalogue: Catalogue): IErrorMessage[] {
  return (catalogue as Catalogue & WithErrors).errors ?? [];
}

const FORMATS = ["gst", "gstz", "json"] as const;

/** A system the agent could open, whether or not it is loaded. */
interface SystemRow {
  name: string;
  id?: string;
  path?: string;
  source: "folder" | "db";
}

/**
 * Why the working folder is not being read, for the agent to relay. Permission can only be granted
 * from a click, so a tool that hits the prompt path just throws -- better to say what is missing.
 */
async function folderProblem(): Promise<string> {
  const folder = useSettingsStore().systemsFolder;
  if (!folder) return "No working folder is set, so only systems already in browser storage are listed.";
  if (globalThis.electron || (await permissionState(folder)) === "granted") return "";
  return `The browser has no access to ${folder}, so systems on disk are not listed. Only a click can grant it: ask the user to open the Systems page and allow the folder.`;
}

/**
 * What is openable, which is not what is open: the working folder holds systems never opened in
 * this browser, and the db holds ones opened from a folder that has since moved. A folder and the
 * db copy of the same system are one system -- the db copy carries the id every other tool takes,
 * so it is folded into the folder row rather than listed twice.
 */
async function systemRows(): Promise<SystemRow[]> {
  const folder = useSettingsStore().systemsFolder;
  const rows: SystemRow[] = [];
  if (folder && (globalThis.electron || (await permissionState(folder)) === "granted")) {
    for (const found of (await getFolderFolders(folder)) ?? []) {
      rows.push({ name: found.name, path: found.path.replaceAll("\\", "/"), source: "folder" });
    }
  }
  for (const row of await db.systems.toArray()) {
    const gameSystem = row.content?.gameSystem;
    if (!gameSystem) continue;
    const filePath = (gameSystem.fullFilePath || row.path || "").replaceAll("\\", "/");
    const under = rows.find((o) => o.path && filePath.startsWith(`${o.path}/`));
    if (under) under.id = gameSystem.id;
    else rows.push({ name: gameSystem.name, id: row.id, source: "db" });
  }
  return rows;
}

// On Electron a system is never cached in the db, so a folder row has no id until it is loaded --
// match on the file path the way the systems page does, or every folder row reads as unloaded.
function loadedSystemFor(row: SystemRow): GameSystemFiles | undefined {
  if (row.id) return store().gameSystems[row.id];
  if (!row.path) return undefined;
  const prefix = `${row.path}/`;
  return Object.values(store().gameSystems).find((system) =>
    system.gameSystem?.gameSystem.fullFilePath?.replaceAll("\\", "/").startsWith(prefix),
  );
}

async function findSystem(nameOrId: string): Promise<SystemRow> {
  return resolveOne(
    await systemRows(),
    nameOrId,
    (r) => r.id,
    (r) => r.name,
    "system",
  );
}

/** Names of catalogues with edits not yet on disk. Re-reading or unloading would lose them. */
function unsavedIn(system: GameSystemFiles): string[] {
  return system
    .getAllCatalogueFiles()
    .filter((file) => store().get_catalogue_state(file)?.unsaved)
    .map((file) => getDataObject(file).name);
}

function systemErrors(system: GameSystemFiles): number {
  return system.getAllLoadedCatalogues().reduce((total, catalogue) => total + errorsOf(catalogue).length, 0);
}

/**
 * The docs the agent is pointed at, and the part of the briefing the docs cannot cover.
 *
 * The wiki is the source of truth for the data format and for what good data looks like -- it is
 * maintained, and a copy pasted in here would go stale within a release. What stays inline is
 * editor internals: which writes actually persist, and what one tool call costs. The site sends
 * `Access-Control-Allow-Origin: *`, so the page can fetch it directly and hand it over; an agent
 * with no web access of its own still gets the docs this way.
 */
const DOCS_SITE = "https://newrecruit-docs.pages.dev";

const BRIEFING = `You are driving a data editor that a person has open right now -- their window,
their undo stack, their unsaved changes. They are a volunteer data author, not a programmer: they
retype a printed rulebook by hand, and a wrong value becomes a public GitHub issue with their name
on it the next day. Being right beats being quick.

WHAT THIS DATA IS FOR
These files encode the rules of a tabletop miniature wargame -- Warhammer: The Old World, 40k,
Age of Sigmar, Horus Heresy, The 9th Age and others -- so that a list builder can use them.
NewRecruit (newrecruit.eu) is that builder: free, works offline, on phone or desktop.

Before a game, two players agree a points limit (commonly 1000-2000). Each builds an ARMY LIST:
pick a faction, add units, choose each unit's size, arm the models, buy upgrades and magic items,
and stay under the limit. The builder adds the points up, checks the list against the rules, and
keeps the statlines and special rules on screen to consult during the game. Lists get shared by
link or QR code, and turned in at tournaments, where an illegal one is the player's problem.

So this data has three jobs, and every one of them is your responsibility:
  1. Every choice the book allows must be selectable. If it cannot be built, the player cannot
     play their army, and that is the complaint you will get.
  2. Every choice the book forbids must be prevented or flagged. A list that validates clean and
     is illegal is worse than one that errors.
  3. The printed profiles and special rules must be there to read, because the app is what the
     player looks at instead of the book, mid-game.

That is what each piece is for:
  selectionEntry        something you can pick -- a unit, a model, a weapon, an upgrade
  selectionEntryGroup   a choice among them ("one of these three weapons")
  constraint            the legality rule: min/max, per parent, force or roster
  modifier              "in this case that value is different" -- the conditional half of the
                        rulebook, and where most real bugs live
  profile / rule        the statline or rules text a player reads at the table
  categoryEntry         force-org slots (Core, Special, Rare, Characters) and keywords
  costs                 points
  entryLink / infoLink  a reference to a shared definition, so one edit reaches every user of it

HOW TO WORK
  1. nr_systems / nr_load_system   nothing else sees a system until it is loaded. force:true
                      re-reads from disk.
  2. nr_conventions   HOW THIS SYSTEM WRITES ITS DATA: where rules attach, how "(X)" rules and
                      per-N caps are built, entry types, faction gating, profile types -- read
                      off the loaded files, with live examples. Read it before your first write;
                      it replaces an hour of reverse-engineering.
  3. nr_find + nr_read  locate, then OPEN every node you will change or judge. A search row says
                      a node exists, not what it does: "max 0" is routinely raised by a modifier,
                      a link is mostly its target, a deleted boolean looks like an off one.
                      nr_read raw:true gives the file shape to copy when writing one like it;
                      tree() in nr_eval surveys forty units on one screen.
  4. nr_eval          make the change; one call is one undo entry. The reply lists the
                      diagnostics it created or fixed -- a new finding means undo() and rethink.
                      nr_docs "editor/eval" and "editor/writing" are the API and the shapes.
  5. nr_save          only when asked -- they may want to review in their own window first.
A check or a fix the user will want again is a script (nr_script_write), not an nr_eval.
Names of catalogues and systems are matched exactly (id, name, or a substring that fits one);
an ambiguous name is refused rather than guessed.

WHAT COUNTS AS A PROBLEM
Only what a player meets: an allowed choice that cannot be selected, a forbidden one that can,
a cost/statline/text that differs from the book, a rule scoped wider or narrower than written
(one unit's option applying army-wide is the classic), a link to the wrong thing or to nothing,
a unit illegal the moment it is added. Two cheap findings are almost never it: "nothing links to
this shared entry" (library items, work in progress, other files -- the rule is off on purpose)
and "duplicate ids" (constraint ids are per-entry; forked files keep ids so rosters survive).
The diagnostics already flag the collisions that break. Say what a player would notice.

STAY ON THE QUESTION
This tree is large and every corner of it is interesting. Almost none of it is what you were
asked about.
  - Start from the node, not from the catalogue. nr_find the thing by name, then nr_read it.
    Walking a whole system to find one entry costs a hundred times what a query does.
  - One docs page beats a survey. The index lists paths that name their subject; open the one
    that matches the question. {"page":"all"} is for starting cold, not for looking one thing up.
  - Do not rebuild in nr_eval what a tool already returns. If you are reimplementing modifier
    resolution or link following, stop -- nr_read did it, and got the edge cases right.
  - When you notice something else wrong, write it down and finish the task first. Say it at the
    end. Chasing it now spends the user's context on work they did not ask for.
  - If the answer needs data you cannot get, say so. A hedged guess about a points value is worth
    less than nothing here.

WHICH WRITES SURVIVE (editor internals; the docs do not cover this)
  - Write only through the store actions listed in nr_eval's description. Assigning a property
    directly (node.name = "x") skips the bookkeeping: the catalogue never reads as unsaved,
    "Save All" skips the file, and the edit is gone on reload.
  - Prefer merge() to remove()+add() when regenerating. Links bind by target id, so recreating a
    node silently breaks every link into it.
  - Never bulk-edit on a guess. find() the set, look at it, then edit it.
  - It is someone else's window. Do not navigate, save or close what you were not asked to.

WHAT YOU ARE LOOKING AT (the way to survey the data wrongly, and the way to do it right)
  - nr_find, and find() inside nr_eval, walk the whole tree: conditions, modifiers, constraints,
    characteristics and costs included. find("is:*") is every node.
  - catalogue.index is NOT that. It is keyed by id, so it holds only nodes that have one -- a few
    percent of the tree, and none of the conditions, which is where most real bugs live. Iterating
    it answers "none found" for things that are plainly there. Never survey off it.
  - Before concluding a node is unused, read its refs and mentions (nr_read reports both). A
    category with no constraints of its own can still be what 40 conditions test against.
  - nr_fields lists what a field, scope or childId may legally hold. "limit::<costTypeId>" and
    readable slug ids are both normal; a check that assumes otherwise reports nonsense.

TELL US WHAT IS MISSING
When you finish, say which tools were missing or awkward -- what you hand-rolled, what a query
could not express, what made you call twice. These tools are built from that list.`;

/**
 * What `page:"all"` leaves out: installing the app, publishing to GitHub, the changelog, and the
 * lists of known repos and supported systems. Those are about the tooling around the data rather
 * than the data, and an agent editing a catalogue never needs them. They stay in the index and
 * stay fetchable by name, so nothing is hidden -- and this is an exclude list rather than an
 * include list so that a page added to the wiki is read by default.
 */
const NOT_ABOUT_DATA: ReadonlySet<string> = new Set([
  "api/",
  "guide/install",
  "guide/getting-started",
  "guide/publishing",
  "guide/whats-new",
  "guide/reference/bsdata-repos",
  "guide/reference/supported-systems",
  "guide/advanced/export-templates",
]);

/**
 * Pages that live here rather than on the wiki: the nr_eval scope and the shapes data takes when
 * written. They describe this file's own API, so they stay beside it; the wiki cannot know what
 * json() returns. "editor/conventions" is the third and is generated from the loaded data.
 */
const EDITOR_PAGES: Record<string, { about: string; text: string }> = {
  "editor/eval": {
    about: "everything in scope inside nr_eval: read helpers, write actions, returns, quirks",
    text: `nr_eval SCOPE -- what the code body can call. await the writes.

READ
find(query, catalogue?, {path, includeImports, followLinks}) -> live nodes
  The nr_find language. catalogue: an id, an exact name, or a substring that fits ONE loaded
  file; ambiguous throws, omitted means every loaded catalogue. Imports are searched unless
  includeImports:false. One node by id: find('id=<id>', cat)[0]. One whole file:
  find('is:*', cat, {includeImports:false}). One array: find('', cat, {path:'sharedProfiles'}).
json(node, {depth, exclude, collapse}) -> plain object
  The node as the file stores it -- the keys add()/merge() accept: scalars, child arrays under
  their real names, no parent/target/refs. Logic arrays (modifiers, conditions, conditionGroups,
  repeats) always come out whole; entry arrays stop at depth (default unlimited). exclude: child
  names to drop ('Magic Items'). collapse (default true): 2+ siblings sharing a comment become
  one string '(6 modifiers tagged "Battle March", collapsed)'. The result is a copy: edit it and
  hand it to add() or merge().
tree(node | catalogue, {depth=8, exclude, rules=true, shared=false}) -> string
  One line per entry: 'Name <type> {31pts} [min 3] <Core*; 0-1 per 1,000>' (* = primary
  category, '→' = a link, HIDDEN when hidden), then 'rules: Fear, Impact Hits(2), Scouts(H)(?)'
  ((H) the link is hidden, (?) a modifier can hide it). Follows links into their targets.
  shared:true lists the shared arrays too. The survey tool: forty units on one screen.
rules(entry) -> [{name, label, targetId, hidden, conditional, group}]
  The special rules an entry carries, wherever this system keeps them: an infoGroup, bare
  infoLinks to rules or rule-like profiles, rules[]. label includes the '(X)' a name modifier
  appends.
row(node) -> {id, name, type, catalogue, path, in}   the search row. Return this, never a node.
owner(node) -> node   nearest ancestor that is a tree row (skips modifiers, conditionGroups, repeats)
label(node) -> string   what the tree prints, conditions and modifiers included
query(query, catalogues[], opts)   search taking Catalogue objects rather than a name
$catalogues   every loaded Catalogue      $catalogue   the one open in the user's window
$store   editor state: unsavedCount, gameSystems, undoStack, undoStackPos, get_catalogue_state(c)
$h   bs_helpers (groupBy, sortBy, countKeys, clone, generateBattlescribeId, ...), also spread
     into scope unqualified -- except add/remove/copy, which are the store actions
help()   the live list of names in scope

WRITE -- all undoable, all taking their target explicitly. Omit it and they act on whatever the
user has selected, which is never what you meant.
set_field(node, key, value)
  One field. Costs and characteristics are child objects, so set_field(cost, 'value', 30) and
  set_field(characteristic, '$text', '5'). A boolean set to its default is deleted (normal).
edit({key: value, ...}, node | nodes) -> boolean changed
add(data | data[], childKey, parent | parents) -> the FIRST node added, live
  childKey is the array name ('sharedProfiles', 'infoLinks', 'modifiers', 'conditions',
  'categoryLinks', 'costs', 'characteristics', 'selectionEntries', ...) and must be a legal
  child of the parent, otherwise it notifies and adds nothing. data is file shape, nested
  arrays included -- a whole unit in one call is fine.
  Ids: give your own (a prefix per job, 'okr2-...', keeps them greppable) or leave them out.
  An id already present in the catalogue is silently replaced by a fresh one, and scope/childId
  references inside the added subtree are remapped along with it -- read .id off the return
  value rather than assuming yours survived.
  Profiles: typeName plus the characteristic names are enough; the Fix-profiles hook fills in
  every typeId as the node lands (nr_fields lists the types).
remove(node | nodes)   links into a removed node dangle; nr_diagnosis shows them as no-target
move(node, fromCatalogue, toCatalogue, 'root' | 'shared')
merge(node, data, {key}?) -> {updated, added, extra}
  Applies generated data onto an existing node: updates what matches (by id, else by
  typeName/name, or by your key), adds what is new, NEVER deletes -- extra lists the children
  the data did not mention, for you to remove() if wanted. Use it instead of remove()+add() so
  ids, and every link into them, survive.
merge_duplicates(keep, dupes)   repoints every reference at keep and deletes the dupes
undo() / redo()   a previous nr_eval call is ONE entry however many nodes it touched

DO NOT: node.x = y (skips change tracking: never marked unsaved, gone on reload);
add_node/del_node/*_child (not undoable); create()/duplicate() (act on the selection);
iterate catalogue.index (ids only, no conditions); count off anything but find().

RESULT: return plain data; nodes anywhere in it become rows. The reply carries
errors:{new, fixed} when the diagnostics changed, and the list of unsaved catalogues.`,
  },
  "editor/writing": {
    about: "the shapes data takes when written: where things live, gates, caps, patterns",
    text: `SHAPES DATA TAKES. Generic to the format; nr_conventions says which of them the loaded system
uses and shows live examples. nr_read raw:true / json() on a neighbour is always the safest
template. Vocabulary (fields, scopes, childIds, cost and profile types): nr_fields.

WHERE THINGS LIVE
  units      shared entries of type 'unit', reached from the root through entryLinks. Inside:
             models (type 'model'), upgrades ('upgrade'), mounts ('mount'), chariot crew
             ('crew' -- not 'model'; scripts that count models skip crew).
  rules      infoLinks of type 'profile' to a shared rule-like profile (e.g. 'Special Rule'),
             usually grouped in an infoGroup on the UNIT entry rather than the model. A
             parameterised rule is the generic rule plus a name modifier:
               {name:'Impact Hits', type:'profile', targetId:'<rule id>',
                modifiers:[{type:'append', value:'(2)', field:'name'}]}
  statlines  a profile on the model (infoLink to a shared profile, or inline); weapon profiles
             on the weapon entry. Exports read the hierarchy, so a profile parked on the wrong
             node renders under the wrong heading.
  points     costs:[{name:'pts', typeId:'points', value:31}]
  slots      catalogue.categoryEntries, and on each entry categoryLinks:
               [{name:'Core', targetId:'<category id>', primary:true}]
  text       profile characteristics: {name:'Description', typeId:'<char type>', $text:'...'};
             a comment starting todo:/warning:/error: is a diagnostic the user sees.

GATES
  modifier   {type:'set'|'increment'|'decrement'|'append'|'add'|'remove', value, field,
              conditions:[...], conditionGroups:[{type:'or'|'and', conditions:[...]}],
              repeats:[...]}
             field: 'hidden' | 'name' | a cost type id ('points') | a characteristic typeId |
             a constraint id (changes that constraint's value) | 'category' (value = category id)
  condition  {type:'atLeast'|'atMost'|'equalTo'|'instanceOf'|'notInstanceOf'|..., value:1,
              field:'selections', scope:'self'|'parent'|'force'|'roster'|'ancestor'|'root-entry',
              childId:'<entry, group or category id>'|'any'|'model'|'mount', shared:true,
              includeChildSelections:true}
             'is mounted': scope self, atLeast 1, childId 'mount' (or the mount category).
             'belongs to faction X': scope ancestor, instanceOf, childId = X's category id.
             'the army's General is a Y': scope force, atLeast 1, childId = Y's entry id, with
             the General upgrade counted through includeChildSelections.
  constraint {id, type:'min'|'max', value, field:'selections'|'points'|'limit::points',
              scope:'parent'|'force'|'roster', shared:true, includeChildSelections:true}
             -1 = no limit. Ids repeat across entries; a modifier names its constraint by id.

CAPS
  '0-1 X per 1,000 points'   a hidden categoryEntry, max 0 in the force, raised per 1,000:
     constraints:[{id:'c1', type:'max', value:0, field:'selections', scope:'force', shared:true,
                   includeChildSelections:true}]
     modifiers:[{type:'increment', value:1, field:'c1',
                 repeats:[{value:1000, repeats:1, field:'limit::points', scope:'roster',
                           childId:'any', shared:true, roundUp:false}]}]
     ...then a categoryLink to it on every entry it caps. 'limit::points' is the game size the
     player set; plain 'points' would be the points spent so far.
  '0-1 X per Y taken'        the same, the repeat over field 'selections', childId = Y's id.
  '0-3 of X and Y combined'  one category on both, max 3 in force.
  'at least 25% on Core'     min, field 'limit::points', percentValue:true, on the category.
  cost by context            {type:'set', value:75, field:'points', conditions:[<ancestor is
                             category>]} on the item, in the shared file that holds it.
  text by context            give the entry its own profile, hidden, unhidden by the condition,
                             and hide the shared infoLink under the same condition. Never show two.
  hide or forbid             a max 0 constraint keeps the option visible with a reason; hidden:true
                             makes it vanish. Prefer the constraint unless it truly does not belong.

HOUSEKEEPING
  ids        never regenerate a published id (rosters hold them). A fork keeps the base's ids on
             purpose. New nodes: your own prefix, or none and read them back from add().
  shared     define once under shared*, link everywhere. Moving an inline entry to shared leaves
             a link in its place.
  comments   tag every node a job writes ('Unit strength script', 'Renegades') so a re-run can
             find and replace its own output and readers can collapse it.
  toggles    an optional rule set gated behind one 'toggle' entry (max 0, raised by a modifier)
             is how base files carry a variant; forking that variant into its own file means
             baking those conditions in -- find('is:condition childId:<toggle id>').`,
  },
};

/**
 * Page paths, from the site's own sitemap so a new page shows up here without anyone editing this
 * file. The sitemap is written with the canonical github.io origin, so only the path past the repo
 * name is ours.
 */
async function docPages(): Promise<string[]> {
  const xml = await (await fetch(`${DOCS_SITE}/sitemap.xml`)).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1].replace(/^.*?\/nr-docs\//, "").replace(/\.html$/, ""))
    .filter(Boolean);
}

async function docPage(path: string): Promise<string> {
  const response = await fetch(`${DOCS_SITE}/${path.replace(/^\//, "")}`);
  if (!response.ok) throw new Error(`No documentation page at /${path} (${response.status})`);
  // Head first, before DOMParser sees it. A VitePress page preloads its JS bundles, and parsing
  // the whole document made Chrome honour those <link rel=preload> tags and then warn, once per
  // page, that nothing used them -- console noise in the user's own window for markup we throw
  // away two lines later. Only .vp-doc is ever read, so the head has nothing to contribute.
  const html = (await response.text())
    .replace(/<head[\s\S]*?<\/head>/i, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*>/gi, "");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const main = parsed.querySelector(".vp-doc");
  if (!main) throw new Error(`/${path} has no documentation content`);
  // textContent alone runs each heading into the paragraph below it, so block ends become
  // newlines first and the result reads as a document rather than as one long line.
  const holder = parsed.createElement("div");
  holder.innerHTML = main.innerHTML
    .replace(/<\/(h[1-6]|p|li|pre|tr|div|blockquote|td)>/gi, "$&\n")
    .replace(/<br\s*\/?>/gi, "\n");
  return (holder.textContent ?? "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ChildRow {
  id?: string;
  name: string;
  type?: string;
  /** A characteristic or cost is its value; "M" and "pts" say nothing without it. */
  value?: unknown;
  /** The annotations the tree prints beside a name, and only when they say something. */
  costs?: string;
  refs?: number;
  collective?: true;
  errors?: number;
  /** A link whose target does not resolve; it would otherwise just look childless. */
  unresolved?: true;
  /** Present only on LOGIC rows, which open in full; keyed by array, like the parent's. */
  children?: Record<string, ChildRow[]>;
  /** There is something inside to open. The tree draws this as the expand arrow. */
  hasChildren?: true;
  /**
   * Its target has content, which opening it will show. Separate from hasChildren because the
   * two are different things -- one is edited here, the other is another file seen through a
   * reference -- which is why the tree draws inherited children in a different colour.
   */
  fromTarget?: true;
  /** LOGIC rows carry their own arrays inline, under the array's own name. */
  [array: string]: unknown;
}

/**
 * The logic nodes, which are always opened in full.
 *
 * A modifier without its conditions is not a summary of anything -- "set hidden true" reads as
 * unconditional when it is not -- and a condition cannot be addressed on its own because it has
 * no id. So the whole query subtree comes out at once, however deep. It is small: these carry
 * no entries, only more of each other.
 */
const LOGIC = new Set([
  "modifiers",
  "modifierGroups",
  "conditions",
  "conditionGroups",
  "localConditionGroups",
  "repeats",
]);

/**
 * The nearest ancestor a person would name when asked where this node lives.
 *
 * Logic nodes have no id, so a row for one used to be a dead end: it said what the node was, and
 * path said its ancestors' NAMES, but reaching the node those names refer to meant searching for
 * it again by name. Every walk up from a condition or a modifier wants this same loop, so it
 * lives here instead of being written out at each call site.
 *
 * A node is logic when it SITS IN one of those arrays, which is what parentKey says -- the same
 * set that decides what opens in full, read from the other end. Stops at the first ancestor that
 * is a real tree row: an entry, a link, a group, the profile holding a characteristic, the entry
 * holding a constraint. "Which entry holds this profile" is ownerOf() again, and that honesty is
 * the point -- they are two different answers, not one.
 */
function ownerOf(node: NodeLike): NodeLike | undefined {
  let cur = node.parent;
  while (cur && cur.parentKey && LOGIC.has(cur.parentKey)) cur = cur.parent;
  return cur;
}

/**
 * A node's child arrays, kept as arrays: the grouping is the data model, not a detail.
 *
 * Nothing is filtered out, so a row's position in the output IS its index in the data. That is
 * what lets the address be read off the shape -- "entryLinks[2]" is the third row under
 * entryLinks -- instead of repeating a string on every row.
 */
function childArrays(node: NodeLike): Array<{ key: string; nodes: NodeLike[] }> {
  const out: Array<{ key: string; nodes: NodeLike[] }> = [];
  for (const key of arrayKeys) {
    const array = (node as unknown as Record<string, unknown>)[key];
    if (!Array.isArray(array) || !array.length) continue;
    out.push({ key, nodes: array as NodeLike[] });
  }
  return out;
}

/**
 * One child, at a glance: what the tree prints on the row and nothing more.
 *
 * The annotations are conditional on purpose. A tree row reads as "Shield (collective) 2 pts"
 * because the parts that are absent are the parts that had nothing to say; emitting refs:0 and
 * collective:false on every row of a 200-child catalogue is most of the payload and none of the
 * information.
 */
function conciseRow(child: NodeLike, catalogue: Catalogue, key: string): ChildRow {
  const projected = row(child);
  const costs = (child as { costs?: Array<{ name?: string; value?: number }> }).costs ?? [];
  const priced = costs.filter((cost) => Number(cost.value));
  const refs = (child as { refs?: unknown[] }).refs?.length ?? 0;
  const errors = (child as WithErrors).errors?.length ?? 0;
  let collective = false;
  try {
    collective = (child as { isCollective?: () => boolean }).isCollective?.() === true;
  } catch {
    collective = false;
  }
  const out: ChildRow = {
    id: projected.id,
    name: projected.name,
    type: projected.type,
    value: projected.value,
    costs: priced.length ? priced.map((cost) => `${cost.value} ${cost.name ?? ""}`.trim()).join(", ") : undefined,
    refs: refs || undefined,
    collective: collective || undefined,
    errors: errors || undefined,
  };
  const link = child as { targetId?: string; target?: NodeLike };
  if (link.targetId && !link.target) out.unresolved = true;
  if (LOGIC.has(key)) {
    // Opened in full: its own arrays sit on the row, the same way they sit on `self`.
    for (const { key: sub, nodes } of childArrays(child)) {
      out[sub] = nodes.map((n, i) =>
        n && typeof n === "object" ? conciseRow(n, catalogue, sub) : { name: `(not a node at ${sub}[${i}])` },
      );
    }
    return out;
  }
  if (childArrays(child).length) out.hasChildren = true;
  if (link.target && childArrays(link.target).length) out.fromTarget = true;
  return out;
}

/**
 * One node as the object it is: every field the format defines, with its arrays replaced by
 * concise rows.
 *
 * Replaces a hand-drawn split into "fields", "flags" and "children". Those were categories this
 * file invented, not ones the data has, and every new kind of thing needed another top-level key
 * and another rule about which one it belonged in. Here the shape follows the node: goodJsonKeys
 * decides what is a field rather than editor bookkeeping, arrayKeys decides what is a list, and
 * ids answer with the name they point at.
 *
 * Flag defaults are filled in for the flags that apply, because the editor DELETES a boolean set
 * to its default -- so a missing `collective` means "not collective" on an entry and "does not
 * apply" on a profile, and only the table in bs_search knows which. Everything else absent means
 * unset. See FLAGS.
 */
function projectSelf(node: NodeLike, catalogue: Catalogue, expand = false): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as unknown as Record<string, unknown>)) {
    if (Array.isArray(value) && arrayKeys.has(key)) {
      if (!value.length) continue;
      const rows: unknown[] = [];
      const children = value as NodeLike[];
      // Runs of script-written siblings collapse to one line each; the index in the array is
      // still what "at" addresses, so the line says where the run starts.
      for (const [child, run] of expand ? children.map((c) => [c, undefined] as const) : runsByComment(children)) {
        if (run) {
          rows.push({
            collapsed: `${run.count} ${key} tagged "${run.comment}" (from ${key}[${children.indexOf(child)}]; expand:true shows them)`,
          });
          continue;
        }
        rows.push(
          child && typeof child === "object"
            ? conciseRow(child, catalogue, key)
            : { name: `(not a node at ${key}[${children.indexOf(child)}])` },
        );
      }
      out[key] = rows;
      continue;
    }
    if (!goodJsonKeys.has(key) || Array.isArray(value)) continue;
    const named = idFields.includes(key) ? catalogue.findOptionById?.(String(value)) : undefined;
    out[key] = named ? { id: value, name: getName(named) } : value;
  }
  for (const [key, value] of Object.entries(effectiveFlags(node as EditorBase))) {
    if (!(key in out)) out[key] = value;
  }
  return out;
}

/**
 * Walks an address like "selectionEntries[0].modifiers[1]" from a node.
 *
 * A step that a link cannot answer is retried on its target, so the address follows the tree
 * rather than the file: "entryLinks[4].selectionEntryGroups[0]" reaches into the Mount list a
 * link brings in, which is where those children appear when you open one.
 */
function resolveAt(node: NodeLike, at: string): NodeLike {
  let current = node;
  for (const step of at.split(".")) {
    const parsed = /^([A-Za-z]+)\[(\d+)\]$/.exec(step.trim());
    if (!parsed) {
      throw new Error(`Bad step "${step}" in at "${at}". Each step is arrayName[index], e.g. modifiers[0].`);
    }
    const [, key, index] = parsed;
    const target = (current as { target?: NodeLike }).target;
    const own = (current as unknown as Record<string, unknown>)[key];
    const array = Array.isArray(own) ? own : target ? (target as unknown as Record<string, unknown>)[key] : undefined;
    if (!Array.isArray(array)) {
      const from = Array.isArray(own) ? current : (target ?? current);
      const available = childArrays(from).map((entry) => `${entry.key}[0..${entry.nodes.length - 1}]`);
      throw new Error(`"${labelOf(current)}" has no "${key}". Available: ${available.join(", ") || "(no children)"}`);
    }
    const found = array[Number(index)];
    if (!found) throw new Error(`"${labelOf(current)}" has only ${array.length} ${key}.`);
    current = found as NodeLike;
  }
  return current;
}

/**
 * Where the node hangs, nearest first, up to but not including the catalogue -- which is already
 * a field, and is the one ancestor whose id nr_read cannot be called with usefully.
 *
 * path says the same thing in names, which reads well and navigates nowhere. This carries the id
 * of each step, so "the entry two levels up" is something to nr_read rather than something to go
 * looking for. Logic ancestors are kept, without ids, because a condition sitting in a
 * conditionGroup inside a modifier is a different thing from one sitting on the modifier itself,
 * and the chain is the only place that shows it.
 */
function parentsOf(node: NodeLike): Array<{ id?: string; name: string; type?: string }> {
  const out: Array<{ id?: string; name: string; type?: string }> = [];
  for (let cur = node.parent; cur?.parent; cur = cur.parent) {
    out.push({ id: cur.id, name: labelOf(cur), type: cur.editorTypeName });
  }
  return out;
}

/** Spelled out because readNode recurses into a link's target and TS cannot infer through that. */
interface NodeRead extends ReturnType<typeof row> {
  refs: number;
  mentions: number;
  /** Nearest ancestor first, up to the catalogue. Absent on a node read at the root. */
  parents?: ReturnType<typeof parentsOf>;
  /** The node itself: its fields, and its arrays as concise rows. */
  self: Record<string, unknown>;
  /** The same projection of what a link points at, so the two can be compared side by side. */
  target?: NodeRead | ReturnType<typeof row> | { unresolved: string };
  modifiedBy: Array<ReturnType<typeof modifierRow> | { collapsed: string }>;
  errors: ReturnType<typeof errorRow>[];
}

/**
 * One node, projected to plain data.
 *
 * A link contributes almost nothing of its own -- a name, a few overrides -- so reading one
 * without its target answers nearly nothing, and a top-level read follows it. `throughLink` is
 * how the target says it was reached: it stops the recursion (a link target may not itself be
 * a link, which bad-link-target enforces, so there is no chain to bound) and scopes modifiedBy
 * to the one link asked about instead of every link in the system.
 *
 * self and target are the same shape on purpose. Whether a value is set here or inherited is a
 * question about two nodes, and the answer is to show both and let them be compared, rather than
 * to merge them into one number or to bolt on a second key per thing that can differ.
 */
function readNode(node: Base & WithErrors, catalogue: Catalogue, throughLink?: NodeLike, expand = false): NodeRead {
  // A constraint owns no modifiers; the ones acting on it live on the node holding it.
  const owner = (node.parentKey === "constraints" ? node.parent : node) as unknown as WithModifiers;
  const reaching = [...modifiersFor(owner, throughLink)].filter(
    ({ modifier }) => node.parentKey !== "constraints" || modifier.field === node.id,
  );
  // Same collapse as the arrays: six matched-play modifiers riding in on the link are one line.
  const byModifier = new Map(reaching.map((entry) => [entry.modifier as NodeLike, entry]));
  const modifiedBy: Array<ReturnType<typeof modifierRow> | { collapsed: string }> = [];
  for (const [modifier, run] of expand
    ? reaching.map(({ modifier }) => [modifier as NodeLike, undefined] as const)
    : runsByComment(reaching.map(({ modifier }) => modifier as NodeLike))) {
    const entry = byModifier.get(modifier)!;
    if (run) {
      const via = entry.viaLink ? ` on link "${labelOf(entry.viaLink)}"` : "";
      modifiedBy.push({ collapsed: `${run.count} modifiers tagged "${run.comment}"${via} (expand:true shows them)` });
      continue;
    }
    modifiedBy.push(modifierRow(entry.modifier, entry.viaLink));
  }
  const editor = node as Base & { refs?: unknown[]; other_refs?: unknown[] };
  const link = node as Base & { targetId?: string; target?: NodeLike };
  const target = !link.targetId
    ? undefined
    : !link.target
      ? { unresolved: link.targetId }
      : throughLink
        ? row(link.target)
        : readNode(
            link.target as Base & WithErrors,
            (link.target.catalogue as Catalogue) ?? catalogue,
            node as NodeLike,
            expand,
          );
  const parents = parentsOf(node as NodeLike);
  return {
    ...row(node as NodeLike),
    refs: editor.refs?.length ?? 0,
    mentions: editor.other_refs?.length ?? 0,
    parents: parents.length ? parents : undefined,
    self: projectSelf(node as NodeLike, catalogue, expand),
    target,
    modifiedBy,
    errors: (node.errors ?? []).map((error) => errorRow(error, catalogue)),
  };
}

/**
 * The loaded system a script tool acts on. Scripts belong to a system -- they live in its folder
 * and their catalogue arguments load out of it -- but naming it every call is noise when only one
 * is open, which is the normal case.
 */
async function scriptSystem(name?: string): Promise<GameSystemFiles> {
  if (name) {
    const found = loadedSystemFor(await findSystem(name));
    if (!found) throw new Error(`System "${name}" is not loaded. Call nr_load_system first.`);
    return found;
  }
  const open = Object.values(store().gameSystems ?? {}).filter(Boolean) as GameSystemFiles[];
  if (!open.length) throw new Error("No system is loaded. Call nr_load_system first.");
  if (open.length === 1) return open[0];
  const names = open.map((o) => o.gameSystem?.gameSystem.name).join(", ");
  throw new Error(`Several systems are open, so "system" is required. Open: ${names}`);
}

/** What a script offers, without its source: enough to decide whether to run it. */
function scriptRow(script: ScriptDef) {
  const hooks = Object.keys(script.hooks ?? {});
  return {
    name: script.name,
    path: script.path ?? "built in",
    description: script.description,
    runnable: Boolean(script.run),
    arguments: (script.arguments ?? []).map((arg) => ({
      name: arg.name,
      type: Array.isArray(arg.type) ? arg.type[0] : arg.type,
      optional: arg.optional,
      description: arg.description,
      default: arg.default,
    })),
    ...(hooks.length ? { hooks } : {}),
    ...(script.diagnostics?.length ? { diagnostics: script.diagnostics.map((rule) => rule.id) } : {}),
    ...(script.error ? { error: String(script.error) } : {}),
  };
}

/**
 * Anything a script or an eval body returns, made safe to serialise.
 *
 * A Base node becomes its row. So does anything else carrying a `parent` -- a characteristic, a
 * cost, an entry of `refs` -- which the old instanceof check let through to JSON.stringify,
 * where it died on the cycle with no hint of which key. Other objects are walked with their
 * back-references dropped and a cycle set, so a half-projected node still comes out as data.
 */
function scriptResult(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value instanceof Base) return row(value as NodeLike);
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (!value || typeof value !== "object") return value;
  if (depth > 8) return "...";
  if (seen.has(value)) return "(cycle)";
  seen.add(value);
  if (Array.isArray(value)) return value.map((one) => scriptResult(one, depth + 1, seen));
  const record = value as Record<string, unknown>;
  if ("parent" in record && (record.id !== undefined || record.name !== undefined || record.$text !== undefined)) {
    return row(value as NodeLike);
  }
  const out: Record<string, unknown> = {};
  for (const [key, one] of Object.entries(record)) {
    if (BACK_REFERENCES.has(key)) continue;
    out[key] = scriptResult(one, depth + 1, seen);
  }
  return out;
}

// #region json / tree / conventions

interface JsonOptions {
  /** How deep entry arrays recurse; logic arrays always come out whole. Default unlimited. */
  depth?: number;
  /** Children to leave out, by name -- "Magic Items" is the usual one. */
  exclude?: string[];
  /** Fold runs of siblings sharing a comment (script-written boilerplate) into one line. Default on. */
  collapse?: boolean;
}

type Commented = { comment?: string };

/**
 * Siblings that share a non-empty comment, two or more of them, are one thing repeated: the
 * matched-play caps a script stamps onto every root entry, the unit-strength modifiers, the
 * "Renegades" toggles. Yielded once with a count so the reader sees "6 modifiers tagged
 * 'Battle March'" instead of six blocks of the same shape; the rest are skipped.
 */
function* runsByComment(
  nodes: NodeLike[],
): Iterable<readonly [NodeLike, { comment: string; count: number } | undefined]> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const comment = (node as Commented).comment;
    if (comment) counts.set(comment, (counts.get(comment) ?? 0) + 1);
  }
  const emitted = new Set<string>();
  for (const node of nodes) {
    const comment = (node as Commented).comment;
    if (comment && (counts.get(comment) ?? 0) >= 2) {
      if (emitted.has(comment)) continue;
      emitted.add(comment);
      yield [node, { comment, count: counts.get(comment)! }] as const;
      continue;
    }
    yield [node, undefined] as const;
  }
}

/**
 * A node the way the file stores it: goodJsonKeys scalars and arrayKeys arrays, nothing the
 * editor bolted on. This is the shape add() and merge() take, so what comes out can be edited
 * and fed straight back. Logic arrays (modifiers, conditions, repeats...) are always whole: a
 * modifier without its conditions is not a summary of anything.
 */
function toJson(node: NodeLike, options: JsonOptions = {}, depth = 0): Record<string, unknown> {
  const { exclude = [], collapse = true } = options;
  const max = options.depth ?? Infinity;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as unknown as Record<string, unknown>)) {
    if (BACK_REFERENCES.has(key)) continue;
    if (Array.isArray(value)) {
      if (!arrayKeys.has(key) || !value.length) continue;
      const logic = LOGIC.has(key);
      if (!logic && depth >= max) {
        out[key] = `(${value.length} ${key}, beyond depth ${max})`;
        continue;
      }
      const kept = (value as NodeLike[]).filter((child) => !exclude.includes(child?.name ?? ""));
      const rows: unknown[] = [];
      for (const [child, run] of collapse ? runsByComment(kept) : kept.map((child) => [child, undefined] as const)) {
        if (run) {
          rows.push(`(${run.count} ${key} tagged "${run.comment}", collapsed; {collapse:false} shows them)`);
          continue;
        }
        rows.push(child && typeof child === "object" ? toJson(child, options, logic ? depth : depth + 1) : child);
      }
      out[key] = rows;
      continue;
    }
    if (!goodJsonKeys.has(key) || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/** Rule-ish profile types: what a "Special Rules" list is made of, whatever the system calls it. */
function isRuleLike(node: NodeLike | undefined): boolean {
  if (!node) return false;
  const typeName = (node as { typeName?: string }).typeName ?? "";
  return node.editorTypeName === "rule" || /rule|abilit|trait|special/i.test(typeName);
}

interface RuleRow {
  name: string;
  /** The name as the tree renders it, "(2)" suffix and all. */
  label: string;
  targetId?: string;
  hidden?: true;
  conditional?: true;
  /** The infoGroup it sits in, when it sits in one. */
  group?: string;
}

/**
 * The special rules an entry carries, found where systems actually put them: in infoGroups
 * (TOW's "Special Rules"), as bare infoLinks to rules or rule-like profiles, or in `rules`.
 * A link with a name modifier reports the rendered label, which is how "Impact Hits (2)" is
 * written -- a link to Impact Hits plus append "(2)" on the name.
 */
function rulesOf(entry: NodeLike): RuleRow[] {
  const target = ((entry as { target?: NodeLike }).target ?? entry) as NodeLike & {
    infoGroups?: Array<NodeLike & { infoLinks?: NodeLike[] }>;
    infoLinks?: NodeLike[];
    rules?: NodeLike[];
  };
  const out: RuleRow[] = [];
  const push = (link: NodeLike, group?: string) => {
    const mods = (link as { modifiers?: ModifierNode[] }).modifiers ?? [];
    const suffix = mods
      .filter((m) => m.field === "name" && m.type === "append")
      .map((m) => String(m.value))
      .join("");
    out.push({
      name: link.name ?? labelOf(link),
      label: `${link.name ?? labelOf(link)}${suffix}`,
      targetId: (link as { targetId?: string }).targetId,
      hidden: (link as { hidden?: boolean }).hidden ? true : undefined,
      conditional: mods.some((m) => m.field === "hidden") ? true : undefined,
      group,
    });
  };
  for (const group of target.infoGroups ?? []) for (const link of group.infoLinks ?? []) push(link, group.name);
  for (const link of target.infoLinks ?? []) {
    const linkTarget = (link as { target?: NodeLike }).target;
    if (link.editorTypeName === "ruleLink" || isRuleLike(linkTarget)) push(link);
  }
  for (const rule of target.rules ?? []) push(rule);
  return out;
}

interface TreeOptions {
  depth?: number;
  exclude?: string[];
  /** List each entry's special rules on a line of their own. Default on. */
  rules?: boolean;
  /** Include the catalogue's shared arrays too, not only its root entries. */
  shared?: boolean;
}

/**
 * One line per entry, indented, the way a person skims a unit: name, points, its own min/max,
 * its categories, then its rules -- following links into their targets the way the tree does.
 * Nothing about modifiers or conditions; those are nr_read's job. The point is to see forty
 * units in one screen instead of four.
 */
function tree(root: NodeLike | Catalogue, options: TreeOptions = {}): string {
  const { exclude = [], rules = true, shared = false } = options;
  const max = options.depth ?? 8;
  const lines: string[] = [];
  const skipCategory = /^(Faction:|Units \(|.*'per \d+ points' selection)/;
  const costOf = (node: NodeLike): string => {
    const costs = (node as { costs?: Array<{ name?: string; value?: number }> }).costs ?? [];
    return costs
      .filter((c) => Number(c.value))
      .map((c) => `${c.value}${c.name === "pts" ? "pts" : ` ${c.name ?? ""}`}`)
      .join(",");
  };
  const walk = (node: NodeLike, depth: number, viaLink: boolean) => {
    if (exclude.includes(node.name ?? "")) return;
    const target = ((node as { target?: NodeLike }).target ?? node) as NodeLike;
    const ind = "  ".repeat(depth);
    const cost = costOf(node) || costOf(target);
    const own = (
      (node as { constraints?: Array<{ type?: string; value?: number; scope?: string; field?: string }> })
        .constraints ?? []
    )
      .concat(
        node !== target
          ? ((target as { constraints?: Array<{ type?: string; value?: number; scope?: string; field?: string }> })
              .constraints ?? [])
          : [],
      )
      .filter((c) => c.field === "selections" && c.scope === "parent")
      .map((c) => `${c.type === "min" ? "min" : "max"} ${c.value}`)
      .join(", ");
    const cats = ((node as { categoryLinks?: Array<{ name?: string; primary?: boolean }> }).categoryLinks ?? [])
      .filter((c) => c.name && !skipCategory.test(c.name))
      .map((c) => (c.primary ? `${c.name}*` : c.name))
      .join("; ");
    const type = (target as { type?: string }).type;
    const isGroup = node.editorTypeName?.includes("Group") || target.editorTypeName?.includes("Group");
    lines.push(
      `${ind}${viaLink ? "→ " : ""}${node.name ?? labelOf(node)}${type && !isGroup ? ` <${type}>` : ""}${cost ? ` {${cost}}` : ""}${own ? ` [${own}]` : ""}${(node as { hidden?: boolean }).hidden ? " HIDDEN" : ""}${cats ? ` <${cats}>` : ""}`,
    );
    if (rules) {
      const found = rulesOf(node);
      if (found.length) {
        lines.push(
          `${ind}  rules: ${found.map((r) => `${r.label}${r.hidden ? "(H)" : ""}${r.conditional ? "(?)" : ""}`).join(", ")}`,
        );
      }
    }
    if (depth >= max) return;
    const record = target as unknown as Record<string, NodeLike[] | undefined>;
    for (const key of ["selectionEntryGroups", "selectionEntries", "entryLinks"]) {
      for (const child of record[key] ?? []) walk(child, depth + 1, key === "entryLinks");
    }
  };
  const record = root as unknown as Record<string, NodeLike[] | undefined>;
  // A node (entry, link, group) is its own first line; only a catalogue is a list of roots.
  if (!(root as Catalogue).isCatalogue?.()) {
    walk(root as NodeLike, 0, Boolean((root as { targetId?: string }).targetId));
    return lines.join("\n");
  }
  const rootKeys = shared
    ? ["entryLinks", "selectionEntries", "selectionEntryGroups", "sharedSelectionEntries", "sharedSelectionEntryGroups"]
    : ["entryLinks", "selectionEntries", "selectionEntryGroups"];
  for (const key of rootKeys) {
    const children = record[key];
    if (!children?.length) continue;
    if (shared) lines.push(`== ${key}`);
    for (const child of children) walk(child, 0, key === "entryLinks");
  }
  return lines.join("\n") || "(no entries)";
}

/**
 * The catalogue as a table of contents rather than as three hundred rows: what each array
 * holds, by count and by name. Names are capped, because a file with 200 shared profiles is
 * asking to be searched, not listed.
 */
function catalogueSummary(catalogue: Catalogue): Record<string, unknown> {
  const CAP = 60;
  const out: Record<string, unknown> = {};
  const record = catalogue as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      if (!arrayKeys.has(key) || !value.length) continue;
      const names = (value as NodeLike[]).map((n) => n.name ?? labelOf(n));
      out[key] = {
        count: names.length,
        names:
          names.length > CAP ? [...names.slice(0, CAP), `… ${names.length - CAP} more (nr_find path:"${key}")`] : names,
      };
      continue;
    }
    if (!goodJsonKeys.has(key) || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

type ErrorSnapshot = Map<string, ReturnType<typeof errorRow>>;

function errorSnapshot(): ErrorSnapshot {
  const out: ErrorSnapshot = new Map();
  for (const catalogue of catalogues()) {
    for (const error of errorsOf(catalogue)) {
      const projected = errorRow(error, catalogue);
      out.set(`${projected.catalogue}|${projected.msg}|${projected.at?.path ?? ""}`, projected);
    }
  }
  return out;
}

/**
 * What an edit did to the diagnostics, as the findings themselves rather than a count. A bare
 * "18 -> 19" made every result end with the same question -- which one, and is it mine? -- and a
 * separate nr_diagnosis call to answer it. Absent when nothing changed.
 */
function errorDelta(before: ErrorSnapshot): { errors?: unknown } {
  const after = errorSnapshot();
  const added = [...after].filter(([key]) => !before.has(key)).map(([, error]) => error);
  const fixed = [...before].filter(([key]) => !after.has(key)).map(([, error]) => error);
  if (!added.length && !fixed.length) return {};
  return {
    errors: {
      before: before.size,
      after: after.size,
      new: added.slice(0, 8),
      ...(added.length > 8 ? { newNotShown: added.length - 8 } : {}),
      fixed: fixed.slice(0, 8).map((error) => error.msg),
    },
  };
}

type Counter = Map<string, number>;
const bump = (counter: Counter, key: string, by = 1) => counter.set(key, (counter.get(key) ?? 0) + by);
const top = (counter: Counter, n = 10) =>
  [...counter]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => `${key} ×${count}`);

/**
 * How this system writes its data, read off the loaded files rather than written down.
 *
 * Every convention here is one an agent had to reverse-engineer on The Old World before it could
 * write a single node: where the special rules hang, how a parameterised rule is spelled, that
 * chariot crew are typed 'crew', which category gates the magic items, what the per-thousand
 * cap looks like in full. None of it is in the format docs because none of it is the format --
 * it is how one repository chose to use it. Counting it is cheap; guessing it is not.
 */
function conventionsReport(targets: Catalogue[]) {
  const files = targets.filter((c) => !c.isGameSystem());
  const scope = files.length ? files : targets;
  const report: Record<string, unknown> = { catalogues: scope.map((c) => c.name) };

  const rulesWhere: Counter = new Map();
  const groupNames: Counter = new Map();
  const typesByDepth: Counter = new Map();
  const paramExamples: Array<Record<string, unknown>> = [];
  const commentTags: Counter = new Map();
  const categoryNames: Counter = new Map();
  let units = 0;
  let firstUnit: NodeLike | undefined;
  const ids: string[] = [];

  const typeOf = (n: NodeLike) => ((n as { target?: NodeLike }).target ?? n) as NodeLike & { type?: string };
  for (const catalogue of scope) {
    const roots = [
      ...((catalogue.entryLinks ?? []) as unknown as NodeLike[]),
      ...((catalogue.selectionEntries ?? []) as unknown as NodeLike[]),
    ];
    for (const category of (catalogue.categoryEntries ?? []) as unknown as NodeLike[])
      bump(categoryNames, category.name ?? "?");
    for (const root of roots) {
      const target = typeOf(root);
      if (target.type !== "unit") continue;
      units += 1;
      firstUnit ??= root;
      if (ids.length < 3 && target.id) ids.push(target.id);
      const census = (node: NodeLike, prefix: string, depth: number) => {
        const record = node as NodeLike & {
          infoGroups?: Array<NodeLike & { infoLinks?: NodeLike[] }>;
          infoLinks?: NodeLike[];
          rules?: NodeLike[];
          selectionEntries?: NodeLike[];
          type?: string;
        };
        for (const group of record.infoGroups ?? []) {
          bump(rulesWhere, `${prefix}.infoGroups[].infoLinks`, group.infoLinks?.length ?? 0);
          bump(groupNames, group.name ?? "?");
          for (const link of group.infoLinks ?? []) {
            const mods = (link as { modifiers?: ModifierNode[] }).modifiers ?? [];
            const pure = mods.length > 0 && mods.every((m) => m.field === "name");
            // The cleanest example wins: a link whose only modifier is the "(X)" suffix.
            if (pure && !paramExamples.some((e) => e.pure)) {
              paramExamples.unshift({ pure, on: `${prefix}: ${labelOf(node)}`, link: toJson(link) });
            } else if (!pure && mods.some((m) => m.field === "name") && !paramExamples.length) {
              paramExamples.push({ pure, on: `${prefix}: ${labelOf(node)}`, link: toJson(link) });
            }
          }
        }
        const ruleLinks = (record.infoLinks ?? []).filter(
          (l) => l.editorTypeName === "ruleLink" || isRuleLike((l as { target?: NodeLike }).target),
        );
        if (ruleLinks.length) bump(rulesWhere, `${prefix}.infoLinks(rule-like)`, ruleLinks.length);
        if (record.rules?.length) bump(rulesWhere, `${prefix}.rules`, record.rules.length);
        if (depth < 3) {
          for (const child of record.selectionEntries ?? []) {
            const type = (child as { type?: string }).type ?? "(no type)";
            bump(typesByDepth, `depth ${depth + 1}: ${type}`);
            census(child, type === "model" ? "model" : type, depth + 1);
          }
        }
      };
      census(target, "unit", 0);
    }
    // Comment tags: what scripts stamp on what they write. Counted over logic and link arrays
    // only; a comment on an entry is a note to a person, not a tag.
    for (const node of search(catalogue, "is:*", { includeImports: false })) {
      const key = (node as NodeLike).parentKey ?? "";
      if (!LOGIC.has(key) && key !== "constraints" && key !== "categoryLinks" && key !== "costs") continue;
      const comment = (node as Commented).comment;
      if (comment) bump(commentTags, `${key}: "${comment}"`);
    }
  }

  report.units = units;
  report.rulesAttachedAt = top(rulesWhere, 6);
  report.infoGroupNames = top(groupNames, 5);
  report.entryTypesByDepth = top(typesByDepth, 12);
  report.parameterisedRuleExample = paramExamples[0]
    ? { on: paramExamples[0].on, link: paramExamples[0].link }
    : "none found: rules are linked without name modifiers";
  report.idStyle = ids;
  report.scriptTaggedNodes = top(commentTags, 8);
  report.scriptTaggedNote = commentTags.size
    ? "nr_read and json() collapse runs of these; expand:true / {collapse:false} shows them. Re-running the script that wrote them replaces its own output."
    : undefined;

  // Categories: what caps exist, and one per-N cap in full -- the shape people get wrong most.
  const perN: Array<Record<string, unknown>> = [];
  for (const catalogue of scope) {
    for (const category of (catalogue.categoryEntries ?? []) as unknown as NodeLike[]) {
      const withRepeat = [...ownModifiers(category as unknown as WithModifiers)].some((m) => m.repeats?.length);
      if (withRepeat && perN.length < 1) perN.push({ catalogue: catalogue.name, category: toJson(category) });
    }
  }
  report.categories = { count: categoryNames.size, names: [...categoryNames.keys()].slice(0, 30) };
  report.perNCapExample = perN[0] ?? "none in these catalogues";

  // Faction gating: categories in the game system named for factions, and whether this file
  // links one -- the mechanism shared item files use to show per-faction options.
  const gst = catalogues().find((c) => c.isGameSystem());
  const factionCategories = ((gst?.categoryEntries ?? []) as unknown as NodeLike[])
    .map((c) => c.name ?? "")
    .filter((name) => /^faction\b/i.test(name));
  if (factionCategories.length) {
    const linked = new Set<string>();
    for (const catalogue of scope) {
      for (const root of (catalogue.entryLinks ?? []) as unknown as Array<NodeLike & { categoryLinks?: NodeLike[] }>) {
        // The link may sit on the root link or on the shared unit it points at.
        const target = (root as { target?: NodeLike & { categoryLinks?: NodeLike[] } }).target;
        for (const holder of [root, target]) {
          for (const link of holder?.categoryLinks ?? [])
            if (/^faction\b/i.test(link.name ?? "")) linked.add(link.name!);
        }
      }
    }
    report.factionGating = {
      gameSystemCategories: factionCategories.length,
      thisFileLinks: [...linked],
      how: "shared files test 'ancestor is <Faction: X>' to show a faction's items; a new faction file needs its own category and links on its root entries",
    };
  }

  // Profile types, by name: names are enough to add a profile.
  const profileTypes = new Map<string, string[]>();
  for (const catalogue of scope) {
    for (const type of catalogue.iterateProfileTypes()) {
      if (type.name && !profileTypes.has(type.name)) {
        profileTypes.set(
          type.name,
          (type.characteristicTypes ?? []).map((c) => c.name ?? "?"),
        );
      }
    }
  }
  report.profileTypes = Object.fromEntries(profileTypes);

  if (firstUnit) {
    report.exampleUnit = {
      tree: tree(firstUnit, { depth: 3, exclude: ["Magic Items", "Magic Standards"] }),
      firstModelRaw: (() => {
        const target = typeOf(firstUnit!) as NodeLike & { selectionEntries?: NodeLike[] };
        const model = (target.selectionEntries ?? []).find((c) => (c as { type?: string }).type === "model");
        return model ? toJson(model, { depth: 1, exclude: ["Magic Items"] }) : undefined;
      })(),
    };
  }
  return report;
}

// #endregion

const TOOLS: WebMcpTool[] = [
  {
    name: "nr_docs",
    description: `READ THIS FIRST, before any other nr_ tool. With no argument: how to drive the
editor safely, plus the index of the documentation. With page: that page's text. Pages under
"editor/" describe these tools' own API (eval scope, data shapes, the loaded system's
conventions) and live here; the rest is the official wiki, fetched live -- so you can read the
docs whether or not you have web access of your own.`,
    inputSchema: {
      type: "object",
      properties: {
        page: {
          type: "string",
          description:
            'A path from the index: "editor/eval", "editor/writing", "editor/conventions", "guide/concepts/modifiers", ... or "all"',
        },
        catalogue: {
          type: "string",
          description: 'For "editor/conventions": which catalogue to read (default: all loaded)',
        },
      },
    },
    execute: async (args) => {
      const page = asString(args.page);
      const local = page ? EDITOR_PAGES[page] : undefined;
      if (local) return { page, text: local.text };
      if (page === "editor/conventions") return conventionsReport(pick(asString(args.catalogue)));
      if (page && page !== "all") return { page, text: await docPage(page) };

      let pages: string[] = [];
      let note: string | undefined;
      try {
        pages = await docPages();
      } catch (error) {
        note = `Could not reach ${DOCS_SITE} (${error}). The briefing below still applies, but read the docs before editing data.`;
      }
      const editor = {
        ...Object.fromEntries(Object.entries(EDITOR_PAGES).map(([path, { about }]) => [path, about])),
        "editor/conventions": "how the LOADED system writes its data, with live examples (also nr_conventions)",
      };
      if (page === "all") {
        if (!pages.length) throw new Error(note);
        const wanted = pages.filter((path) => !NOT_ABOUT_DATA.has(path));
        const texts = await Promise.all(wanted.map(async (path) => `\n\n===== ${path} =====\n${await docPage(path)}`));
        return {
          briefing: BRIEFING,
          docs:
            Object.entries(EDITOR_PAGES)
              .map(([path, { text }]) => `\n\n===== ${path} =====\n${text}`)
              .join("") + texts.join(""),
          skipped: pages.filter((path) => NOT_ABOUT_DATA.has(path)),
        };
      }
      return {
        briefing: BRIEFING,
        readFirst: [
          "editor/conventions",
          "editor/writing",
          "editor/eval",
          "guide/concepts/modifiers",
          "guide/recipes/army-limits",
        ],
        editor,
        site: DOCS_SITE,
        pages,
        note,
      };
    },
  },
  {
    name: "nr_systems",
    description: `Every game system you could open -- one per game, from the working folder and the
browser store -- whether or not it is loaded.

loaded is no/partial/full. Only "full" is safe to search or edit across: a partial system answers
queries from the files that happen to be open, so a cross-catalogue question gets a confident
answer drawn from half the data. nr_load_system fixes that.`,
    inputSchema: { type: "object", properties: {} },
    execute: async () => {
      const systems = (await systemRows()).map((row) => {
        const live = loadedSystemFor(row);
        return {
          name: row.name,
          id: live?.getId() ?? row.id,
          source: row.source,
          path: row.path,
          loaded: !live?.gameSystem ? "no" : live.allLoaded ? "full" : "partial",
          catalogues: live?.getAllLoadedCatalogues().length ?? 0,
        };
      });
      const note = await folderProblem();
      return note ? { systems, note } : systems;
    },
  },
  {
    name: "nr_load_system",
    description: `Load a system and every catalogue in it, which is what the other tools need to see
the whole picture. Refuses if it is already fully loaded, so it is safe to call when unsure.
force re-reads the files from disk, picking up edits made outside the editor; it refuses while
anything is unsaved rather than discarding it. Pass catalogue to load just one instead of all,
when a big system takes too long.`,
    inputSchema: {
      type: "object",
      properties: {
        system: { type: "string", description: "Name or id, from nr_systems" },
        catalogue: { type: "string", description: "Load only this one, by name or id" },
        force: { type: "boolean", description: "Re-read from disk even if loaded" },
      },
      required: ["system"],
    },
    execute: async (args) => {
      const force = args.force === true;
      const only = asString(args.catalogue);
      const row = await findSystem(requireString(args.system, "system"));
      const existing = loadedSystemFor(row);
      if (existing?.allLoaded && !only && !force) {
        throw new Error(`"${row.name}" is already fully loaded. Pass force:true to re-read it from disk.`);
      }
      if (force && existing) {
        const dirty = unsavedIn(existing);
        if (dirty.length) {
          throw new Error(
            `Re-reading "${row.name}" would discard unsaved edits in: ${dirty.join(", ")}. nr_save first.`,
          );
        }
      }

      let id = existing?.getId() ?? row.id;
      if (!existing?.gameSystem || force) {
        if (row.path) id = (await store().load_systems_from_folder(row.path))?.[0] ?? id;
        else if (id) await store().load_system_from_db(id);
      }
      if (!id) throw new Error(`Read no system out of ${row.path ?? row.name}`);
      const system = store().gameSystems[id];

      if (only) {
        const files = system.getAllCatalogueFiles().map(getDataObject);
        const file = resolveOne(
          files,
          only,
          (f) => f.id,
          (f) => f.name ?? "",
          `catalogue in ${row.name}`,
        );
        const loaded = await system.loadCatalogue({ targetId: file.id });
        // Same order open_catalogue uses: the root has to be processed before its imports exist.
        loaded.processForEditor();
        for (const imported of loaded.imports ?? []) imported.processForEditor();
      } else {
        await system.loadAll();
      }

      return {
        system: system.gameSystem?.gameSystem.name,
        id,
        loaded: system.getAllLoadedCatalogues().length,
        files: system.getAllCatalogueFiles().length,
        fullyLoaded: Boolean(system.allLoaded),
        errors: systemErrors(system),
      };
    },
  },
  {
    name: "nr_unload_system",
    description:
      "Drop a system's loaded catalogues and derived state, freeing the memory. The files stay, so nr_load_system brings it back without touching disk. Refuses while anything is unsaved.",
    inputSchema: {
      type: "object",
      properties: { system: { type: "string", description: "Name or id" } },
      required: ["system"],
    },
    execute: async (args) => {
      const row = await findSystem(requireString(args.system, "system"));
      const system = loadedSystemFor(row);
      if (!system?.gameSystem) throw new Error(`"${row.name}" is not loaded.`);
      const dirty = unsavedIn(system);
      if (dirty.length) throw new Error(`"${row.name}" has unsaved edits in: ${dirty.join(", ")}. nr_save first.`);
      const freed = system.getAllLoadedCatalogues().length;
      system.unloadAll();
      return { unloaded: row.name, catalogues: freed };
    },
  },
  {
    name: "nr_create_system",
    description:
      "Create an empty game system -- one default category, force and root entry -- in the working folder, and load it. Written to disk immediately.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        format: { type: "string", description: '"gst" (default), "gstz" or "json"' },
        folder: { type: "string", description: "Parent folder; defaults to the editor's working folder" },
      },
      required: ["name"],
    },
    execute: async (args) => {
      const name = requireString(args.name, "name");
      const format = asString(args.format) ?? "gst";
      if (!FORMATS.includes(format as (typeof FORMATS)[number])) {
        throw new Error(`"format" must be one of ${FORMATS.join(", ")}`);
      }
      const folder = asString(args.folder) ?? useSettingsStore().systemsFolder ?? "";
      const files = await store().create_system(name, folder || undefined, format);
      await files.loadAll();
      return {
        created: name,
        id: files.getId(),
        path: files.gameSystem?.gameSystem.fullFilePath ?? "(browser storage only)",
      };
    },
  },
  {
    name: "nr_catalogues",
    description: `What the editor has open right now: each system, its loaded catalogues, the error count
on each and whether it has unsaved edits. Start here to orient -- it is one call and it tells you
which file a name belongs to before you go looking for ids.`,
    inputSchema: { type: "object", properties: {} },
    execute: () =>
      catalogues().map((catalogue) => ({
        id: catalogue.id,
        name: catalogue.name,
        gameSystem: catalogue.gameSystemId,
        isGameSystem: catalogue.isGameSystem(),
        errors: errorsOf(catalogue).length,
        unsaved: Boolean(store().get_catalogue_state(catalogue)?.unsaved),
      })),
  },
  {
    name: "nr_diagnosis",
    description: `Every diagnostic the editor holds on the loaded data: dead links, ids used twice,
invalid scopes, pointless recursion, comments marked todo/warning/error -- each with the node it
sits on. Named for what it is: the editor's own reading of the file, the same one the user sees.

This is how a data change is tested, and it only works as a PAIR. Call it before you edit and
write the count down; call it after and compare. A count that went up means the edit broke
something, and undo() plus a rethink is cheaper than finding out later.

It cannot tell you a VALUE is wrong, only that the file no longer hangs together. A points cost
typed as 45 instead of 54 passes every rule here, and that is the error a player actually meets.

only: run named rules instead of reading the stored ones, including rules that are switched off
because they are correct but rarely the answer. "unused" is the one that exists: on The Old World
it reports 1000 findings against the 23 that matter, because a shared entry nobody links to is
usually a library item or a work in progress, not a defect. Ask for it when tidiness is the
question, not as a survey. Running rules this way changes nothing -- nothing is written to the
nodes and the user's error list is untouched.`,
    inputSchema: {
      type: "object",
      properties: {
        catalogue: { type: "string", description: "Name or id; omit for all loaded catalogues" },
        limit: { type: "number", description: "Max findings to return (default 100)" },
        only: {
          type: "array",
          items: { type: "string" },
          description:
            'Diagnostic ids to run instead of reading the stored ones, e.g. ["unused"]. ' +
            "An unknown id errors and lists what exists.",
        },
      },
    },
    execute: (args) => {
      const limit = asNumber(args.limit, 100);
      const catalogues = pick(asString(args.catalogue));
      const only = Array.isArray(args.only) ? args.only.map((id) => requireString(id, "only[]")) : undefined;
      if (!only?.length) {
        const found = catalogues.flatMap((catalogue) => errorsOf(catalogue).map((error) => errorRow(error, catalogue)));
        return {
          total: found.length,
          shown: Math.min(found.length, limit),
          errors: found.slice(0, limit),
          available: [...DIAGNOSTICS, ...OPTIONAL_DIAGNOSTICS].map((rule) => rule.id),
        };
      }
      const rules = only.map((id) => {
        const rule = diagnosticById(id);
        if (!rule) {
          const known = [...DIAGNOSTICS, ...OPTIONAL_DIAGNOSTICS].map((one) => one.id).join(", ");
          throw new Error(`No diagnostic "${id}". Available: ${known}`);
        }
        return rule;
      });
      // Run, do not register: applies/check are called straight, so nothing reaches the store and
      // the editor's own error list -- the one the user is looking at -- is left exactly as it was.
      const found: ReturnType<typeof errorRow>[] = [];
      for (const catalogue of catalogues) {
        const ctx = catalogue.diagnosticContext();
        for (const node of search(catalogue, "is:*", { includeImports: false })) {
          for (const rule of rules) {
            try {
              if (!rule.applies(node)) continue;
              const finding = rule.check(node, ctx);
              if (!finding) continue;
              const message = typeof finding === "string" ? finding : finding.msg;
              found.push(
                errorRow(
                  {
                    msg: message,
                    severity: finding && typeof finding === "object" ? finding.severity : undefined,
                    source: node,
                  },
                  catalogue,
                ),
              );
            } catch (error) {
              // Same rule as the engine: one broken rule must not take the others down.
              console.error(`Diagnostic "${rule.id}" threw`, error);
            }
          }
        }
      }
      return { ran: only, total: found.length, shown: Math.min(found.length, limit), errors: found.slice(0, limit) };
    },
  },
  {
    name: "nr_find",
    description: `Find nodes. A row LOCATES something; it does not tell you what it does -- for that,
nr_read the id it carries. Judging a node from a search row is how "max 0" gets reported as a hard
limit when a modifier raises it.
A condition, modifier or repeat has no id of its own, so its row carries "in" instead: the entry,
link or group it hangs on, with that one's id. That is the id to nr_read -- and the thing to group
by when a query over conditions is really a question about the entries holding them.
Bare words match name/comment/description text -- all of them, any order. Beyond that:
  is:*                              EVERY node. This is how you walk the tree; see below.
  is:entry|group|constraint|condition|modifier|profile|rule|entryLink   node kind
  -is:entryLink                     negate any term
  scope:force childId:any           any field by its real name; "any" means present
  id:none                           ...and "none" means absent
  name=Scouts                       exact, not substring (":" is substring). Same as name:=Scouts
  value:>0   refs:0                 numeric compare; on an array, its length
  has:constraint[scope:force]       a descendant matches the bracketed query
  in:entry["bolt rifle"]            an ancestor matches
  has*:  in*:                       the same, following links the way the builder does
  label:"at least 1"                the rendered text of a condition or modifier
  target:*[is:group]  refs:*[...]   across a link, either direction
  mentions:*[...]                   conditions/modifiers naming this node by id
  catalogue:"my cat"  shared:true   which file; shared array or shared="true"

THE UNIVERSE THIS SEARCHES is every node of every catalogue given plus its imports, walked in
full -- conditions, modifiers, constraints, characteristics and costs included. It is not the
catalogue's id index, which holds only nodes that have an id: on a real system that is a few
percent of the tree and none of the conditions. Never count anything off catalogue.index.

To list one kind of thing, prefer the path argument over a query -- path:"sharedProfiles".
Terms are ANDed, | ORs within one term, quotes hold a phrase. Quoting also escapes ":" and "="
in a bare word. An unknown field name matches nothing rather than erroring, so check spelling
before concluding none exist -- nr_fields lists the field and scope vocabulary.`,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Query, see the tool description" },
        type: {
          type: "string",
          description: 'Deprecated, same as adding "is:<type>" to the query',
        },
        catalogue: { type: "string" },
        path: {
          type: "string",
          description:
            'Search only this array of each catalogue, e.g. "sharedProfiles", "sharedSelectionEntries". ' +
            "Scopes the walk rather than filtering it, so it is the cheap way to list one kind, and it " +
            "bounds what has:/in: can see. With a path, query may be empty to mean everything under it.",
        },
        includeImports: { type: "boolean", description: "Search each catalogue's imports too. Default true" },
        followLinks: { type: "boolean", description: "Make every has:/in: follow links, as has*:/in*: do" },
        limit: { type: "number", description: "Default 50" },
      },
      required: ["query"],
    },
    execute: (args) => {
      const type = asString(args.type);
      const path = asString(args.path);
      // A path is a scope, so it stands on its own; without one an empty query is a mistake.
      const asked = path === undefined ? requireString(args.query, "query") : (asString(args.query) ?? "");
      const query = asked + (type ? ` is:${type}` : "");
      const limit = asNumber(args.limit, 50);
      const hits = search(pick(asString(args.catalogue)), query, {
        path,
        includeImports: args.includeImports !== false,
        followLinks: args.followLinks === true,
      }).map((node) => row(node));
      return { total: hits.length, shown: Math.min(hits.length, limit), entries: hits.slice(0, limit) };
    },
  },
  {
    name: "nr_fields",
    description: `The vocabulary a condition, constraint, modifier or repeat may use -- the same lists
the right panel's dropdowns offer, so a query written against these is one the editor could have
produced. Cost types are per-system, which is why this is a call and not a fixed list.

Read it before writing a field or scope by hand: "limit::<costTypeId>" and slug ids like
"may-have-armour" are both legal and neither looks like an id, so a check that assumes otherwise
reports confident nonsense.`,
    inputSchema: {
      type: "object",
      properties: { catalogue: { type: "string", description: "Name or id; omit for all loaded catalogues" } },
    },
    execute: (args) => {
      const costs = new Map<string, string>();
      const profileTypes = new Map<string, { id: string; name: string; characteristics: string[] }>();
      for (const catalogue of pick(asString(args.catalogue))) {
        for (const cost of catalogue.iterateCostTypes()) if (cost.id) costs.set(cost.id, cost.name ?? cost.id);
        for (const type of catalogue.iterateProfileTypes()) {
          if (!type.id || profileTypes.has(type.id)) continue;
          profileTypes.set(type.id, {
            id: type.id,
            name: type.name ?? type.id,
            characteristics: (type.characteristicTypes ?? []).map((c) => c.name ?? c.id ?? "?"),
          });
        }
      }
      return {
        // Names are enough when adding a profile: give typeName and the characteristic names
        // and the Fix-profiles hook fills every typeId in as the node lands.
        profileTypes: [...profileTypes.values()],
        field: {
          fixed: ["selections", "forces", "associations"],
          costs: [...costs].map(([id, name]) => ({ id, name })),
          // The one that reads as a broken id but is not: it caps a cost rather than counting it.
          limits: [...costs].map(([id, name]) => ({ id: `limit::${id}`, name: `${name} Limit` })),
        },
        scope: {
          fixed: [...validScopes],
          // "<scope>-self" includes the node carrying the query as a candidate, not only its ancestors.
          selfSuffixAllowedOn: [...selfableScopes],
          orAnyIdOf: "a category, force, catalogue or entry -- ids are values here, not just names",
        },
        childId: {
          fixed: [...validChildIds],
          orAnyIdOf: "an entry, group or category",
        },
        conditionType: [
          "atLeast",
          "atMost",
          "lessThan",
          "greaterThan",
          "equalTo",
          "notEqualTo",
          "instanceOf",
          "notInstanceOf",
          "before",
          "always",
          "never",
        ],
        constraintType: ["min", "max"],
        // Every field name the format writes, minus the child arrays. NOT per node type: which
        // of these a given type accepts is declared in TypeScript and gone at runtime, so this
        // is the widest honest answer. nr_read shows which are set on one node.
        anyNodeField: [...goodJsonKeys].filter((key) => !arrayKeys.has(key)).sort(),
        childArrays: [...arrayKeys].sort(),
      };
    },
  },
  {
    name: "nr_read",
    description: `Open one node the way the editor shows it -- and the way a search row cannot.

Three things here are wrong or invisible if you read the raw data yourself, and all three have
produced confident false conclusions:
  modifiedBy   a constraint's value is not its value. "max 0" is routinely a base that a modifier
               raises, conditionally or per N models, so a constraint read alone says the opposite
               of what the entry allows.
  target       a link is mostly its target. Its own fields are a name and a few overrides; the
               statline, cost and children live in another file, resolved here.
  self/flags   the editor DELETES a boolean set to its default, so "absent" means off on one node
               type and "does not apply" on another. Filled in from the same table the right
               panel uses.
Ids are NOT unique across catalogues -- a faction file forked from another keeps the original's
ids. When the id is in more than one loaded file you get ALL of them, as {matches:[...]}; pass
catalogue to narrow it to one.

modifiedBy is the part a constraint cannot be read without. A "max 0" is routinely a base value
that a modifier raises, so a constraint read on its own says the opposite of what the entry
actually allows. Each row is:
  does           the modifier as the tree renders it, e.g. "increment max 1"
  when           the conditions gating it, if any
  repeat         a multiplier, NOT a gate: "+1 for every 3 Skink Handlers"
  unconditional  present only when there is neither -- the value really is flat
  on             set when the modifier rides a link pointing here rather than this node itself
A modifier only reaches constraints on its own node or on a node linking to it, so this is
walked from here rather than looked up by id: constraint ids repeat across entries, and an id
keyed globally collects modifiers that cannot touch this node at all.

fields is every field the format defines that this node actually carries -- absent means UNSET,
not unavailable. There is no per-type schema at runtime, so nothing here can tell you a field is
inapplicable; nr_fields lists every field name any node can have. The six booleans are the one
place that distinction is load-bearing and they get answered properly:

flags are those six as the right panel shows them, with defaults filled in and inapplicable ones
omitted. Turning one off DELETES the attribute, so a raw read cannot tell "collective is false"
from "collective means nothing here"; only the keys present are questions this node can answer.

self is the node as the object it is: every field the format stores, plus its arrays turned into
concise rows -- not a hand-drawn split into fields/flags/children. Editor bookkeeping is filtered
out, ids answer as {id, name}, and the booleans the editor DELETES when set to their default
(collective, hidden, import, exportable, flatten, collapsible) are filled back in where they
apply, so an absent one means unset rather than off.

target is the SAME projection of what a link points at, so "set here or inherited?" is answered
by comparing the two rather than by an extra key per thing that can differ: self.collective false
next to target.self.collective true says the link sets nothing and the entry it points at is
collective. An unresolved link answers {unresolved: id}, and errors says where that id went.

Each row inside an array is the glance a tree row gives, carrying only what says something: name,
type, costs, refs, collective, errors, value on a characteristic or cost, hasChildren (there is
something to open), fromTarget (a link whose target has content -- what the tree draws in another
colour), unresolved.

A row's ADDRESS is its array key and its position in that array: the third row under entryLinks
is "entryLinks[2]". Nothing is filtered out of these arrays, so position always is the index.
Pass it as "at" to open that child as the root -- nr_read {id, at:"selectionEntries[0]"} -- and
steps chain with dots, relative to whatever you last read. That is also the only way to read a
node with NO id: conditions, modifiers and constraints are addressed by array and index. A step a
LINK cannot answer is retried on its target, so "entryLinks[4].selectionEntries[0]" walks into
what the link brings in, the way opening one in the tree does.

Rows are one level deep. The exception is modifiers, modifierGroups, conditions, conditionGroups,
localConditionGroups and repeats: those carry their own arrays inline, however deep, because a
modifier shown without its conditions reads as unconditional when it is not.

parents is where this node hangs, nearest ancestor first, up to the catalogue. path says that in
names; parents says it with the id of each step, so an ancestor is something to nr_read rather
than something to go searching for by name. Logic ancestors appear without ids, because a
condition inside a conditionGroup is not the same thing as one directly on the modifier.

refs counts links pointing here; mentions counts conditions naming it by id (scope/childId) and
modifiers whose value is it. Both zero on a shared entry means nothing uses it. To see who they
are: nr_find "refs:*[...]" or "mentions:*[...]".

Fields holding an id answer as {id, name}, so a scope or childId reads as the thing it names.

Runs of siblings that share a comment -- the caps and modifiers a script stamps onto every root
entry -- come back as one {collapsed} line each; expand:true lists them. A catalogue id answers
with a table of contents (counts and names per array) rather than every row.

raw:true answers with the node AS THE FILE STORES IT instead of the projection above: the exact
keys add() and merge() take, logic arrays whole, entry arrays down to "depth" (default 1). Read a
node raw when you are about to write one like it.`,
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Node id, from nr_find" },
        catalogue: { type: "string", description: "Which file, when the id is in more than one" },
        at: {
          type: "string",
          description:
            'Open a child instead, by the "at" its row carries: "selectionEntries[0]", or ' +
            '"selectionEntries[0].constraints[1]" to go further. This is how nodes with no id ' +
            "-- conditions, modifiers, constraints -- are read.",
        },
        raw: { type: "boolean", description: "The file shape, ready to feed back to add()/merge()" },
        depth: { type: "number", description: "With raw: how deep entry arrays go (default 1)" },
        expand: { type: "boolean", description: "Do not collapse comment-tagged runs of siblings" },
      },
      required: ["id"],
    },
    execute: (args) => {
      const id = requireString(args.id, "id");
      const at = asString(args.at);
      const raw = args.raw === true;
      const expand = args.expand === true;
      const depth = asNumber(args.depth, 1);
      // index is per-catalogue and holds only that file's own nodes, so more than one hit really
      // is the same id in two files rather than a node seen through an import. A catalogue is
      // not in its own index -- nothing indexes the root -- so it needs asking about separately,
      // or nr_read answers "no such node" for the one id nr_catalogues hands out.
      const holders = pick(asString(args.catalogue)).filter(
        (catalogue) => catalogue.id === id || catalogue.index?.[id],
      );
      if (!holders.length) {
        throw new Error(`No node with id "${id}" in the loaded catalogues.`);
      }
      const read = (catalogue: Catalogue) => {
        const found = (catalogue.id === id ? catalogue : catalogue.index![id]) as unknown as NodeLike;
        const node = at ? resolveAt(found, at) : found;
        if (raw) return toJson(node, { depth, collapse: !expand });
        if (node === (catalogue as unknown as NodeLike)) return catalogueSummary(catalogue);
        return readNode(node as Base & WithErrors, catalogue, undefined, expand);
      };
      if (holders.length === 1) return read(holders[0]); // Same id, different files, and often different rules under it -- which is worth seeing
      // rather than choosing between blind, so both come back.
      return {
        note: `Id "${id}" is in ${holders.length} loaded catalogues. Pass catalogue to narrow it.`,
        matches: holders.map(read),
      };
    },
  },
  {
    name: "nr_save",
    description: `Write one catalogue to disk. Only when asked: it is the user's window, and they may
want to review the change in it first. Does not prompt for a revision bump -- publishing here is a
git commit, not a save, so leave revision alone unless they ask.`,
    inputSchema: {
      type: "object",
      properties: {
        catalogue: { type: "string", description: "Name or id" },
        incrementRevision: { type: "string", description: '"yes", "no" (default) or "github"' },
      },
      required: ["catalogue"],
    },
    execute: async (args) => {
      const target = pickOne(requireString(args.catalogue, "catalogue"));
      const mode = asString(args.incrementRevision) ?? "no";
      if (!REVISION_MODES.includes(mode as RevisionMode)) {
        throw new Error(`"incrementRevision" must be one of ${REVISION_MODES.join(", ")}`);
      }
      // A game system file has no gameSystemId: it IS the system, keyed by its own id.
      const system = store().gameSystems[target.gameSystemId ?? target.id];
      if (!system) throw new Error(`No open system for catalogue "${target.name}"`);
      const bumped = await store().save_catalogue(system, target, mode as RevisionMode);
      return {
        saved: target.name,
        path: getDataObject(target).fullFilePath ?? "(browser storage)",
        revision: target.revision,
        revisionIncremented: bumped,
      };
    },
  },
  {
    name: "nr_uninitialized",
    description:
      "Find nodes in the loaded tree that never had their class prototype set — plain JSON sitting where a Base subclass belongs. These are invisible until something calls a method on them, so run this after editing if a script starts throwing.",
    inputSchema: {
      type: "object",
      properties: {
        catalogue: { type: "string", description: "Name or id; omit for all loaded catalogues" },
        limit: { type: "number", description: "Max nodes to report (default 25)" },
      },
    },
    execute: (args) => {
      const limit = asNumber(args.limit, 25);
      const found: Array<{ catalogue: string; key: string; path: string; id?: string; name?: string }> = [];
      let scanned = 0;
      for (const catalogue of pick(asString(args.catalogue))) {
        // Walk the data tree only. Back-references (catalogue/parent/refs/target) would leave the
        // subtree and re-walk everything from every node, which is also why setPrototypeRecursive
        // stops at nodes that already have a prototype.
        const stack: Array<{ node: Record<string, unknown>; key: string; path: string[] }> = [
          { node: catalogue as unknown as Record<string, unknown>, key: "catalogue", path: [catalogue.name] },
        ];
        const seen = new WeakSet<object>();
        while (stack.length) {
          const { node, key, path } = stack.pop()!;
          if (seen.has(node)) continue;
          seen.add(node);
          scanned += 1;
          const proto: unknown = Object.getPrototypeOf(node);
          if ((proto === Object.prototype || proto === null) && (node.id !== undefined || node.name !== undefined)) {
            if (found.length < limit) {
              found.push({
                catalogue: catalogue.name,
                key,
                path: path.slice(-4).join(" / "),
                id: asString(node.id),
                name: asString(node.name),
              });
            }
          }
          for (const [childKey, value] of Object.entries(node)) {
            if (BACK_REFERENCES.has(childKey) || !value || typeof value !== "object") continue;
            const children = Array.isArray(value) ? value : [value];
            for (const child of children) {
              if (!child || typeof child !== "object") continue;
              const record = child as Record<string, unknown>;
              stack.push({ node: record, key: childKey, path: [...path, asString(record.name) ?? childKey] });
            }
          }
        }
      }
      return { scanned, uninitialized: found.length, nodes: found };
    },
  },
  {
    name: "nr_eval",
    description: `Run JavaScript in the editor page: the write tool, and the way to ask the data a
question no other tool answers. Body of an async function -- use return, not an expression. One
call is one undo entry, so keep a whole edit in one call.

The full API -- signatures, return values, quirks -- is nr_docs page "editor/eval"; the shapes
data takes when written are "editor/writing". Read both before the first write. In scope:
  read   find(query, catalogue?, opts?)   json(node, {depth, exclude, collapse})
         tree(node | catalogue, {depth, exclude, rules, shared})   rules(entry)
         row(node)  owner(node)  label(node)  $catalogues  $catalogue  $store  $h  help()
  write  set_field(node, key, value)   edit({...}, node | nodes)   add(data, childKey, parent)
         remove(node | nodes)   move(node, from, to, "root" | "shared")   merge(node, data)
         merge_duplicates(keep, dupes)   undo()   redo()
Catalogue names are matched exactly (id, name, or a substring that fits ONE file); an ambiguous
name throws rather than picking. Return plain data -- live nodes are turned into rows for you.
The result reports the diagnostics delta (new and fixed findings) and which files are unsaved.`,
    inputSchema: {
      type: "object",
      properties: { code: { type: "string", description: "Async function body" } },
      required: ["code"],
    },
    execute: async (args) => {
      const code = requireString(args.code, "code");
      const $store = store();
      const before = errorSnapshot();

      // Actions are plain functions on the store instance, already bound; taking them at call
      // time means a new action is in scope the moment it is added, which is the point of
      // exposing them at all. Skipped: Pinia's own $patch/$reset/$subscribe and _hotUpdate.
      const scope: Record<string, unknown> = {};
      // Helpers first, store actions second, so the three names they share -- add, remove, copy --
      // resolve to the undoable store action. Reaching a shadowed helper is what $h stays for.
      for (const [key, value] of Object.entries(helpers)) {
        if (typeof value === "function") scope[key] = value;
      }
      for (const key in $store) {
        // A key that is not a bare identifier would make `new Function` throw and take every
        // nr_eval call down with it, so it is skipped rather than trusted.
        if (key.startsWith("$") || key.startsWith("_") || !/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) continue;
        const value = ($store as unknown as Record<string, unknown>)[key];
        if (typeof value === "function") scope[key] = value;
      }
      const shadowed = Object.keys(helpers).filter((key) => typeof scope[key] === "function" && key in $store);
      Object.assign(scope, {
        $store,
        $catalogue: globalThis.$catalogue,
        $catalogues: catalogues(),
        find: (query: string, catalogue?: string, options?: SearchOptions) =>
          search(pick(catalogue), query, options ?? {}),
        row,
        owner: ownerOf,
        label: labelOf,
        json: (node: NodeLike, options?: JsonOptions) => toJson(node, options ?? {}),
        tree: (node: NodeLike | Catalogue, options?: TreeOptions) => tree(node, options ?? {}),
        rules: rulesOf,
        $h: helpers,
        // The scope is assembled from the live store, so a written-down list would drift the
        // first time an action is added. This one cannot.
        help: () => ({
          writes: ["set_field", "edit", "add", "remove", "merge", "merge_duplicates", "move", "undo", "redo"],
          reads: [
            "find",
            "query",
            "json",
            "tree",
            "rules",
            "row",
            "owner",
            "label",
            "$catalogue",
            "$catalogues",
            "$store",
            "$h",
          ],
          docs: 'nr_docs page "editor/eval" and "editor/writing"',
          storeActions: Object.keys(scope)
            .filter((key) => key in $store)
            .sort(),
          helpers: Object.keys(helpers).sort(),
          shadowedByStoreAction: shadowed,
        }),
      });

      // One call is one undo entry: the store actions each push their own, so collapse whatever
      // this body pushed into a single composite. Without it a 200-entry pass is 200 Ctrl+Z, and
      // a wrong pass is unreversible in practice.
      const stackStart = $store.undoStackPos;
      const names = Object.keys(scope);
      const fn = new Function(...names, `return (async () => {${code}})();`) as (
        ...args: unknown[]
      ) => Promise<unknown>;
      const result = await fn(...names.map((name) => scope[name]));
      $store.collapse_undo(stackStart, "script");

      return {
        result: scriptResult(result),
        ...errorDelta(before),
        unsaved: catalogues()
          .filter((c) => $store.get_catalogue_state(c)?.unsaved)
          .map((c) => c.name),
      };
    },
  },
  {
    name: "nr_conventions",
    description: `How the LOADED system writes its data, read off the files: where special rules
attach and what the infoGroup is called, how a parameterised rule ("Impact Hits (2)") is
spelled, which entry types appear at which depth (crew, mount...), what a per-N cap looks like
in full, which category gates the shared item files per faction, the profile types by name,
and what scripts have stamped onto every entry. Ends with one real unit as a tree and one
model raw. Read it before the first write into a system you have not edited before.`,
    inputSchema: {
      type: "object",
      properties: { catalogue: { type: "string", description: "Name or id; omit for all loaded catalogues" } },
    },
    execute: (args) => conventionsReport(pick(asString(args.catalogue))),
  },
  {
    name: "nr_scripts",
    description: `List the scripts loaded for a system, or read one's source.

A script is the persistent form of nr_eval: a .js file in the system's own \`scripts\` folder that
the editor loads every time that system is opened. Use one when the answer is a check or a fix the
user will want again -- a rule the built-in diagnostics do not cover, a bulk edit they repeat every
release. Use nr_eval for a one-off; a file the user has to maintain is not free.

Scripts contribute more than a Run button: \`hooks\` add right-click, toolbar and panel entries,
and \`diagnostics\` add checks that show in the tree and the error list like the built-in ones.
Those are live from the moment the system loads, whether or not anyone ran the script.`,
    inputSchema: {
      type: "object",
      properties: {
        system: { type: "string", description: "Name or id; omit when only one is open" },
        script: { type: "string", description: "Name or file path: returns its source too" },
      },
    },
    execute: async (args) => {
      const system = await scriptSystem(asString(args.system));
      const scripts = await store().scripts.load(system);
      const wanted = asString(args.script);
      if (wanted) {
        const found = store().scripts.find_script(wanted);
        if (!found) throw new Error(`No script named "${wanted}". Loaded: ${scripts.map((o) => o.name).join(", ")}`);
        return {
          ...scriptRow(found),
          // Built-ins are bundled .ts and have no file to read; nr_docs points at them on GitHub.
          source: found.path ? (await readFile(found.path)).data : "built in, not readable from here",
        };
      }
      return {
        folder: store().scripts.script_folder(system) ?? "this system has no folder on disk",
        scripts: scripts.map(scriptRow),
      };
    },
  },
  {
    name: "nr_script_write",
    description: `Create or replace a script file in the system's \`scripts\` folder, and load it.

This writes a file into the user's data folder and it stays there, so do it when they asked for a
script -- not as a way to run something once. Overwrites the file of the same name outright.

The file is a standalone ES module, default-exporting {name, description, arguments, run, hooks,
diagnostics}. It is loaded on its own, so imports must already be bundled into it; talk to the
editor through the global \`$store\` (the same actions nr_eval lists) and to disk through \`$node\`.

  export default {
    name: "Name shown on the Scripts page",
    description: "One line",
    arguments: [{ name: "catalogues", type: "catalogue[]" }],
    run(catalogues) { return ["<b>Found:</b>", catalogues.flatMap(c => ...)] },
  }

Argument types: catalogue, catalogue[], string, text, number, boolean, select (with \`options\`),
file, selection, selection[]. run() may return a number, a string (rendered as html), a node, an
array of nodes, [node, label] pairs, or an array of any of those.

Errors are reported back rather than thrown, so a syntax error comes back as \`loaded: false\` with
the message. Fix it and write again.`,
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: 'File name, e.g. "check-points.js". No path.' },
        code: { type: "string", description: "The whole module" },
        system: { type: "string", description: "Name or id; omit when only one is open" },
      },
      required: ["file", "code"],
    },
    execute: async (args) => {
      const system = await scriptSystem(asString(args.system));
      const entry = await store().scripts.write_script(
        system,
        requireString(args.file, "file"),
        requireString(args.code, "code"),
      );
      return { loaded: !entry.error, ...scriptRow(entry) };
    },
  },
  {
    name: "nr_script_run",
    description: `Run one script's run() and return what it produced. One call is one undo entry.

Arguments are given by name (or positionally) and resolved by their declared type the way the Run
panel resolves them: a "catalogue" is a name or id and is loaded and processed first, "catalogue[]"
defaults to every catalogue in the system, and "selection" is whatever the user has selected in
their tree right now. Anything not given falls back to the argument's default. Call nr_scripts
first to see what a script takes -- a script may edit hundreds of nodes, and the arguments are
usually what decides how many.`,
    inputSchema: {
      type: "object",
      properties: {
        script: { type: "string", description: "Name or file path, from nr_scripts" },
        args: { type: "object", description: "By argument name; an array is taken positionally" },
        system: { type: "string", description: "Name or id; omit when only one is open" },
      },
      required: ["script"],
    },
    execute: async (args) => {
      const system = await scriptSystem(asString(args.system));
      const before = errorSnapshot();
      // A "catalogue[]" argument loads the whole system, so findings appear that were always
      // there. The delta is keyed per finding, so those show as "new" only if genuinely new.
      const loadedBefore = catalogues().length;
      const result = await store().scripts.run_script_with_args(
        system,
        requireString(args.script, "script"),
        args.args as any[] | Record<string, unknown> | undefined,
      );
      // invoke() reports and returns what the script threw rather than rethrowing, so that the
      // Run panel can render it. Here it is a failed call.
      if (result instanceof Error) throw result;
      const opened = catalogues().length - loadedBefore;
      return {
        result: scriptResult(result),
        ...errorDelta(before),
        ...(opened ? { note: `${opened} more catalogues were loaded by the script's arguments` } : {}),
        unsaved: catalogues()
          .filter((c) => store().get_catalogue_state(c)?.unsaved)
          .map((c) => c.name),
      };
    },
  },
];

let docsRead = false;
let nagged = false;
let calls = 0;
let searches = 0;
let reads = 0;
let toldToRead = false;
const FEEDBACK_AFTER = 10;
/** Searches with nothing opened before it is worth saying so. Two is a lookup; five is a habit. */
const SEARCHES_WITHOUT_READING = 5;

/**
 * The two things worth saying mid-run, and the one thing worth saying at the end.
 *
 * A tool description is read once, when the client lists the tools, and by then a long run has
 * scrolled it far out of reach -- so the reminders that matter ride on results instead. Each
 * fires once per session and is one short line, because a note repeated on every result costs
 * more tokens than the docs it points at.
 */
function nudge(name: string): string | undefined {
  if (name === "nr_docs") {
    docsRead = true;
    return undefined;
  }
  calls += 1;
  if (name === "nr_find") searches += 1;
  if (name === "nr_read") reads += 1;
  if (!docsRead && !nagged) {
    nagged = true;
    return "Call nr_docs first — it is short, and covers what this data is for and which writes survive a reload.";
  }
  // Searching without opening anything is the shape of every wrong answer these tools have
  // produced: a row says a constraint is "max 0" and the modifier raising it is never seen.
  if (!toldToRead && searches >= SEARCHES_WITHOUT_READING && reads === 0) {
    toldToRead = true;
    return `${searches} searches and no nr_read — a row locates a node, it does not show its modifiers, its link target, or a flag the editor deleted.`;
  }
  if (calls === FEEDBACK_AFTER) {
    return "Before you finish: tell the user which tools were missing or awkward.";
  }
  return undefined;
}

export default defineNuxtPlugin(() => {
  const settings = useSettingsStore();
  // Opt-in, and off by default: an editor that quietly answers to anything on localhost is not a
  // default anyone chose. Registration happens once, the first time it is switched on -- neither
  // modelContext nor the relay embed can be taken back out of the page, so `mcpEnabled` is
  // enforced per call below instead, which also makes switching it off take effect immediately.
  if (settings.mcpEnabled) {
    start();
    return;
  }
  const stop = watch(
    () => settings.mcpEnabled,
    (on) => {
      if (!on) return;
      stop();
      start();
    },
  );
});

let started = false;

function start() {
  if (started) return;
  started = true;
  const settings = useSettingsStore();

  // Chrome only exposes modelContext behind the experimental-web-platform-features flag, so install
  // the polyfill first; it no-ops where a native implementation already exists.
  initializeWebMCPPolyfill();

  // navigator.modelContext is the deprecated alias; document.modelContext is where the spec landed.
  const owner = document as unknown as { modelContext?: ModelContext };
  const legacy = navigator as unknown as { modelContext?: ModelContext };
  const mc = owner.modelContext ?? legacy.modelContext;
  if (!mc?.registerTool) {
    console.info("[webmcp] no document.modelContext — the WebMCP polyfill failed to install");
    return;
  }
  for (const tool of TOOLS) {
    // Results go to an MCP client, which expects content blocks; a thrown error becomes a tool error.
    mc.registerTool({
      ...tool,
      execute: async (args: ToolArgs) => {
        // The only enforcement point that works after registration, so it is the one that counts.
        if (!settings.mcpEnabled) throw new Error("MCP is switched off in the editor's options.");
        if (!mcpStatus.connected) {
          mcpStatus.connected = true;
          if (!mcpStatus.address) mcpStatus.address = "this browser";
        }
        const content = [{ type: "text", text: JSON.stringify(await tool.execute(args), null, 1) }];
        const note = nudge(tool.name);
        if (note) content.push({ type: "text", text: note });
        return { content };
      },
    });
  }
  // Console handle: $mcp("nr_read", { id }) runs a tool and gives back its plain result. Calls
  // execute directly rather than going through modelContext, so there is no JSON round-trip and
  // no content-block wrapper in the way -- the point is to read the value, not the envelope.
  globalThis.$mcp = async (name: string, args: Record<string, unknown> = {}) => {
    const tool = TOOLS.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`No tool "${name}". Have: ${TOOLS.map((t) => t.name).join(", ")}`);
    return await tool.execute(args);
  };
  console.info(`[webmcp] registered ${TOOLS.length} editor tools — try them with $mcp("nr_docs")`);

  // The local relay is WebSocket-only, so the page hosts its embed itself (public/webmcp, vendored
  // from the relay package). It must be a real <script src> — the embed resolves widget.html
  // relative to its own src — and it is injected after registration so the tools are there already.
  const embed = document.createElement("script");
  // Resolved against <base>, not the origin: a leading-slash "/webmcp/..." lands on the drive root
  // under Electron's file:// and outside the baseURL on GitHub Pages, and the embed never loads.
  embed.src = new URL("webmcp/embed.js", document.baseURI).href;
  embed.async = true;
  // The relay's own --port is configurable, so allow ?webmcpPort= rather than pinning its default.
  const params = new URLSearchParams(location.search);
  const port = params.get("webmcpPort");
  if (port) embed.setAttribute("data-relay-port", port);

  // The embed defaults to 127.0.0.1, which a content blocker sees as a different host from the page
  // it is running on — so "allow on this site" never covers the socket and the connection is blocked
  // with no visible cause. Keep both on the same host when we are already on loopback.
  const onLoopback = ["localhost", "127.0.0.1"].includes(location.hostname);
  const host = params.get("webmcpHost") ?? (onLoopback ? location.hostname : null);
  if (host) embed.setAttribute("data-relay-host", host);

  document.head.appendChild(embed);
  listenForRelay(port ?? RELAY_DEFAULT_PORT);
}

/** The relay's own default, which the embed applies when no data-relay-port is set. */
const RELAY_DEFAULT_PORT = "9333";

/**
 * Watches the relay widget's own traffic for a sign of life.
 *
 * The widget asks the page for its tool list only once the relay has accepted its handshake, so
 * that request is the earliest honest "something is connected"; `webmcp.relay.rejected` is the
 * matching failure, and carries the relay's reason. This is a second, passive listener beside the
 * embed's own -- both see the same messages, and this one never answers any of them.
 *
 * No host or IP in the message: someone reading the options panel should not have to know what
 * 127.0.0.1 is.
 */
function listenForRelay(port: string) {
  addEventListener("message", (event: MessageEvent) => {
    const type = (event.data as { type?: unknown } | null)?.type;
    if (type === "webmcp.tools.list.request" || type === "webmcp.tools.invoke.request") {
      mcpStatus.address = `localhost port ${port}`;
      mcpStatus.connected = true;
      mcpStatus.rejected = "";
    } else if (type === "webmcp.relay.rejected") {
      const why = (event.data as { message?: unknown }).message;
      mcpStatus.rejected = `The relay on localhost port ${port} refused the connection${
        typeof why === "string" && why ? `: ${why}` : ""
      }`;
    }
  });
}
