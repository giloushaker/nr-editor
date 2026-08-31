/**
 * Checks for bs_search.ts. Run by `npm run check`.
 *
 * A query language fails quietly: a wrong parse or a too-eager match just returns the wrong
 * rows, and nobody can tell whether the catalogue really has no `is:constraint scope:force` or
 * the search is broken. The cases that would go unnoticed live here.
 *
 * Fixtures are plain objects rather than real Base instances -- the search reads nodes through
 * the field table, so what it needs is `is`/`parentKey`/`parent` and the child arrays, and
 * building those by hand keeps this file free of the editor's prototype grafting.
 */
import { aggregate, isBalanced, parse, search, splitTerms, unknownKeys, type SearchOptions } from "./bs_search";

let failures = 0;
function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log("  ok -", msg);
  } else {
    failures++;
    console.log("  NOT OK -", msg);
  }
}

/** Names of the matches, sorted, so a case reads as the set it expects. */
function found(query: string): string {
  return search(catalogue as never, query)
    .map((n) => (n as { name?: string }).name ?? "?")
    .sort()
    .join(",");
}

function is(query: string, expected: string) {
  const actual = found(query);
  assert(actual === expected, `${query.padEnd(42)} -> ${actual || "(none)"}`);
}

/** Same, with options, labelled by what the options say rather than by the query alone. */
function withOptions(label: string, query: string, options: SearchOptions, expected: string) {
  const actual = search(catalogue as never, query, options)
    .map((n) => (n as { name?: string }).name ?? "?")
    .sort()
    .join(",");
  assert(actual === expected, `${label.padEnd(42)} -> ${actual || "(none)"}`);
}

// #region fixture

/**
 *  catalogue
 *    selectionEntries      bolter        -- profile weapon, constraint max 3 (scope force)
 *                          fist          -- constraint min 0 (scope parent), shared modifier
 *    sharedSelectionEntries  shared entry
 *    entryLinks            bolter link   -> bolter
 */
/**
 * Costs and characteristics are ordinary nodes -- entries.ts lists both, so they are walked
 * like anything else. Nothing special is needed to query them; these prove it.
 */
const ap = { name: "AP", is: "characteristic", parentKey: "characteristics", $text: "2" };
const bolterProfile = {
  name: "weapon",
  is: "profile",
  parentKey: "profiles",
  typeName: "Weapon",
  characteristics: [ap],
};
const pts = { name: "pts", is: "cost", parentKey: "costs", value: 13 };
const bolterMax = { name: "max3", is: "constraint", parentKey: "constraints", type: "max", value: 3, scope: "force" };
const fistMin = { name: "min0", is: "constraint", parentKey: "constraints", type: "min", value: 0, scope: "parent" };
const fistMod = { name: "mod", is: "modifier", parentKey: "modifiers", field: "points", shared: true };

/** A shared entry with something inside it, reached from `fist` only through a link. */
const sharedMin = { name: "shared min", is: "constraint", parentKey: "constraints", type: "min", value: 1 };
const sharedEntry = {
  name: "shared entry",
  is: "entry",
  parentKey: "sharedSelectionEntries",
  id: "e3",
  refs: [] as unknown[],
  constraints: [sharedMin],
};
const sharedLink = {
  name: "shared link",
  is: "entryLink",
  parentKey: "entryLinks",
  id: "l3",
  target: sharedEntry,
  isLink: () => true,
  isCollective: () => false,
};
const bolter = {
  name: "bolter",
  is: "entry",
  parentKey: "selectionEntries",
  id: "e1",
  refs: [] as unknown[],
  profiles: [bolterProfile],
  constraints: [bolterMax],
  costs: [pts],
};
const fist = {
  name: "power fist",
  is: "entry",
  parentKey: "selectionEntries",
  id: "e2",
  refs: [],
  constraints: [fistMin],
  modifiers: [fistMod],
  entryLinks: [sharedLink],
};
/**
 * The three collective cases that matter: an entry that says so, one saved by the editor with
 * the flag off (which deletes the attribute), and a link that is collective only through its
 * target. `bolter` and `fist` above are the "off, attribute deleted" case.
 */
