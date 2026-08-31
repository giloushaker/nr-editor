/**
 * Checks for bs_recursion.ts. Run by `npm run check` (through vite-node, like the other checks
 * that import the real bs_main).
 *
 * The whole rule turns on how a level is counted, so that is what is pinned here: a group
 * costs nothing, an entry costs one, a link is its target, and a filter naming a group matches
 * what the group holds. Get any of those backwards and the rule reports a recursion as useless
 * while it is doing real work -- the one failure mode that matters, since nobody re-checks a
 * diagnostic that says "this does nothing".
 */
import { Base, Entry, Group, Link, Modifier, Association, AssociationLink } from "~/assets/shared/battlescribe/bs_main";
import type { LocalConditionGroup } from "~/assets/shared/battlescribe/bs_main";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { matchesBelowDirect, pointlessAffects, pointlessAssociation, pointlessLocalGroup, selfAnchor } from "./bs_recursion";

let failures = 0;
function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log("  ok -", msg);
  } else {
    failures++;
    console.log("  NOT OK -", msg);
  }
}

const index: Record<string, Base> = {};
/** Stands in for the catalogue; the rule only ever asks it to resolve a filter id. */
const catalogue = { findOptionById: (id: string) => index[id] } as unknown as EditorBase["catalogue"];

type Props = Record<string, unknown>;
function node<T extends object>(proto: { prototype: T }, id: string, props: Props): Base {
  const built = Object.setPrototypeOf({ id, name: id, catalogue, ...props }, proto.prototype) as Base;
  index[id] = built;
  return built;
}
const entry = (id: string, props: Props = {}) => node(Entry, id, props);
const group = (id: string, props: Props = {}) => node(Group, id, props);
const linkTo = (id: string, target: Base | undefined, props: Props = {}) =>
  node(Link, id, { targetId: target?.id, target, ...props });

/** Sets `parent` the way processForEditor does, so selfAnchor has a chain to walk. */
function withParents(root: Base): Base {
  for (const child of root.selectionsIterator()) {
    (child as EditorBase).parent = root as EditorBase;
    withParents(child);
  }
  return root;
}

console.log("matchesBelowDirect");
{
  const shallow = entry("shallow", { selectionEntries: [entry("leafA"), entry("leafB")] });
  assert(matchesBelowDirect(shallow, "any") === false, "two leaf children are all direct children");

  const deep = entry("deep", { selectionEntries: [entry("mid", { selectionEntries: [entry("bottom")] })] });
  assert(matchesBelowDirect(deep, "any") === true, "a grandchild is below the direct children");

  // The rule's whole premise: the roster splices a group's contents into its parent, so an
  // entry inside a group is a direct child of the entry above the group, not a grandchild.
  const grouped = entry("grouped", { selectionEntryGroups: [group("g1", { selectionEntries: [entry("inG1")] })] });
  assert(matchesBelowDirect(grouped, "any") === false, "a group costs no level");

  const groupedDeep = entry("groupedDeep", {
    selectionEntryGroups: [group("g2", { selectionEntries: [entry("inG2", { selectionEntries: [entry("underG2")] })] })],
  });
  assert(matchesBelowDirect(groupedDeep, "any") === true, "a child of a group's entry is one level down");

  // Filters: only what actually sits deep should count.
  assert(matchesBelowDirect(deep, "bottom") === true, "the deep entry's own id matches");
  assert(matchesBelowDirect(deep, "mid") === false, "a direct child's id is not deep");
  assert(matchesBelowDirect(deep, "leafA") === false, "an id that is nowhere below does not match");

  // A group hands its id down to what it holds -- the roster does the same, for the run of
  // groups directly above a node -- so a filter naming a deep group is not pointless.
  const deepGroup = entry("deepGroup", {
    selectionEntries: [entry("holder", { selectionEntryGroups: [group("g3", { selectionEntries: [entry("inG3")] })] })],
  });
  assert(matchesBelowDirect(deepGroup, "g3") === true, "a deep group's id matches what it holds");

  // Types come from getStaticFilters, the same list the roster indexes as `is::<id>`.
  const typed = entry("typed", { selectionEntries: [entry("squad", { selectionEntries: [entry("gun", { type: "upgrade" })] })] });
  assert(matchesBelowDirect(typed, "upgrade") === true, "a type filter matches a deep entry's type");
  assert(matchesBelowDirect(typed, "model") === false, "a type nothing deep has does not match");

  // A link stands in for its target, so what the target holds is what the link holds.
  const shared = entry("shared", { selectionEntries: [entry("insideShared")] });
  const viaLink = entry("viaLink", { entryLinks: [linkTo("l1", shared)] });
  assert(matchesBelowDirect(viaLink, "any") === true, "a link's target's children are one level down");
  assert(matchesBelowDirect(viaLink, "insideShared") === true, "and are matched by id");

  const dangling = entry("dangling", { entryLinks: [linkTo("l2", undefined)] });
  assert(matchesBelowDirect(dangling, "any") === undefined, "an unresolved link is 'cannot tell', not 'nothing'");

  // A cycle has to terminate; it is also genuinely infinitely deep, so the answer is yes.
  const cyclic = entry("cyclic", {});
  Object.assign(cyclic, { entryLinks: [linkTo("l3", cyclic)] });
  assert(matchesBelowDirect(cyclic, "any") === true, "a link cycle terminates and counts as deep");
}

