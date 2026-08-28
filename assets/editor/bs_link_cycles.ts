/**
 * Which links would expand forever.
 *
 * A link puts its target's contents in its own place. So if a link's target can, directly or
 * through other links, contain that same link again, expanding it never terminates. That is
 * what the bad-link-target diagnostic reports.
 *
 * It used to be answered per link, by walking upward from the link through parents and through
 * everything that links to each node on the way. Correct, but the walks overlap enormously --
 * ~20k links over ~6.2k distinct closures on Warhammer: The Old World -- and it came to about
 * half a second of every load, for a question with the same answer every time.
 *
 * Asked once instead. Build the "could contain me" graph, with an edge from each node to its
 * parent and to each node linking to it, then take its strongly connected components: a link
 * and its target end up in the same component exactly when they can reach each other, which is
 * exactly a cycle. Seeding the walk from links keeps the graph to the part that matters (~25k
 * nodes rather than ~141k), and Tarjan is linear, so the whole thing is ~15ms.
 *
 * It is also stricter than the walk it replaces, which deduplicated visited nodes by `id`.
 * Nodes without one -- conditions, modifiers, costs -- all share `undefined`, so the first of
 * them ended the walk down that branch.
 *
 * No imports, so it can be compiled and exercised on its own; see bs_link_cycles_check.ts.
 */

/** What the index needs to know about the tree. Supplied by the caller, so this file stays free of it. */
export interface CycleSource<TNode> {
  /** Every link worth starting from. Anything not reachable upward from one cannot be in a cycle. */
  links: Iterable<TNode>;
  /** The node this one sits in, or undefined at the top of a catalogue. */
  parentOf(node: TNode): TNode | undefined;
  /** Nodes pointing at this one. */
  referrersOf(node: TNode): Iterable<TNode> | undefined;
}

/**
 * Component ids for the part of the tree links can reach.
 *
 * A node absent from the graph is in no cycle, which is why `sameComponent` answers false for
 * anything it has not seen rather than treating two unknowns as equal.
 */
export class CycleIndex<TNode = any> {
  private constructor(private readonly component: Map<TNode, number>) {}

  /** Whether both nodes sit on a common cycle. */
  sameComponent(a: TNode | undefined, b: TNode | undefined): boolean {
    if (a === undefined || b === undefined) return false;
    const ca = this.component.get(a);
    if (ca === undefined) return false;
    return ca === this.component.get(b);
  }

  /** Nodes in the graph. Exposed for the checks and for reporting. */
  get size(): number {
    return this.component.size;
  }

  static build<TNode>(source: CycleSource<TNode>): CycleIndex<TNode> {
    // Node <-> integer, so the search below can use typed arrays.
    const ids = new Map<TNode, number>();
    const nodes: TNode[] = [];
    const adjacency: number[][] = [];
    const pending: TNode[] = [];
    const idOf = (node: TNode): number => {
      let i = ids.get(node);
      if (i === undefined) {
        i = nodes.length;
        ids.set(node, i);
        nodes.push(node);
        adjacency.push([]);
        pending.push(node);
      }
      return i;
    };

    for (const link of source.links) idOf(link);

    // One upward sweep with global deduplication, in place of one walk per link.
    for (let head = 0; head < pending.length; head++) {
      const node = pending[head];
      const from = ids.get(node)!;
      const parent = source.parentOf(node);
      if (parent !== undefined) adjacency[from].push(idOf(parent));
      const referrers = source.referrersOf(node);
      if (referrers) for (const referrer of referrers) adjacency[from].push(idOf(referrer));
    }

    const count = nodes.length;
    const index = new Int32Array(count).fill(-1);
    const lowlink = new Int32Array(count);
    const onStack = new Uint8Array(count);
    const component = new Int32Array(count).fill(-1);
    const stack: number[] = [];
    // Tarjan, iterative: a catalogue is deep enough to overflow the call stack, and the whole
    // point of this file is that it runs over the entire system at once.
    const work: number[] = []; // pairs of (node, next edge to consider)
    let counter = 0;
    let components = 0;

    for (let root = 0; root < count; root++) {
      if (index[root] !== -1) continue;
      work.push(root, 0);
      while (work.length) {
        const at = work.length - 2;
        const v = work[at];
        if (work[at + 1] === 0) {
          index[v] = lowlink[v] = counter++;
          stack.push(v);
          onStack[v] = 1;
        }
        const edges = adjacency[v];
        let descended = false;
        while (work[at + 1] < edges.length) {
          const w = edges[work[at + 1]++];
          if (index[w] === -1) {
            work.push(w, 0);
            descended = true;
            break;
          } else if (onStack[w] && index[w] < lowlink[v]) {
            lowlink[v] = index[w];
          }
        }
        if (descended) continue;
        if (lowlink[v] === index[v]) {
          let w: number;
          do {
            w = stack.pop()!;
            onStack[w] = 0;
            component[w] = components;
          } while (w !== v);
          components++;
        }
        work.length = at;
        if (work.length) {
          const parent = work[work.length - 2];
          if (lowlink[v] < lowlink[parent]) lowlink[parent] = lowlink[v];
        }
      }
    }

    // Only cyclic nodes are worth keeping: a component of one, with no edge back to itself, is
    // every ordinary node in the tree, and holding 25k of those costs memory for nothing.
    const sizes = new Int32Array(components);
    for (let i = 0; i < count; i++) sizes[component[i]]++;
    const cyclic = new Map<TNode, number>();
    for (let i = 0; i < count; i++) {
      if (sizes[component[i]] > 1 || adjacency[i].includes(i)) cyclic.set(nodes[i], component[i]);
    }
    return new CycleIndex<TNode>(cyclic);
  }
}