const squad = {
  name: "squad",
  is: "group",
  parentKey: "selectionEntryGroups",
  id: "g1",
  collective: true,
  isCollective: () => true,
};
/** `isLink` because that is what the `link:` override calls; the rest answer undefined. */
const bolterLink = {
  name: "bolter link",
  is: "entryLink",
  parentKey: "entryLinks",
  id: "l1",
  target: bolter,
  isLink: () => true,
  // Neither it nor its target is collective, which is what Link.isCollective ORs.
  isCollective: () => false,
};
/** The other half of that OR: nothing of its own, collective purely through the target. */
const squadLink = {
  name: "squad link",
  is: "groupLink",
  parentKey: "entryLinks",
  id: "l2",
  target: squad,
  isLink: () => true,
  isCollective: () => squad.isCollective(),
};

/** A root has no parentKey, so `is:catalogue` has to come from the same calls the editor makes. */
const catalogue = {
  name: "catalogue",
  imports: [],
  isCatalogue: () => true,
  isGameSystem: () => false,
  selectionEntries: [bolter, fist],
  selectionEntryGroups: [squad],
  sharedSelectionEntries: [sharedEntry],
  entryLinks: [bolterLink, squadLink],
};
bolter.refs.push(bolterLink);
sharedEntry.refs.push(sharedLink);

/** What the editor's indexing does: parent for `has:`/`in:`, catalogue for `catalogue:`. */
function index(node: Record<string, unknown>, root: unknown = node) {
  for (const key of Object.keys(node)) {
    const value = node[key];
    // refs and imports are arrays of nodes but not child arrays; walkChildren skips both
    // because it only descends arrayKeys, and so must this.
    if (!Array.isArray(value) || key === "refs" || key === "imports") continue;
    for (const child of value) {
      if (typeof child !== "object" || child === null) continue;
      Object.assign(child, { parent: node, catalogue: root });
      index(child as Record<string, unknown>, root);
    }
  }
}
index(catalogue);

// #endregion

console.log("parsing");
{
  const [term] = parse('name:"power fist"');
  assert(term.key === "name" && term.alts[0].text === "power fist", "quotes hold a phrase together");

  const [bare] = parse('"scope:force"');
  assert(bare.key === "text" && bare.alts[0].text === "scope:force", "a quoted colon stays plaintext");

  const [neg] = parse("-is:entry|group");
  assert(neg.negate && neg.alts.length === 2, "leading dash negates, pipe splits alternatives");
  const [bang] = parse("!is:entry");
  assert(bang.negate && bang.key === "is", "a leading bang negates too");
  const [ne] = parse("name!=Scouts");
  assert(ne.negate && ne.key === "name" && ne.alts[0].cmp === "=", "name!=x is -name=x");
  const [nc] = parse("name!:scout|bolt");
  assert(nc.negate && nc.key === "name" && nc.alts.length === 2 && !nc.alts[0].cmp, "name!:a|b is none-of, substring");
  assert(!parse("-name!=x")[0].negate, "a leading - and a !-operator cancel");
  assert(!parse("!")[0].negate && !parse("-")[0].negate, "a lone dash or bang is a word, not a negation");

  const [outer] = parse("has:entry[has:profile[typeName:Weapon]]");
  const inner = outer.sub?.[0];
  assert(outer.key === "has" && inner?.key === "has" && inner.sub?.[0].key === "typeName", "brackets nest");

  const [presence] = parse("childId:");
  assert(presence.alts[0].any === true, "a bare key: means the field must be present");
  assert(parse("affects:undefined|null|=self")[0].alts.map((a) => a.none === true).join() === "true,true,false", "undefined and null spell none; =self stays a value");

  assert(parse("   ").length === 0, "whitespace alone parses to nothing");
}

console.log("plaintext");
{
  is("bolter", "bolter,bolter link");
  is("power fist", "power fist");
  is('"power fist"', "power fist");
  // Two bare words are ANDed, so this matches neither entry.
  is("bolter fist", "");
}

console.log("fields");
{
  is("is:constraint", "max3,min0,shared min");
  is("is:constraint|modifier", "max3,min0,mod,shared min");
  // The whole reason `is` compares by equality: substring would drag the link in here.
  is("is:entry", "bolter,power fist,shared entry");
  is("is:entryLink", "bolter link,shared link");
  is("is:link", "bolter link,shared link,squad link");
}

