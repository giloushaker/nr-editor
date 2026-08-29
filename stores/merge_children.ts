/**
 * Decides which generated children map onto which existing ones, for editorStore.merge.
 *
 * Split out and kept free of imports so it can be exercised on its own -- a mistake here
 * either updates the wrong node, or reports a node as extra that the caller then deletes.
 * See merge_children_check.ts.
 */

export interface MergePlan<E, I> {
  /** Incoming children matched to the existing node they update. */
  pairs: Array<{ existing: E; incoming: I }>;
  /** Incoming children with nothing to update; these get added. */
  added: I[];
  /** Existing children the incoming data does not mention. Reported, never deleted. */
  extra: E[];
}

/**
 * Ids when the generator supplies them, names otherwise.
 *
 * Generator scripts derive ids from a semantic path (scripts/import's `id()` hashes one), so a
 * regenerated child comes back with the id it had. Data typed by hand has none, and there
 * typeName/name is the only thing stable between two runs.
 */
export function mergeKey(byId: boolean): (node: any) => string {
  return (node) => (byId ? String(node.id) : `${node.typeName ?? node.editorTypeName ?? ""}/${node.name}`);
}

export function planMerge<E extends object, I extends object>(
  existing: E[],
  incoming: I[],
  key?: (node: any) => string,
): MergePlan<E, I> {
  const byId = incoming.length > 0 && incoming.every((child) => Boolean((child as { id?: unknown }).id));
  const keyOf = key ?? mergeKey(byId);

  // Buckets rather than one entry per key: two existing children can share a name, and
  // indexing only the first would leave the second invisible -- neither matched nor reported.
  const remaining = new Map<string, E[]>();
  for (const child of existing) {
    const k = keyOf(child);
    const bucket = remaining.get(k);
    if (bucket) bucket.push(child);
    else remaining.set(k, [child]);
  }

  const pairs: MergePlan<E, I>["pairs"] = [];
  const added: I[] = [];
  for (const child of incoming) {
    // Taken out of the bucket, so two incoming children with the same key consume two existing
    // ones rather than both updating the first and losing an edit.
    const match = remaining.get(keyOf(child))?.shift();
    if (match) pairs.push({ existing: match, incoming: child });
    else added.push(child);
  }

  const extra: E[] = [];
  for (const bucket of remaining.values()) extra.push(...bucket);
  return { pairs, added, extra };
}
