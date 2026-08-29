/**
 * "Pointless recursivity": a query asks to walk the whole subtree when everything it could
 * ever match is already a direct child.
 *
 * Recursive queries are not free -- each one listens on every scope it reaches -- and a
 * recursive flag that changes nothing is usually a copy-paste from a query where it mattered.
 *
 * The whole rule is one question: **is there anything more than one entry level below the
 * anchor that the query would match?** If not, the recursion cannot be adding anything.
 *
 * Two things about how the roster counts levels, both taken from nuxt-nr rather than guessed:
 *
 * - **Groups do not cost a level.** A state's parent entry is found by walking past groups
 *   (`getParentEntry`), and `getSelections` splices a group's contents into its parent's, so
 *   an entry inside a group is a *direct* child of the entry above the group. A group does
 *   contribute its id as a filter to what it holds, so a group is tested at the depth its
 *   contents sit at rather than skipped.
 * - **One level is always walked, recursive or not.** Both traversals (`selectEntries` for
 *   modifiers, `getSelectedEntries` for associations) run their first pass unconditionally, so
 *   only depth 2 and beyond is what the flag actually buys.
 *
 * Everything here answers from the anchor's own subtree, which is deliberate: a rule whose
 * verdict depended on some *other* node gaining a link would be stale until a reload, since
 * processForEditor stopped revalidating in that direction (see its comment). That is also why
 * scopes other than `self` are declined rather than guessed -- they resolve to an ancestor
 * chosen at roster time, and the catalogue does not know which one.
 */
import { Base, getStaticFilters, basicQueryFields, deconstruct_affects_query } from "~/assets/shared/battlescribe/bs_main";
import type { Association, AssociationLink, Link, LocalConditionGroup, Modifier } from "~/assets/shared/battlescribe/bs_main";
import { findSelfOrParentWhere } from "~/assets/shared/battlescribe/bs_helpers";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

/** Entry levels every query walks anyway. Past this is what a recursive flag pays for. */
const DIRECT = 1;

/**
 * The children a query descends into: a link stands in for its target, and both halves count
 * -- an entryLink may add children of its own on top of the ones its target already has.
 */
function* queryChildren(node: Base): Iterable<Base> {
  if (node.isLink()) {
    const target = (node as Link).target;
    if (target) yield* target.selectionsIterator();
  }
  yield* node.selectionsIterator();
}

/**
 * Whether `filter` matches a node, statically.
 *
 * `getStaticFilters` is the same list the roster indexes as `is::<id>`, so this agrees with
 * `isInstanceof`/`hasFilter` by construction.
 *
 * Categories are the one thing missing, and on purpose: a modifier can add one at roster time.
 * A filter that names a category is declined by the caller instead.
 */
function matchesFilter(node: Base, filter: string): boolean {
  if (!filter || filter === "any") return true;
  return getStaticFilters(node).includes(filter);
}

/**
 * Whether anything matching `filter` sits more than one entry level below `anchor`.
 *
 * `undefined` is "cannot tell": an unresolved link hides a subtree, and a subtree nobody can
 * read could hold anything.
 *
 * Depth is capped one past DIRECT, which is what makes this terminate on a link cycle -- once
 * a node has been expanded at the deepest depth that means anything, seeing it again cannot
 * change the answer.
 */
export function matchesBelowDirect(anchor: Base, filter: string): boolean | undefined {
  const MAX = DIRECT + 1;
  const seen = new Map<Base, number>();
  const stack: Array<[node: Base, depth: number]> = [[anchor, 0]];

  while (stack.length) {
    const [node, depth] = stack.pop()!;
    const expanded = seen.get(node);
    if (expanded !== undefined && expanded >= depth) continue;
    seen.set(node, depth);

    if (node.isLink() && !(node as Link).target) return undefined;

    // Groups are tested too, rather than skipped. A group's id is a filter of what it holds
    // (`getFilters` walks the contiguous groups above a node), and the group sits at exactly
    // the depth its contents do -- so asking the group is asking about its entries, without
    // having to carry a set of inherited ids down every branch.
    if (depth > DIRECT && matchesFilter(node, filter)) return true;

    // A group hands its children its own depth; an entry costs a level.
    const below = node.isGroup() ? depth : Math.min(depth + 1, MAX);
    for (const child of queryChildren(node)) stack.push([child, below]);
  }
  return false;
}

/**
 * The entry a `self`-scoped query anchors on: the nearest thing above `node` the roster builds
 * a state for. Profiles, rules, constraints and modifier groups have no state of their own, so
 * a modifier inside one anchors on whatever entry holds it.
 *
 * A force is declined even though `Force.isEntry()` is true -- forces have their own traversal
 * rules, and the levels below one are reached through categories rather than selections.
 */