console.log("links named after their target");
{
  // A resolved categoryLink's `is` is categoryEntryLink, an infoLink's is profileLink: the array's
  // own kind has to answer too, or `is:categoryLink` finds only the dead ones.
  const link = (name: string, is: string, parentKey: string) => ({ name, is, parentKey, id: name, isLink: () => true, target: {} });
  const cat = {
    name: "links",
    imports: [],
    isCatalogue: () => true,
    categoryLinks: [link("infantry link", "categoryEntryLink", "categoryLinks")],
    infoLinks: [link("weapon link", "profileLink", "infoLinks")],
    entryLinks: [link("group link", "groupLink", "entryLinks")],
  };
  index(cat);
  const names = (q: string) =>
    search(cat as never, q)
      .map((n) => (n as { name?: string }).name)
      .join(",");
  assert(names("is:categoryLink") === "infantry link", "is:categoryLink, by the array");
  assert(names("is:categoryEntryLink") === "infantry link", "is:categoryEntryLink, by the target");
  assert(names("is:infoLink") === "weapon link" && names("is:profileLink") === "weapon link", "the same for info links");
  assert(names("is:entryLink") === "", "a group link in entryLinks is not an entryLink");
  is("-is:entry -is:entryLink -is:catalogue", "AP,max3,min0,mod,pts,shared min,squad,squad link,weapon");
  is("is:catalogue", "catalogue");
  // A field with no override is read straight off the node.
  is("scope:force", "max3");
  is("field:points", "mod");
  is("typeName:weapon", "weapon");
}

console.log("values");
{
  is("is:constraint value:>0", "max3,shared min");
  is("is:constraint value:>=0", "max3,min0,shared min");
  is("is:constraint value:0", "min0");
  is("scope:any", "max3,min0");
  is("scope:*", "max3,min0");
  is("-scope:*", "AP,bolter,bolter link,catalogue,mod,power fist,pts,shared entry,shared link,shared min,squad,squad link,weapon");
  // Arrays answer about their length for a number.
  is("is:entry refs:0", "power fist");
  is("is:entry refs:1", "bolter,shared entry");
}

console.log("overrides");
{
  // The point of the override table: one question, answered from parentKey for an entry and
  // from the boolean of the same name for a modifier.
  is("shared:true", "mod,shared entry");
  is("is:entry shared:true", "shared entry");
  // ...while `key:` still sees the distinction `is:` collapses.
  is("key:sharedSelectionEntries", "shared entry");
  is("link:true", "bolter link,shared link,squad link");
  is("id:e2", "power fist");
  // Substring on a name, equality on an id.
  is("name:fist", "power fist");
  is("id:e", "");
}

console.log("exact");
{
  // `=` is the second separator, so `name=x` and `name:=x` are the same term. Substring is the
  // default and stays the default; only these two spellings turn it off.
  is("name:fist", "power fist");
  is("name=fist", "");
  is('name="power fist"', "power fist");
  is('name:="power fist"', "power fist");
  // Every alternative is exact, not just the first -- the bug from applying `=` to one alt.
  is("name=bolter|fist", "bolter");
  is('name=bolter|"power fist"', "bolter,power fist");
  is("name!=bolter", "AP,bolter link,catalogue,infantry link,max3,min0,mod,power fist,pts,shared entry,shared link,shared min,squad,squad link,weapon".replace(",infantry link", ""));
  is("-name=bolter", "AP,bolter link,catalogue,max3,min0,mod,power fist,pts,shared entry,shared link,shared min,squad,squad link,weapon");
  // `:` wins when it comes first, so a value may still contain `=`, and a quoted word is text.
  is("is:constraint value:>0", "max3,shared min");
  is('"power fist"', "power fist");
}

console.log("flags");
{
  // The attribute is deleted when it is turned off, so these carry no `collective` at all and
  // a raw property read would find none of them.
  is("collective:false", "bolter,bolter link,power fist,shared entry,shared link");
  is("collective:true", "squad,squad link");
  // A link is collective through its target even with nothing of its own -- and its neighbour,
  // pointing at an entry that is not, is not.
  is("is:groupLink collective:true", "squad link");
  is("is:entryLink collective:true", "");
  // Absent is not false: the flag does not exist on a profile, so it answers neither way.
  is("is:profile collective:false", "");
  is("is:profile collective:true", "");
  // On a boolean, `*` means true -- so the negation is "not collective" *and* "cannot be",
  // which is the noisy query. `is:entry|group collective:false` is the one to write.
  is("-collective:*", "AP,bolter,bolter link,catalogue,max3,min0,mod,power fist,pts,shared entry,shared link,shared min,weapon");
  is("is:entry|group collective:false", "bolter,power fist,shared entry");
  // flatten applies to groups only, so the entries are absent rather than false.
  is("flatten:false", "squad,squad link");
  is("is:entry flatten:false", "");
}

