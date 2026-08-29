/**
 * Which fields on a node point at another node.
 *
 * This is the whole definition of a reference in the editor. It replaces the hand-written
 * addRef/removeRef pairs that used to be scattered across processForEditor, updateLink,
 * updateCondition, onAddEntry, onRemoveEntry and three Vue components: instead of every
 * mutation site remembering to keep the target's array in step, each node reports what it
 * points at and bs_reference_index inverts it.
 *
 * Adding a new kind of reference is one entry here.
 */
import { Condition, Constraint, Link, Modifier, Profile, basicQueryFields } from "~/assets/shared/battlescribe/bs_main";
import { validScopes } from "~/assets/shared/battlescribe/bs_condition";
import type { ReferenceEdge } from "./bs_reference_index";

/** Fields whose value is a node id, keyed so set_field knows when to reindex. */
export const REFERENCE_FIELDS = new Set(["targetId", "typeId", "childId", "scope", "value"]);

/**
 * `field` is deliberately NOT here, and a modifier's field is deliberately not an edge below.
 *
 * A modifier names its constraint by id, so indexing it looks like the obvious missing
 * reference -- 10k of the 14k modifiers on Warhammer: The Old World point at one. But a
 * constraint id is only unique within the entry that owns it, and duplicating an entry
 * duplicates its constraint ids, so one id keyed globally collects every modifier in the
 * system that names it -- nearly all of them acting on somebody else's constraint.
 *
 * That would not be a slightly noisy index, it would be a wrong one: `mentions:0` is how
 * "nothing uses this" is asked, and the references panel would show modifiers that cannot
 * reach the constraint they are listed under. A modifier only ever affects constraints on
 * its own node or on a node linking to it, which is a local question -- see modifiersFor()
 * in plugins/webmcp.client.ts, which answers it by walking those two places instead.
 */

/** Shared, for the many nodes that point at nothing. Never stored and never mutated. */
const NONE = Object.freeze([]) as unknown as ReferenceEdge[];

/**
 * Everything `node` points at.
 *
 * Ids are not resolved: an edge to a catalogue that isn't loaded yet is recorded like any
 * other, and starts reporting the moment that catalogue arrives. That is also why a stale
 * id still produces an edge -- the "child id does not exist" diagnostic is what reports it,
 * not the index.
 */
export function outgoingReferences(node: any): ReferenceEdge[] {
  // Runs on every node of every catalogue, and most nodes carry no reference at all.
  // Cheaper to rule those out than to allocate an array that stays empty.
  if (!node.targetId && !(node instanceof Condition) && !(node instanceof Modifier) && !(node instanceof Profile)) {
    return NONE;
  }
  const edges: ReferenceEdge[] = [];

  // Links, including catalogueLinks: reload() finds the catalogues pointing at it this way.
  if (typeof node.targetId === "string" && node.targetId) {
    edges.push({ id: node.targetId, kind: "link" });
  }

  // A profile points at its profile type. Characteristics and costs also carry a typeId, but
  // those were never tracked and counting them would change what the references panel shows.
  if (node instanceof Profile && !(node instanceof Link) && typeof node.typeId === "string" && node.typeId) {
    edges.push({ id: node.typeId, kind: "link" });
  }

  if (node instanceof Condition) {
    // Builtin scopes ("parent", "force", "roster", ...) and query fields are keywords, not ids.
    if (typeof node.scope === "string" && node.scope && !validScopes.has(node.scope)) {
      edges.push({ id: node.scope, kind: "other" });
    }
    if (!(node instanceof Constraint) && typeof node.childId === "string" && node.childId && !basicQueryFields.has(node.childId)) {
      edges.push({ id: node.childId, kind: "other" });
    }
  }

  // A modifier's value is an id when it sets something that names another node. Non-id values
  // simply key nothing, so there is no need to resolve first.
  if (node instanceof Modifier && typeof node.value === "string" && node.value) {
    edges.push({ id: node.value, kind: "other" });
  }

  return edges;
}
