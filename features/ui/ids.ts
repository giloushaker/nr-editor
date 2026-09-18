/**
 * Readable ids for anything the feature pages create: "model", "model-ws", "faction-space-marines".
 * They show up in git diffs and in queries, where a hex id says nothing. Existing hex ids stay;
 * nothing here renames.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Things there are few of carry their type as a prefix, so an id says what it is wherever it
 * shows up: sys-wh40k-6e, faction-space-marines, lib-wargear, force-army. Things there are
 * hundreds of (costs, profile types, columns, categories, units, options) do not, or every
 * diff would be half prefix.
 */
export const ID_PREFIX = {
  system: "sys",
  faction: "faction",
  library: "lib",
  force: "force",
} as const;

/** `base`, else `base-2`, `base-3`, ... the first the system does not already use. */
export function uniqueId(base: string, taken: (id: string) => boolean, prefix?: keyof typeof ID_PREFIX): string {
  const slug = (prefix ? `${ID_PREFIX[prefix]}-` : "") + (slugify(base) || "item");
  if (!taken(slug)) return slug;
  for (let n = 2; ; n++) {
    const id = `${slug}-${n}`;
    if (!taken(id)) return id;
  }
}