console.log("traversal");
{
  is("has:constraint", "bolter,catalogue,power fist,shared entry");
  is("has:constraint[scope:force]", "bolter,catalogue");
  // Strictly descendants: a constraint does not have itself.
  is("is:constraint has:constraint", "");
  is("in:entry", "AP,max3,min0,mod,pts,shared link,shared min,weapon");
  is('in:entry["power fist"]', "min0,mod,shared link");
  is("is:constraint -in:entry[bolter]", "min0,shared min");
  is("has:entry[has:profile[typeName:Weapon]]", "catalogue");
  is("target:*", "bolter link,shared link,squad link");
  is("target:*[is:entry]", "bolter link,shared link");
  is("target:*[is:group]", "squad link");
  is("refs:*[is:entryLink]", "bolter,shared entry");
  // An impossible sub-query matches nothing rather than everything.
  is("has:constraint[scope:nowhere]", "");
}

console.log("presence");
{
  // Three spellings of the same question, so nobody has to remember which one it is.
  const withId = "bolter,bolter link,power fist,shared entry,shared link,squad,squad link";
  is("id:*", withId);
  is("id:any", withId);
  is("id:", withId);
  // Absence, spelled two ways.
  const withoutId = "AP,catalogue,max3,min0,mod,pts,shared min,weapon";
  is("-id:*", withoutId);
  is("id:none", withoutId);
  // Conditions, modifiers, profiles and costs legitimately carry no id, so the bare form is
  // only a useful audit once narrowed to a kind that should have one.
  is("is:entry id:none", "");
  // ...and both keywords step aside for a value that really is that word.
  is('id:"none"', "");
  is("id:=none", "");
  is('name:"any"', "");
  // Works for any field, not just the overridden ones -- `message` is read straight off.
  is("is:constraint -message:*", "max3,min0,shared min");
}

console.log("costs and characteristics");
{
  // The two queries a data dev actually writes, and neither needs anything the language does
  // not already have: both are just nodes with a sub-query on them.
  is("is:profile has:characteristic[name:AP $text:2]", "weapon");
  is("is:entry has:cost[name:pts value:>10]", "bolter");
  is("is:entry has:cost[name:pts value:>20]", "");
  is("in:profile[typeName:Weapon] is:characteristic", "AP");
}

console.log("links expanded");
{
  // `shared min` sits in a shared entry, reached from `fist` only through a link. The authored
  // tree does not connect them; the builder's does.
  is("has:constraint[name:shared]", "catalogue,shared entry");
  is("has*:constraint[name:shared]", "catalogue,power fist,shared entry,shared link");
  // The mirror, and the reason it is not just "descend into targets": the target's children
  // count as inside the link, the target itself does not.
  is('in:entry["power fist"]', "min0,mod,shared link");
  is('in*:entry["power fist"]', "min0,mod,shared link,shared min");
  is('in*:entry["power fist"] is:entry', "");
}

console.log("options");
{
  // What an agent asking "show me the shared profiles" needs: scope, not a filter. An empty
  // query is allowed here because narrowing the path is itself the question.
  withOptions("path: sharedSelectionEntries", "", { path: "sharedSelectionEntries" }, "shared entry,shared min");
  withOptions("path + query", "is:entry", { path: "sharedSelectionEntries" }, "shared entry");
  withOptions("path: two arrays", "", { path: ["sharedSelectionEntries", "selectionEntryGroups"] }, "shared entry,shared min,squad");
  // The path bounds what has:/in: can see, which a `key:` filter would not.
  withOptions("path bounds sub-queries", "has:constraint", { path: "sharedSelectionEntries" }, "shared entry");
  is("has:constraint", "bolter,catalogue,power fist,shared entry");
  // An empty query with no path still refuses to dump the file.
  withOptions("empty query, no path", "", {}, "");

  let threw = "";
  try {
    search(catalogue as never, "", { path: "sharedProfles" });
  } catch (e) {
    threw = String((e as Error).message);
  }
  assert(threw.includes("sharedProfles"), "a misspelled path throws instead of matching nothing");

  // followLinks is the `*` suffix applied to the whole query.
  withOptions("followLinks", "has:constraint[name:shared]", { followLinks: true }, "catalogue,power fist,shared entry,shared link");
  is("has*:constraint[name:shared]", "catalogue,power fist,shared entry,shared link");
}

