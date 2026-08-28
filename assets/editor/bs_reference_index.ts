/**
 * Reverse index of "which nodes point at this id".
 *
 * References used to be stored as `refs`/`other_refs` arrays on the target and maintained by
 * hand from fourteen call sites, each needing a matching remove on every path that could undo
 * it. Miss one and the arrays drift, silently, and anything reading them lies.
 *
 * Here nothing is stored on the target. Each node's *outgoing* edges are recorded once, and
 * the referrer list is the inverse. A node's edges can only be replaced wholesale, so there
 * is no add/remove pair to get wrong, and reindexing reports which targets were affected --
 * including the one a link just stopped pointing at, which the old scheme could not recover
 * because the previous target was already unreachable by then.
 *
 * Keyed by id string rather than by resolved node, so indexing never has to resolve anything
 * and an edge to a not-yet-loaded catalogue is recorded like any other.
 *
 * No imports, so it can be compiled and exercised on its own; see bs_reference_index_check.ts.
 */

export type RefKind = "link" | "other";

/**
 * Reactive Maps and arrays normalised identity with toRaw, so a node recorded through one proxy
 * was found through any other. These are plain now -- deliberately, see the class comment -- so
 * the normalisation has to happen here.
 *
 * It is not optional: the load path reaches nodes through the reactive catalogue tree while
 * `set_field` and undo pass raw ones, so the same node genuinely arrives under both identities.
 * Without this, `detach` fails to find what it recorded and `attach` then pushes a second copy,
 * and the node ends up listed twice in its target's refs.
 *
 * Nodes are stored as the caller passed them rather than raw, because callers mutate what they
 * read back out of here -- removeFromIndex deletes `target` off every referrer -- and a raw node
 * mutated is a node Vue never hears about.
 *
 * Written inline rather than imported to keep this module dependency-free.
 */
function raw<T>(node: T): T {
  return (node as { __v_raw?: T } | null)?.__v_raw ?? node;
}

export interface ReferenceEdge {
  /** Target node id. Not resolved -- it may not exist, and that is fine. */
  id: string;
  kind: RefKind;
}

/** Shared frozen result for ids nobody references, so reads in render paths allocate nothing. */
const EMPTY = Object.freeze([]) as unknown as any[];
/** Shared frozen "nothing changed" result, for the same reason. */
const NO_CHANGE = Object.freeze([]) as unknown as string[];

export class ReferenceIndex<TNode = any> {
  /** id -> nodes pointing at it via a link-ish field (targetId, a profile's typeId). */
  private links = new Map<string, TNode[]>();
  /** id -> nodes mentioning it some other way (condition childId/scope, modifier value). */
  private others = new Map<string, TNode[]>();
  /** What we last recorded for a node, so replacing its edges is exact. */
  private edges = new Map<TNode, ReferenceEdge[]>();

  /**
   * Bumped on every mutation. The index is markRaw'd -- 1.5M reads per system load, each one
   * a proxy trap otherwise -- so Vue cannot see it change; the editor hooks this to a
   * reactive token instead. Unset outside the editor, so it costs one undefined check.
   */
  onChange?: () => void;

  private bucket(kind: RefKind): Map<string, TNode[]> {
    return kind === "link" ? this.links : this.others;
  }

  /**
   * Nodes referring to `id`. The returned array is live and shared -- callers read it, and
   * must not mutate it. Reads happen in render paths, so this allocates nothing.
   */
  referrers(id: string | undefined, kind: RefKind): TNode[] {
    if (!id) return EMPTY;
    return this.bucket(kind).get(id) ?? EMPTY;
  }

  count(id: string | undefined): number {
    if (!id) return 0;
    return (this.links.get(id)?.length ?? 0) + (this.others.get(id)?.length ?? 0);
  }

  /**
   * No membership check: set() only calls this for an edge the node did not already have, and
   * `edges` is the authoritative record of that, so the node cannot already be in this bucket.
   * The scan it replaces was quadratic per bucket and -- once identity had to be normalised --
   * a proxy trap per element, which measured at 1.5s of a system load on its own.
   */
  private attach(node: TNode, edge: ReferenceEdge): void {
    const map = this.bucket(edge.kind);
    const list = map.get(edge.id);
    if (!list) map.set(edge.id, [node]);
    else list.push(node);
  }

  private detach(node: TNode, edge: ReferenceEdge, key: TNode): void {
    const map = this.bucket(edge.kind);
    const list = map.get(edge.id);
    if (!list) return;
    // Plain identity first: the caller almost always holds the same reference that was stored,
    // and that path touches no proxies. Only when it does not do we pay to normalise.
    let at = list.indexOf(node);
    if (at < 0) at = list.findIndex((o) => raw(o) === key);
    if (at >= 0) list.splice(at, 1);
    if (!list.length) map.delete(edge.id);
  }

  /**
   * Replaces everything `node` points at.
   *
   * Returns the ids whose referrer list actually changed -- the symmetric difference of the
   * old and new edges. That set is what needs revalidating: a target that just lost its last
   * referrer, and one that just gained its first, both have a different answer now.
   */
  set(node: TNode, edges: ReferenceEdge[]): string[] {
    // Normalised once and threaded through attach/detach, so matching a node costs one property
    // read per candidate rather than two.
    const key0 = raw(node);
    const before = this.edges.get(key0) ?? [];

    // Nothing moved: bail before allocating anything. A load calls this for every node
    // twice -- once as it is indexed, once as processForEditor walks the tree -- so the
    // second call is always this case, and the three Sets plus a key string per edge below
    // were pure waste. outgoingReferences is deterministic, so equal content arrives in
    // equal order.
    if (before.length === edges.length) {
      let same = true;
      for (let i = 0; i < edges.length; i++) {
        if (before[i].id !== edges[i].id || before[i].kind !== edges[i].kind) {
          same = false;
          break;
        }
      }
      if (same) return NO_CHANGE;
    }

    const key = (e: ReferenceEdge) => `${e.kind} ${e.id}`;
    const beforeKeys = new Set(before.map(key));
    const afterKeys = new Set(edges.map(key));

    const affected = new Set<string>();
    for (const edge of before) {
      if (!afterKeys.has(key(edge))) {
        this.detach(node, edge, key0);
        affected.add(edge.id);
      }
    }
    for (const edge of edges) {
      const k = key(edge);
      if (beforeKeys.has(k)) continue;
      // Recorded as we go, so an edges array that names the same target twice attaches once.
      beforeKeys.add(k);
      this.attach(node, edge);
      affected.add(edge.id);
    }

    if (edges.length) this.edges.set(key0, edges);
    else this.edges.delete(key0);
    if (affected.size) this.onChange?.();
    return [...affected];
  }

  /**
   * Every node recorded as pointing at something. The cycle index seeds from these rather than
   * from a catalogue's id index, which would miss a link that has no id of its own.
   */
  sources(): Iterable<TNode> {
    return this.edges.keys();
  }

  /** Drops a node's outgoing edges; returns the ids that lost a referrer. */
  remove(node: TNode): string[] {
    return this.set(node, []);
  }

  /** Forgets every node the predicate matches -- used when a catalogue unloads. */
  purge(matches: (node: TNode) => boolean): string[] {
    const affected = new Set<string>();
    for (const node of [...this.edges.keys()]) {
      if (matches(node)) for (const id of this.remove(node)) affected.add(id);
    }
    return [...affected];
  }

  clear(): void {
    this.links.clear();
    this.others.clear();
    this.edges.clear();
    this.onChange?.();
  }
}