console.log("\npointlessAffects");
{
  const shallow = withParents(entry("shallowUnit", { selectionEntries: [entry("wargear")] })) as EditorBase;
  const deep = withParents(
    entry("deepUnit", { selectionEntries: [entry("model1", { selectionEntries: [entry("gun1")] })] }),
  ) as EditorBase;

  const modifier = (parent: EditorBase, props: Props = {}) =>
    Object.setPrototypeOf({ catalogue, parent, ...props }, Modifier.prototype) as EditorBase & Modifier;

  assert(
    pointlessAffects(modifier(shallow, { affects: "entries.recursive" })) ===
      "recursive changes nothing here: nothing more than one level below shallowUnit",
    "a shallow subtree names what is missing and where"
  );
  assert(
    pointlessAffects(modifier(deep, { affects: "entries.recursive" })) === undefined,
    "a real grandchild leaves the recursion alone"
  );
  assert(
    pointlessAffects(modifier(deep, { affects: "entries.recursive.model" })) ===
      "recursive changes nothing here: no model more than one level below deepUnit",
    "a filter nothing deep matches is reported with the filter"
  );
  assert(
    pointlessAffects(modifier(shallow, { affects: "entries" })) === undefined,
    "a query that never asked to recurse is not this rule's business"
  );
  assert(
    pointlessAffects(modifier(shallow, { affects: "forces.entries.recursive" })) === undefined,
    "forces leave the subtree, so the verdict is declined"
  );
  assert(
    pointlessAffects(modifier(shallow, { affects: "entries.recursive", scope: "roster" })) === undefined,
    "a scope that resolves at roster time is declined"
  );
  // An unresolvable filter matches nothing at all; that is a dangling id, which id-not-exist owns.
  assert(
    pointlessAffects(modifier(deep, { affects: "entries.recursive.notAnId" })) === undefined,
    "an id that resolves nowhere is declined rather than piled on"
  );

  // A modifier sits under a profile or a modifier group as often as directly on the entry.
  const profile = Object.setPrototypeOf({ id: "prof", catalogue, parent: shallow }, Base.prototype) as EditorBase;
  assert(
    pointlessAffects(modifier(profile, { affects: "entries.recursive" }))?.endsWith("below shallowUnit") === true,
    "a modifier nested under a profile still anchors on the entry"
  );
}