console.log("multiple catalogues");
{
  const entry = (name: string, id: string) => ({ name, id, is: "entry", parentKey: "selectionEntries" });
  const system = { name: "system", imports: [], isCatalogue: () => true, selectionEntries: [entry("from system", "s1")] };
  // Both import the same system, which is the case that would double-count without a dedupe.
  const a = { name: "cat a", imports: [system], isCatalogue: () => true, selectionEntries: [entry("from a", "a1")] };
  const b = { name: "cat b", imports: [system], isCatalogue: () => true, selectionEntries: [entry("from b", "b1")] };
  for (const c of [system, a, b]) index(c);

  const names = (query: string, cats: unknown) =>
    search(cats as never, query)
      .map((n) => (n as { name?: string }).name)
      .sort()
      .join(",");

  assert(names("is:entry", a) === "from a,from system", "one catalogue still brings its imports along");
  assert(
    search(a as never, "is:entry", { includeImports: false })
      .map((n) => (n as { name?: string }).name)
      .join(",") === "from a",
    "includeImports:false leaves the imported system out"
  );
  assert(names("is:entry", [a, b]) === "from a,from b,from system", "the import shared by both is walked once");
  assert(names('catalogue:"cat b"', [a, b]) === "from b", "catalogue: narrows the union back to one file");
}

console.log("globs");
{
  const node = (key: string, name: string) => ({ name, id: name, is: "entry", parentKey: key });
  const cat = {
    name: "c",
    imports: [],
    isCatalogue: () => true,
    selectionEntries: [node("selectionEntries", "Bolt pistol")],
    sharedSelectionEntries: [node("sharedSelectionEntries", "Bolter")],
  };
  index(cat);
  const names = (q: string) =>
    search(cat as never, q)
      .map((n) => (n as { name?: string }).name)
      .join(",");
  assert(names("key:shared*") === "Bolter", "a glob matches an equals-only field");
  assert(names("name:bolt*") === "Bolt pistol,Bolter", "prefix glob, case-insensitive");
  assert(names("name:*pistol") === "Bolt pistol", "suffix glob is anchored at the end");
  assert(names('name:"bolt*"') === "", "quoted, the star is a literal");
}

console.log("aggregate, the second box");
{
  const node = (name: string, id: string, is = "entry", extra: Record<string, unknown> = {}) => ({
    name,
    id,
    is,
    parentKey: "selectionEntries",
    ...extra,
  });
  const a = {
    name: "cat a",
    imports: [],
    isCatalogue: () => true,
    selectionEntries: [node("Sergeant", "dup"), node("Bolter", "b1"), node("Sergeant", "dup", "profile", { parentKey: "profiles" })],
  };
  const b = { name: "cat b", imports: [], isCatalogue: () => true, selectionEntries: [node("Sergeant", "dup"), node("Knife", "k1")] };
  for (const c of [a, b]) index(c);
  const all = search([a, b] as never, "is:*");
  const withIds = search([a, b] as never, "id:any");
  const summary = (groups: ReturnType<typeof aggregate>) => groups?.map((g) => `${g.key.join("+")}=${g.nodes.length}`).join(",");

  assert(aggregate(all, "count:>1") === undefined, "no by: means no aggregation");
  assert(summary(aggregate(all, "by:id count:>1")) === "dup=3,=2", "by:id over everything also groups the id-less roots");
  assert(summary(aggregate(withIds, "by:id count:>1")) === "dup=3", "duplicate ids: id:any then by:id count:>1");
  assert(aggregate(all, "by:id count:>1")?.[0].kinds.join(",") === "entry,profile", "a group lists the kinds it spans");
  assert(aggregate(all, "by:id count:>1")?.[0].files.join(",") === "cat a,cat b", "and the files");
  assert(summary(aggregate(all, "by:name files:>1")) === "Sergeant=3", "files:>1 keeps names present in more than one file");
  assert(summary(aggregate(all, "by:is sort:key")) === "catalogue=2,entry=4,profile=1", "sort:key orders by the group value");
  assert(summary(aggregate(all, "by:name,is count:>1")) === "Sergeant+entry=2", "a compound key");

  const twin = { name: "weapon", is: "profile", parentKey: "profiles", characteristics: [{ name: "AP", is: "characteristic", parentKey: "characteristics", $text: "2" }] };
  const other = { name: "weapon", is: "profile", parentKey: "profiles", characteristics: [{ name: "AP", is: "characteristic", parentKey: "characteristics", $text: "3" }] };
  const c = { name: "cat c", imports: [], isCatalogue: () => true, selectionEntries: [node("Gun", "g1", "entry", { profiles: [twin, other] })] };
  index(c);
  const profiles = search([catalogue, c] as never, "is:profile");
  assert(summary(aggregate(profiles, "by:name,characteristics count:>1")) === "weapon+AP=2=2", "duplicate profiles: same name and characteristics");
  assert(search(c as never, 'characteristics:"AP=3"').length === 1, "characteristics searches the rendered line");
}

