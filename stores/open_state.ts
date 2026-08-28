/**
 * Shape of the left panel's persisted open/collapsed tree.
 *
 * `open[rootKey][0]` is the category box directly under the catalogue, and the entry's whole
 * path nests underneath it -- so path[0] appears twice, once as the category and once as its
 * own first segment. Reads and writes both go through here so they cannot drift apart; a
 * mismatch silently loses the user's expanded tree on reload.
 *
 * Kept free of imports so it can be exercised on its own. See open_state_check.ts.
 */

/** Structurally an EntryPathEntry from bs_editor.ts, not imported so this file stays standalone. */
export interface OpenPathEntry {
  key: string;
  index: number;
}

export type OpenTree = Record<string, any>;

export function openKeys(path: OpenPathEntry[]): Array<string | number> {
  const keys: Array<string | number> = [path[0].key, 0];
  for (const seg of path) keys.push(seg.key, seg.index);
  return keys;
}

/** Walks `keys` into the tree. With create=false, returns undefined at the first gap. */
export function walkOpen(tree: OpenTree, keys: Array<string | number>, create: boolean): OpenTree | undefined {
  let node = tree;
  for (const key of keys) {
    if (!node[key]) {
      if (!create) return undefined;
      node[key] = {};
    }
    node = node[key];
  }
  return node;
}

export function isOpen(tree: OpenTree | undefined, path: OpenPathEntry[]): boolean {
  if (!tree || !path.length) return false;
  return Boolean(walkOpen(tree, openKeys(path), false));
}

/**
 * Closing deletes the subtree, so descendants of a collapsed box are forgotten. That matches
 * the DOM walk this replaced, which never recursed into a box that was not itself open.
 */
export function setOpen(tree: OpenTree, path: OpenPathEntry[], open: boolean): void {
  if (!path.length) return;
  const keys = openKeys(path);
  if (open) {
    walkOpen(tree, keys, true);
    return;
  }
  const parent = walkOpen(tree, keys.slice(0, -1), false);
  if (parent) delete parent[keys[keys.length - 1]];
}