export function selfAnchor(node: EditorBase, scope?: string): EditorBase | undefined {
  if (scope && scope !== "self" && scope !== "this") return undefined;
  if (!node.parent) return undefined;
  const owner = findSelfOrParentWhere(
    node.parent,
    (o) => o.isEntry() || o.isGroup() || o.isCategory() || o.isCatalogue() || o.isForce(),
  );
  return owner?.isEntry() && !owner.isForce() ? owner : undefined;
}

/**
 * How to say "what is missing", or `undefined` when this filter is not one to reason about.
 *
 * A category is declined because modifiers hand them out at roster time. An id that resolves
 * nowhere is declined too: nothing matches it, so every recursive query using one would be
 * reported, when the actual problem is the dangling id that other rules already name.
 */
function missingLabel(anchor: EditorBase, filter: string): string | undefined {
  if (!filter || filter === "any") return "nothing";
  if (filter.includes(".")) return undefined;
  if (basicQueryFields.has(filter) || filter === "model-or-unit") return `no ${filter}`;
  const found = anchor.catalogue?.findOptionById(filter);
  if (!found || found.isCategory()) return undefined;
  return `no ${found.getName()}`;
}

/** The shared verdict: nothing the query matches is deep enough for the recursion to reach. */
function shallowReason(anchor: EditorBase, filter: string): string | undefined {
  const label = missingLabel(anchor, filter);
  if (label === undefined) return undefined;
  if (matchesBelowDirect(anchor, filter) !== false) return undefined;
  return `${label} more than one level below ${anchor.getName()}`;
}

/**
 * A modifier whose `affects` asks for recursion it never uses.
 *
 * `forces`, `associations` and `group` queries are declined: recursion governs those walks
 * too, and all three leave the anchor's subtree for a shape only a roster has. So is a
 * recursive query with no `entries` -- it selects nothing either way, which is a different
 * complaint than this one.
 */
export function pointlessAffects(modifier: EditorBase & Modifier): string | undefined {
  const query = deconstruct_affects_query(modifier.affects);
  if (!query.recursive || !query.entries) return;
  if (query.forces || query.associations || query.group) return;
  const anchor = selfAnchor(modifier, modifier.scope);
  if (!anchor) return;
  const reason = shallowReason(anchor, query.filterBy || "any");
  return reason && `recursive changes nothing here: ${reason}`;
}

/**
 * A local condition group counting a subtree that is not there.
 *
 * `eval_local_condition_group` runs `getEnabledEntries(includeChildSelections, ...)` -- the same
 * one-level-always shape as the other two -- and then filters what it collected through the
 * group's own nested conditions. Those conditions are an and/or tree of scopes and childIds,
 * not one filter, so which entries the group matches is not a question this can answer.
 *
 * That leaves the one verdict that holds whatever they test for: there is nothing below the
 * direct children at all, so the flag has nothing to collect. Narrower than the association
 * check by a lot, and still the common authoring slip -- the flag set on a leaf-shaped entry.
 *
 * `includeChildForces` is deliberately not judged here. Unlike `getSelectedEntries`, this
 * traversal keeps forces in its result (`Force.isEntry()` is true), so the "does nothing
 * without child selections" argument that holds for associations does not hold here.
 */
export function pointlessLocalGroup(group: EditorBase & LocalConditionGroup): string | undefined {
  if (!group.includeChildSelections) return;
  const anchor = selfAnchor(group, group.scope);
  if (!anchor) return;
  const reason = shallowReason(anchor, "any");
  return reason && `includeChildSelections changes nothing here: ${reason}`;
}

/**
 * An association that walks child selections, or child forces, for nothing.
 *
 * `getSelectedEntries` only ever collects *selections*, and the level it always walks covers
 * the direct child forces already. With `includeChildSelections` off it collects nothing past
 * that first level, so `includeChildForces` has nothing left to reach whatever the scope --
 * which is the one verdict here that needs no anchor at all.
 *
 * A link reads its shared association's query (`getTarget`, as getCandidates does), so the
 * flags are reported on the node that owns them and the walk on the link that gives it a place
 * in the tree.
 */
export function pointlessAssociation(association: EditorBase & (Association | AssociationLink)): string | undefined {
  const query = association.getTarget() as Association | undefined;
  if (!query) return;
  if (!query.includeChildSelections) {
    if (query.includeChildForces && (query as Base) === (association as Base)) {
      return "includeChildForces does nothing while includeChildSelections is off";
    }
    return;
  }
  const anchor = selfAnchor(association, query.scope);
  if (!anchor) return;
  const reason = shallowReason(anchor, association.getChildId() || "any");
  return reason && `includeChildSelections changes nothing here: ${reason}`;
}