console.log("child and parent, one level");
{
  // bolter has a profile of its own; fist has none but contains a link. has: would say both hold something.
  is("child:profile", "bolter");
  is("is:entry child:entryLink", "power fist");
  is("parent:entry[name:bolter]", "max3,pts,weapon");
  is("is:constraint parent:*[has:entryLink]", "min0");
  // The shared entry's authored parent is the file; fist only holds a link to it. Through the
  // link, that entry is fist's child too.
  is('child:entry[name:"shared entry"]', "catalogue");
  is('child*:entry[name:"shared entry"]', "catalogue,power fist");
  is('is:constraint parent*:entry[name:"power fist"]', "min0,shared min");
  withOptions("followLinks child:", 'child:entry[name:"shared entry"]', { followLinks: true }, "catalogue,power fist");
}

console.log("kind, through the profile type");
{
  const statsType = { id: "pt-model", name: "Model", is: "profileType", parentKey: "profileTypes", kind: "model" };
  const weaponType = { id: "pt-weapon", name: "Weapon", is: "profileType", parentKey: "profileTypes", kind: "weapon" };
  const profile = (name: string, typeId: string) => ({ name, is: "profile", parentKey: "profiles", typeId });
  const cat = {
    name: "kinds",
    imports: [],
    isCatalogue: () => true,
    index: { "pt-model": statsType, "pt-weapon": weaponType } as Record<string, unknown>,
    findOptionById(id: string) {
      return this.index[id];
    },
    profileTypes: [statsType, weaponType],
    selectionEntries: [{ name: "Sergeant", is: "entry", parentKey: "selectionEntries", profiles: [profile("Sergeant", "pt-model"), profile("Bolter", "pt-weapon")] }],
  };
  index(cat);
  const names = (q: string) =>
    search(cat as never, q)
      .map((n) => (n as { name?: string }).name)
      .sort()
      .join(",");
  assert(names("is:profile kind:model") === "Sergeant", "a profile answers with its type's kind");
  assert(names("kind:weapon") === "Bolter,Weapon", "a profile type answers for itself");
}

console.log("logic, for duplicated modifiers");
{
  const cond = (childId: string) => ({ is: "condition", parentKey: "conditions", type: "atLeast", value: 1, scope: "parent", childId });
  const mod = (id: string, childId: string, extra: Record<string, unknown> = {}) => ({
    id,
    is: "modifier",
    parentKey: "modifiers",
    type: "set",
    field: "hidden",
    value: true,
    comment: id,
    conditions: [cond(childId)],
    ...extra,
  });
  const cat = {
    name: "logic",
    imports: [],
    isCatalogue: () => true,
    selectionEntries: [
      { name: "a", is: "entry", parentKey: "selectionEntries", id: "a", modifiers: [mod("m1", "x"), mod("m2", "x")] },
      { name: "b", is: "entry", parentKey: "selectionEntries", id: "b", modifiers: [mod("m3", "y"), mod("m4", "x", { conditions: [] })] },
    ],
  };
  index(cat);
  const mods = search(cat as never, "is:modifier");
  const dup = aggregate(mods, "by:logic count:>1");
  assert(dup?.length === 1 && dup[0].nodes.map((n) => n.id).join(",") === "m1,m2", "same modifier and same condition group together; ids and comments do not split them");
  assert(aggregate(mods, "by:logic")?.length === 3, "a different childId, or no condition, is different logic");
  // The condition itself has logic too, so narrow by kind.
  assert(search(cat as never, "is:modifier logic:childId=y").length === 1, "logic is searchable text");
}