console.log("\npointlessAssociation");
{
  const shallow = withParents(entry("shallowLord", { selectionEntries: [entry("relic")] })) as EditorBase;
  const association = (parent: EditorBase, props: Props) =>
    Object.setPrototypeOf({ catalogue, parent, scope: "self", ...props }, Association.prototype) as EditorBase &
      Association;

  assert(
    pointlessAssociation(association(shallow, { includeChildSelections: true })) ===
      "includeChildSelections changes nothing here: nothing more than one level below shallowLord",
    "a shallow scope makes includeChildSelections a no-op"
  );
  assert(
    pointlessAssociation(association(shallow, { includeChildForces: true })) ===
      "includeChildForces does nothing while includeChildSelections is off",
    "child forces are unreachable while child selections are off"
  );
  assert(
    pointlessAssociation(association(shallow, { includeChildForces: true, includeChildSelections: true }))?.startsWith(
      "includeChildSelections"
    ) === true,
    "with both on, the child-forces complaint no longer applies"
  );
  assert(
    pointlessAssociation(association(shallow, { includeChildSelections: true, scope: "roster" })) === undefined,
    "a roster scope is declined -- what it reaches is not in this catalogue"
  );

  // A link reads its shared association's query, so the flag is reported once, on the owner.
  const shared = association(shallow, { id: "sharedAsso", includeChildForces: true });
  const link = Object.setPrototypeOf(
    { id: "assoLink", catalogue, parent: shallow, targetId: "sharedAsso", target: shared },
    AssociationLink.prototype,
  ) as EditorBase & AssociationLink;
  assert(pointlessAssociation(link) === undefined, "a link does not repeat the flag its target owns");
}

console.log("\npointlessLocalGroup");
{
  const shallow = withParents(entry("shallowSquad", { selectionEntries: [entry("banner")] })) as EditorBase;
  const deep = withParents(
    entry("deepSquad", { selectionEntries: [entry("trooper", { selectionEntries: [entry("pistol")] })] }),
  ) as EditorBase;
  // Local condition groups are not in protoMap, so they arrive carrying plain Base.prototype.
  const localGroup = (parent: EditorBase, props: Props) =>
    Object.setPrototypeOf({ catalogue, parent, scope: "self", field: "selections", ...props }, Base.prototype) as
      EditorBase & LocalConditionGroup;

  assert(
    pointlessLocalGroup(localGroup(shallow, { includeChildSelections: true })) ===
      "includeChildSelections changes nothing here: nothing more than one level below shallowSquad",
    "an entry with nothing below its direct children cannot use the flag"
  );
  assert(
    pointlessLocalGroup(localGroup(deep, { includeChildSelections: true })) === undefined,
    "anything one level further down leaves it alone -- the nested conditions could match it"
  );
  assert(
    pointlessLocalGroup(localGroup(shallow, { includeChildForces: true })) === undefined,
    "child forces are not judged here: this traversal keeps forces in its result"
  );
  assert(
    pointlessLocalGroup(localGroup(shallow, { includeChildSelections: true, scope: "force" })) === undefined,
    "a scope that resolves at roster time is declined"
  );
}

console.log("\nselfAnchor");
{
  const root = withParents(
    entry("anchorRoot", { selectionEntryGroups: [group("gAnchor", { selectionEntries: [entry("anchorLeaf")] })] }),
  ) as EditorBase;
  /** A query node hangs off whatever holds it, which is what selfAnchor starts from. */
  const on = (parent: EditorBase) => ({ catalogue, parent }) as unknown as EditorBase;

  assert(selfAnchor(on(root)) === root, "a query on an entry anchors on that entry");
  assert(
    selfAnchor(on(index["gAnchor"] as EditorBase)) === undefined,
    "a group is declined: the roster's first pass behaves differently there"
  );
  assert(selfAnchor(on(index["anchorLeaf"] as EditorBase)) === (index["anchorLeaf"] as EditorBase), "an entry inside a group still anchors on itself");
  assert(selfAnchor(on(root), "parent") === undefined, "any scope but self is declined");
}

console.log(failures ? `\n${failures} FAILED` : "\nall ok");
if (failures) process.exit(1);
