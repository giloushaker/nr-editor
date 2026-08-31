/**
 * Giving class prototypes to a subtree the editor just built.
 *
 * The shared loader's setPrototypeRecursive stops descending the moment it meets a node that
 * already has a prototype. On its own path that is correct and load-bearing: it runs on freshly
 * parsed JSON, where nothing is initialized and no node yet has a `catalogue` or `parent`, so
 * "already initialized" can only mean "not mine to walk". Since `catalogue` is itself a key in
 * protoMap, descending past such a node would follow that back-reference and re-walk the entire
 * catalogue from every node it met.
 *
 * The editor does not get that guarantee. It inserts into a tree that is already live, and the
 * things it inserts are built by fix_object, which merges defaults over caller data -- so a
 * subtree can arrive part initialized and part plain. The shared walk stops at the first
 * initialized node and everything plain below it stays plain: invisible until something calls a
 * method on it, and cured by reloading the system, which re-parses the lot from JSON.
 *
 * So this walk keeps going past initialized nodes, and pays for it by skipping the keys that
 * point back up or across the tree. The visited set is not an optimisation: it is what keeps a
 * back-reference this list has not heard of from turning the walk into an infinite one.
 */

/**
 * Keys whose values are not children. Following any of these leaves the subtree -- `catalogue`
 * and `parent` reach the whole document, `refs`/`other_refs` reach every node that mentions this
 * one, and `target` jumps to a link's destination.
 */
export const BACK_REFERENCES: ReadonlySet<string> = new Set([
  "parent",
  "catalogue",
  "main_catalogue",
  "manager",
  "target",
  "refs",
  "other_refs",
  "index",
  "imports",
  "importsWithEntries",
  "gameSystem",
  "costIndex",
  "categoryIndex",
  "associationIndex",
]);

export interface InitializeHooks {
  /** True when the node already carries its class prototype. */
  initialized: (node: object) => boolean;
  /** Give the node the prototype registered for `key`. */
  initialize: (node: object, key: string) => void;
}

interface Pending {
  node: Record<string, unknown>;
  key: string;
}

function isPlainish(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Walks `root` and initializes every node that still needs it, descending through nodes that are
 * already initialized. `root` is the wrapper the caller builds -- `{ selectionEntries: entry }` --
 * so the first level is reached under the key that decides its prototype.
 *
 * Returns how many nodes were initialized, which is 0 for the common case of re-running over an
 * already-live subtree.
 */
export function initializeSubtree(root: object, hooks: InitializeHooks): number {
  const seen = new WeakSet<object>();
  const stack: Pending[] = [{ node: root as Record<string, unknown>, key: "" }];
  let initialized = 0;

  while (stack.length) {
    const current = stack.pop()!;
    for (const key of Object.keys(current.node)) {
      if (BACK_REFERENCES.has(key)) continue;
      const value = current.node[key];
      if (!isPlainish(value)) continue;

      // Arrays are containers, not nodes: their elements take the array's key as their own, and
      // each is tested separately rather than assuming the array is homogeneous from its first.
      const children = Array.isArray(value) ? value : [value];
      for (const child of children) {
        if (!isPlainish(child) || Array.isArray(child)) continue;
        if (seen.has(child)) continue;
        seen.add(child);
        if (!hooks.initialized(child)) {
          hooks.initialize(child, key);
          initialized += 1;
        }
        stack.push({ node: child, key });
      }
    }
  }

  return initialized;
}