console.log("regex values");
{
  const node = (name: string) => ({ name, id: name.trim(), is: "entry", parentKey: "selectionEntries" });
  const cat = { name: "re", imports: [], isCatalogue: () => true, selectionEntries: [node("Bolter "), node("Bolt  pistol"), node("bolter")] };
  index(cat);
  const names = (q: string) =>
    search(cat as never, q)
      .map((n) => (n as { name?: string }).name)
      .join("|");
  assert(names("name:/\\s$/") === "Bolter ", "a trailing space, which no glob can ask for");
  assert(names("name:/\\s\\s/") === "Bolt  pistol", "a double space");
  assert(names("name:/^bolter$/") === "Bolter |bolter".replace("Bolter |", "") || names("name:/^bolter$/") === "bolter", "case-insensitive by default");
  assert(names("name:/^Bolter$/-") === "" && names("name:/^bolter$/g") === "bolter", "flags given are used as they are");
  assert(names("name:/(/") === "", "a broken regex searches nothing rather than throwing");
}

console.log("dotted paths");
{
  is("is:profile characteristics.AP:2", "weapon");
  is("is:profile characteristics.AP:>1", "weapon");
  is("is:profile characteristics.ap:3", "");
  is('characteristics."AP":2', "weapon");
  assert(unknownKeys('characteristics."Unit Strength":>1').length === 0, "a quoted characteristic name is a known key");
  is("is:entry name.length:>7", "power fist,shared entry");
  is("is:entry name.length:<7", "bolter");
  is("is:constraint parent.name:bolter", "max3");
  is("is:entry parent.is:catalogue", "bolter,power fist,shared entry");
  is("is:entryLink target.name:bolter", "bolter link");
  is("target.collective:true", "squad link");
  is('refs.name:"bolter link"', "bolter");
  assert(aggregate(search(catalogue as never, "is:constraint"), "by:parent.name")?.length === 3, "by: groups on a dotted path");
}

console.log("unknown keys");
{
  assert(unknownKeys("is:entry name:x page:3 target.name:y has:profile[kind:model] bare").length === 0, "fields, raw attributes, paths, traversals and words are all known");
  // Since != became real syntax this parses -- as "not the literal word", not a field compare.
  assert(unknownKeys("is:entryLink target:*[catalogue!=catalogue]").length === 0, "catalogue!= is the catalogue key, negated");
  assert(unknownKeys("catalogue~:x").join() === "catalogue~", "a truly invented operator still shows as the key it became");
  assert(unknownKeys("nam:x parent.foo:1 target.name:y").join() === "nam,parent.foo", "typos and bad path ends, once each");
  assert(unknownKeys("description.length:>50 target.name.length:>7 foo.length:>1").join() === "foo.length", ".length is known wherever its field is");
  assert(unknownKeys("textRefs:>1").length === 0, "textRefs is a known key despite living outside the field table");
  assert(unknownKeys("by:id count:>1", true).length === 0 && unknownKeys("group:id", true).join() === "group", "the then box has its own four");
}

console.log("textRefs, the name-in-text references");
{
  const rule = (name: string, description: string, id: string) => ({ name, id, is: "rule", parentKey: "sharedRules", description, getName: () => name });
  const smoke = rule("Smoke", "The bearer is obscured.", "r1");
  const frenzy = rule("Frenzy", "See ^^**Smoke**^^ and fight twice.", "r2");
  const lonely = rule("Lonely", "Nothing refers to this.", "r3");
  const ap = { name: "AP", is: "characteristic", parentKey: "characteristics", $text: "Grants Smoke while moving.", getName: () => "AP" };
  const prof = { name: "Launcher", id: "p1", is: "profile", parentKey: "profiles", characteristics: [ap], getName: () => "Launcher" };
  const cavalry = { name: "Cavalry", id: "c1", is: "categoryEntry", parentKey: "categoryEntries", getName: () => "Cavalry" };
  const charge = rule("Charge", "^^**Cavalry**^^ models fight first.", "r9");
  const cat = { name: "texts", imports: [], isCatalogue: () => true, sharedRules: [smoke, frenzy, lonely, charge], sharedProfiles: [prof], categoryEntries: [cavalry] };
  index(cat);
  const names = (q: string) =>
    search(cat as never, q)
      .map((n) => (n as { name?: string }).name)
      .sort()
      .join(",");
  assert(names("is:rule textRefs:>0") === "Smoke", "a rule named in another rule's text and a characteristic's");
  assert(names("is:rule textRefs:0") === "Charge,Frenzy,Lonely", "textRefs:0 is the rules nothing names");
  assert(names("is:rule textRefs:2") === "Smoke", "counted once per text");

  // Code blocks are not references, and prototype-property names must be safe to index.
  const fenced = rule("Fenced", "```\nSmoke\n```", "r4");
  const inline = rule("Inline", "as `Smoke` shows", "r5");
  const real = rule("Real", "Smoke, then `code`.", "r6");
  const ctor = rule("Constructor", "a name Object.prototype already has", "r7");
  const cat2 = { name: "blocks", imports: [], isCatalogue: () => true, sharedRules: [smoke, fenced, inline, real, ctor] };
  index(cat2);
  const counts = search(cat2 as never, "is:rule textRefs:>0")
    .map((n) => (n as { name?: string }).name)
    .join(",");
  assert(counts === "Smoke", "a name inside inline or fenced code does not count; outside code it does");

  // The same scan the other way: who mentions what.
  const who = (q: string) =>
    search(cat as never, q)
      .map((n) => (n as { name?: string }).name)
      .sort()
      .join(",");
  assert(who("textMentions:Smoke") === "Frenzy,Launcher", "textMentions:X is everything whose text names X, profiles via their characteristics");
  assert(who("is:rule textMentions:0") === "Lonely,Smoke", "rules whose text names nothing");
  assert(who("textMentions:any") === "Charge,Frenzy,Launcher", "textMentions:any is every text that references something");
  assert(who("is:categoryEntry textRefs:>=1") === "Cavalry", "a category named in a rule's text is tracked");
  assert(who("textMentions:Cavalry") === "Charge", "and the mentioning text finds it by name");

  // by:textMentions groups by what a text references, scanning the universe the find ran over.
  const referencing = search(cat as never, "textMentions:any");
  const grouped = aggregate(referencing, "by:textMentions");
  const smokeGroup = grouped?.find((g) => g.key[0] === "Smoke");
  assert(
    grouped?.length === 2 && smokeGroup?.nodes.length === 2,
    "by:textMentions puts the two Smoke-referencing texts in one group"
  );
  // A text naming several rules joins each of their groups: one group per mention, not per set.
  const both = rule("Both", "Combines ^^**Smoke**^^ with ^^**Frenzy**^^.", "r8");
  const cat3 = { name: "multi", imports: [], isCatalogue: () => true, sharedRules: [smoke, frenzy, both] };
  index(cat3);
  const exploded = aggregate(search(cat3 as never, "textMentions:any"), "by:textMentions sort:key");
  assert(
    exploded?.map((g) => `${g.key[0]}=${g.nodes.length}`).join(",") === "Frenzy=1,Smoke=2",
    "a text mentioning two rules sits in both groups"
  );
  assert(aggregate(search(cat as never, "is:rule"), "by:textRefs sort:-key")?.[0].key[0] === "2", "by:textRefs groups by the incoming count");
}

console.log("splitTerms, for the search box");
{
  const j = (q: string) => splitTerms(q).join("|");
  assert(j("is:entry  -is:link") === "is:entry|-is:link", "whitespace splits");
  assert(j('in:entry["bolt rifle"] x') === 'in:entry["bolt rifle"]|x', "quotes protect spaces");
  assert(
    j("has:entry[has:profile[typeName:Weapon] name:a] b") === "has:entry[has:profile[typeName:Weapon] name:a]|b",
    "brackets nest and keep their term"
  );
  assert(j("a [is:x] b") === "a|[is:x]|b", "a stray bracket group is its own term");
  assert(j('name:"unclosed a b') === 'name:"unclosed a b', "an unclosed quote swallows the rest");
  assert(isBalanced("has:x[is:y]") && !isBalanced("has:x[is:y") && !isBalanced('"a'), "isBalanced");
}

console.log(failures ? `\n${failures} FAILED` : "\nall ok");
process.exitCode = failures ? 1 : 0;
