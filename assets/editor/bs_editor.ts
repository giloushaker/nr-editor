import { Base, Condition, ConditionGroup, Constraint, Link, LocalConditionGroup, Modifier,  Repeat,  goodJsonKeys } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, CatalogueLink } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { conditionToString, fieldToText, getModifierOrConditionParent, modifierToString } from "~/assets/shared/battlescribe/bs_modifiers";
import type {
  BSICondition,
  BSIConditionGroup,
  BSIConstraint,
  BSILocalConditionGroup,
  BSIModifier,
  BSIModifierGroup,
  BSIProfile,
  BSIRepeat,
} from "~/assets/shared/battlescribe/bs_types";
import { BSCatalogueManager } from "~/assets/shared/battlescribe/bs_system";
import { isObject, type MaybeArray } from "~/assets/shared/battlescribe/bs_helpers";
import { textNodeTags } from "~/assets/shared/battlescribe/bs_convert";
import { entries, types } from "~/assets/shared/battlescribe/entries";
export interface CategoryEntry {
  name: string;
  type: string & keyof typeof entries;
  links?: string & keyof typeof entries;
  icon: string;
}

/**
 * Anything the editor can show in a panel, plus the promise that it has been through
 * prototype grafting. The two node fields used to be re-declared here with slightly different
 * types than Base carries, so nothing was ever assignable to it; Pick keeps them in step.
 */
/**
 * A key child nodes live under: what `parentKey` holds, and what a catalogue's category
 * headers offer to create. Was used as a bare global in several components and defined
 * nowhere, so it silently meant `any`.
 */
export type ItemKeys = Base["parentKey"];

export type ItemTypes = (Base | Link | Catalogue | BSIModifier | BSIModifierGroup | BSICondition | BSIConditionGroup | BSIConstraint) &
  Pick<Base, "parentKey" | "editorTypeName">;
export const filterByItems = [
  {
    id: "any",
    name: "Anything",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
  {
    id: "self",
    name: "Self",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
  {
    id: "unit",
    name: "Unit",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
  {
    id: "model",
    name: "Model",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
  {
    id: "upgrade",
    name: "Upgrade",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
  {
    id: "mount",
    name: "Mount",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
  {
    id: "crew",
    name: "Crew",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
  {
    id: "entry",
    name: "Entry",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
  {
    id: "group",
    name: "Group",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
  {
    id: "force",
    name: "Force",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
  {
    id: "category",
    name: "Category",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
  {
    id: "roster",
    name: "Roster",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
  {
    id: "header",
    name: "Header",
    editorTypeName: "bullet",
    indent: 0,
    catalogue: null,
    shared: false,
  },
];
export const possibleChildren: Array<string & keyof typeof entries> = [
  // Catalogue stuff
  "publications",
  "costTypes",
  "profileTypes",
  "sharedProfiles",
  "sharedRules",

  // Modifiable
  "infoLinks",
  "profiles",
  "rules",
  "infoGroups",
  "sharedInfoGroups",

  // Children
  "categoryEntries",
  // "categoryLinks", BS does not show category links
  "forceEntries",
  "selectionEntries",
  "selectionEntryGroups",
  "entryLinks",

  // Constraints and modifiers
  "constraints",
  "conditions",
  "modifiers",
  "modifierGroups",
  "repeats",
  "conditionGroups",
  "localConditionGroups",
];
export const systemCategories: CategoryEntry[] = [
  {
    type: "publications",
    name: "Publications",
    icon: "publication.png",
  },
  {
    type: "costTypes",
    name: "Cost Types",
    icon: "cost.png",
  },
  {
    type: "profileTypes",
    name: "Profile Types",
    icon: "profileType.png",
  },
  {
    type: "categoryEntries",
    name: "Category Entries",
    icon: "categoryEntry.png",
  },
  {
    type: "forceEntries",
    name: "Force Entries",
    icon: "forceEntry.png",
  },
  {
    type: "sharedSelectionEntries",
    name: "Shared Selection Entries",
    icon: "selectionEntryLink.png",
  },
  {
    type: "sharedSelectionEntryGroups",
    name: "Shared Selection Entry Groups",
    icon: "shared_groups.png",
  },
  {
    type: "sharedProfiles",
    name: "Shared Profiles",
    icon: "shared_profiles.png",
  },
  {
    type: "sharedRules",
    name: "Shared Rules",
    icon: "shared_rules.png",
  },
  {
    type: "sharedInfoGroups",
    name: "Shared Info Groups",
    icon: "infoGroup.png",
  },
  {
    type: "sharedAssociations",
    name: "Shared Associations",
    icon: "association.png",
  },
  {
    type: "sharedForceEntries",
    name: "Shared Force Entries",
    icon: "forceEntryLink.png",
  },
  {
    type: "rules",
    links: "infoLinks",
    name: "Root Rules",
    icon: "rule.png",
  },
  {
    type: "selectionEntries",
    links: "entryLinks",
    name: "Root Selection Entries",
    icon: "selectionEntry.png",
  },
];
export const catalogueCategories: CategoryEntry[] = [
  {
    type: "catalogueLinks",
    name: "Catalogue Links",
    icon: "catalogueLink.png",
  },
  ...systemCategories,
];

export function getTypeLabel(key: string & keyof typeof types): string {
  const label = types[key]?.label;
  if (label) return label;
  console.warn("unknown getTypeLabel key", key);
  return key;
}
export function getTypeName(key: string & keyof typeof entries, obj?: Base): keyof typeof types {
  if (obj?.target) {
    const targetType = getTypeName((obj.target ).parentKey as string & keyof typeof entries, obj.target);
    return (targetType + "Link") as keyof typeof types;
  }
  const type = (entries[key] as { type?: keyof typeof types })?.type;
  if (type) return type;
  return key as keyof typeof types;
}

/**
 * Short forms for the few type names that are a mouthful. Only `is` reads these --
 * `editorTypeName` keeps the long names, which are saved in filters and compared by name.
 */
export const shortNames = {
  selectionEntry: "entry",
  selectionEntryGroup: "group",
  selectionEntryLink: "entryLink",
  selectionEntryGroupLink: "groupLink",
} as const;

/** What `is` can hold: every type name, with the four above swapped for their short form. */
export type NodeIs = Exclude<keyof typeof types, keyof typeof shortNames> | (typeof shortNames)[keyof typeof shortNames];

/**
 * What a node *is*, in the short form the editor talks in. Same answer as `getTypeName` --
 * shared and non-shared arrays already collapse to one type there -- only shorter, so
 * `selectionEntryGroup` reads as `group`. Links keep their suffix, so a switch can still
 * tell an `entry` from an `entryLink`.
 */
export function getIs(key: string & keyof typeof entries, obj?: Base): NodeIs {
  const type = getTypeName(key, obj);
  return (shortNames[type as keyof typeof shortNames] ?? type) as NodeIs;
}

export function getNameExtra(obj: EditorBase, _refs = true, _type = true): string {
  const type = obj.parentKey;
  const pieces = [];
  switch (type) {
    case "infoLinks":{

      const targetKey = (obj.target)?.parentKey;
      if (targetKey && ["profiles", "sharedProfiles"].includes(targetKey) && _type) {
        pieces.push((obj.target as unknown as BSIProfile).typeName);
      }
      break;
    }
    case "sharedProfiles":
    case "profiles":
      if (_type) {
        pieces.push((obj as unknown as BSIProfile).typeName);
      }
      break;
    case "selectionEntries":
    case "sharedSelectionEntries":
      if (obj.isEntry() && obj.getType() !== "upgrade" && _type) {
        pieces.push(obj.getType());
      }
      break;
    case "entryLinks":
      if (obj.target && obj.isEntry() && obj.getType() !== "upgrade" && _type) {
        pieces.push(obj.getType());
      }
      break;
    case "modifierGroups":
      pieces.push(`(${(obj.modifiers?.length || 0) + (obj.modifierGroups?.length || 0)})`);
      break;
    case "constraints":
      if ((obj as unknown as BSIConstraint).automatic) {
        pieces.push("(automatic)");
      }
      break;
    default:
      break;
  }
  const refcount = (obj.refs?.length ?? 0) + (obj.other_refs?.length ?? 0);
  if (refcount && _refs) {
    const s = refcount === 1 ? "" : "s";
    pieces.push(`(${refcount || 0} ref${s})`);
  }
  if (obj.comment && obj.comment[0]) {
    pieces.push("# " + obj.comment);
  }
  if (obj.isCollective && obj.isCollective()) {
    pieces.push("(collective)");
  }
  // isTracked falls through to the target on links, so a link to a tracked category shows the hint too
  if (obj.isTracked && obj.isTracked()) {
    pieces.push("(tracked)");
  }
  return pieces.join(" ");
}

export function getName(obj: Base): string {
  const type = obj.parentKey;
  switch (type) {
    case "sharedSelectionEntries":
    case "selectionEntries":
    case "entryLinks":
    // falls through
    case "sharedSelectionEntryGroups":
    case "selectionEntryGroups":
    // falls through
    case "sharedForceEntries":
    case "forceEntries":
    case "forceEntryLinks":
    // falls through
    case "categoryEntries":
    case "categoryLinks":
    // falls through
    case "sharedInfoGroups":
    case "infoGroups":
    case "infoLinks":
    // falls through
    case "publications":
    // falls through
    case "catalogue":
    case "gameSystem":
    case "catalogueLinks":
    // falls through
    case "sharedRules":
    case "rules":
    // falls through
    case "costs":
    case "costTypes":
    // falls through
    case "profileTypes":
    case "sharedProfiles":
    case "profiles":
    // falls through
    case "attributeTypes":
    case "attributes":
    // falls through
    case "characteristicTypes":
    case "characteristics":
    // falls through
    case "associations":
    case "sharedAssociations":
    case "associationLinks":
      return obj.getName();
    case "modifiers":
      return modifierToString(getModifierOrConditionParent(obj), obj as Modifier);
    case "repeats": {
      // Double cast: Repeat redeclares `repeats` as the count, while Condition.repeats is the
      // array of them, so the two do not structurally overlap. Same clash the class suppresses
      // on that member.
      const repeat = obj as unknown as Repeat;
      const parent = getModifierOrConditionParent(obj);
      if (!parent) {
        console.warn("no parent for repeat", obj);
      }
      return (
        `Repeat ${repeat.repeats} times for every ${repeat.value} ${fieldToText(parent, repeat.field)} in ${fieldToText(
          parent,
          repeat.scope,
        )} of ${repeat.childId ? fieldToText(parent, repeat.childId) : " any"}` + (repeat.includeChildSelections ? " (recursive)" : "")
      );
    }
    case "constraints": {
      const constraint = obj as Base & BSIConstraint;
      return conditionToString(getModifierOrConditionParent(obj), constraint);
    }
    case "conditions":
      return conditionToString(getModifierOrConditionParent(obj), obj as Base & BSICondition);
    case "localConditionGroups":
      return conditionToString(getModifierOrConditionParent(obj), obj as Base & BSILocalConditionGroup) + " where:";

    case "modifierGroups":
      return `Modify...`;
    case "conditionGroups":
      return `${(obj as Base & BSIConditionGroup).type!.toUpperCase()}`;
    default:
      console.log(type, obj);
      return type;
  }
}

/**
 * The array `entry` sits in on `parent` -- the one `parentKey` names.
 *
 * ArrayKeys are spread across Base and its subclasses, so no single declared type has them
 * all and the parent has to be widened to reach one by name. Same cast walkChildren makes,
 * in one place instead of at each of the six call sites that need it.
 */
export function siblingArray(parent: Base, key: string): EditorBase[] | undefined {
  return (parent as unknown as Record<string, EditorBase[] | undefined>)[key];
}

/**
 * Like siblingArray, but for a caller that is about to put something in: creates the array when
 * the parent does not have one yet.
 */
export function ensureSiblingArray(parent: Base, key: string): EditorBase[] {
  const arrays = parent as unknown as Record<string, EditorBase[] | undefined>;
  return (arrays[key] ??= []);
}

export function forEachEntryRecursive(entry: EditorBase, callback: (entry: EditorBase, key?: string, parent?: EditorBase) => unknown) {
  callback(entry);
  const stack = [entry];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const key of Object.keys(cur)) {
      if (!goodJsonKeys.has(key) || textNodeTags.has(key)) continue;
      const val = siblingArray(cur, key);
      if (val && Array.isArray(val)) {
        for (const e of val) {
          stack.push(e);
          callback(e, key, cur);
        }
      }
    }
  }
}

export function removeEntry(entry: EditorBase) {
  const parent = entry.parent;
  if (parent) {
    const arr = siblingArray(parent, entry.parentKey)!;
    const index = arr.indexOf(entry);
    if (index !== -1) {
      arr.splice(index, 1);
    }
  }
}

export function onRemoveEntry(removed: EditorBase, manager?: BSCatalogueManager) {
  const catalogue = removed.catalogue;
  forEachEntryRecursive(removed, (entry) => {
    catalogue.removeFromIndex(entry);
    if (entry.isLink && entry.isLink()) {
      catalogue.unlinkLink(entry);
      delete (entry as Partial<Link>).target;
    }
    // removeFromIndex already dropped this node's outgoing references.
    delete entry.parent;
    delete (entry as Partial<EditorBase>).catalogue;
  });
  if (manager && removed instanceof CatalogueLink) {
    catalogue.reload(manager);
  }
}

export function onAddEntry(entries: EditorBase[] | EditorBase, catalogue: Catalogue, parent: EditorBase | Catalogue, manager: BSCatalogueManager) {
  let reload = false;
  for (const entry of Array.isArray(entries) ? entries : [entries]) {
    forEachEntryRecursive(entry, (entry, key, _parent) => {
      if (isObject(entry)) {
        entry.parent = _parent || (parent );

        entry.catalogue = catalogue;
        catalogue.addToIndex(entry);
        if (entry instanceof Link) {
          catalogue.updateLink(entry);
        }
        // addToIndex records what this node points at, profile typeId included.
        if (entry instanceof CatalogueLink && entry.targetId) {
          reload = true;
        }
        catalogue.refreshErrors(entry);
      }
    });
  }
  if (reload && parent) {
    const catalogue = parent.catalogue || (parent as Catalogue);
    catalogue.reload(manager);
  }
}
export interface EntryPathEntry {
  key: string & keyof typeof entries;
  index: number;
  id?: string;
}
export interface EntryPathEntryExtended extends EntryPathEntry {
  type: string;
  display: string;
  label?: string;
  name?: string;
}

export function getEntryPath(entry: EditorBase): EntryPathEntry[] {
  if (!entry.parent && !entry.isCatalogue()) {
    return [{ id: entry.id, key: entry.parentKey, index: 0 }];
  }
  const result = [] as EntryPathEntry[];
  while (entry.parent) {
    const parent = (entry.parent || entry.catalogue) ;
    result.push({
      key: entry.parentKey,
      index: siblingArray(parent, entry.parentKey)!.indexOf(entry),
      id: entry.id,
    });
    entry = entry.parent;
  }
  result.reverse();
  return result;
}
export function getEntryPathInfo(entry: EditorBase): EntryPathEntry[] {
  if (!entry.parent && !entry.isCatalogue()) {
    return [{ id: entry.id, key: entry.parentKey, index: 0 }];
  }
  const result = [] as EntryPathEntryExtended[];
  do {
    const parent = (entry.parent || entry.catalogue) ;
    if (parent) {
      result.push({
        name: entry.getName(),
        type: entry.editorTypeName,
        label: entry.getTypeName(),
        display: getName(entry),
        key: entry.parentKey,
        index: siblingArray(parent, entry.parentKey)!.indexOf(entry),
        id: entry.id,
      });
    } else {
      result.push({
        name: entry.getName(),
        display: getName(entry),
        type: "catalogue",
        key: "catalogue",
        id: entry.id,
        index: 0,
      });
    }
    entry = entry.parent as typeof entry;
  } while (entry);
  result.reverse();
  return result;
}
/**
 *  Adds an entry at the specified path
 *  returns the parent
 */
export function addAtEntryPath(catalogue: Catalogue, path: EntryPathEntry[], entry: EditorBase) {
  let current: Base = catalogue;
  // resolve path up until the last node
  for (let i = 0; i < path.length - 1; i++) {
    const node = path[i];
    current = siblingArray(current, node.key)![node.index];
  }
  const lastNode = path[path.length - 1];
  ensureSiblingArray(current, lastNode.key).splice(lastNode.index, 0, entry);
  return current;
}
export function getAtEntryPath(catalogue: Catalogue, path: EntryPathEntry[]): EditorBase | undefined {
  let current: Base = catalogue;
  for (const node of path) {
    const found = siblingArray(current, node.key)?.[node.index];
    if (!found) return undefined;
    current = found;
  }
  return current;
}
export function popAtEntryPath(catalogue: Catalogue, path: EntryPathEntry[]): EditorBase {
  let current: Base = catalogue;
  // resolve path up until the last node
  const lastNode = path[path.length - 1];
  for (const node of path) {
    if (node === lastNode) continue;
    current = siblingArray(current, node.key)![node.index];
  }
  const result = siblingArray(current, lastNode.key)?.splice(lastNode.index, 1)[0];
  if (!result) throw new Error("popAtEntryPath failed");
  return result;
}
export function replaceAtEntryPath(catalogue: Catalogue, path: EntryPathEntry[], value: EditorBase): EditorBase {
  let current: Base = catalogue;
  // resolve path up until the last node
  const lastNode = path[path.length - 1];
  for (const node of path) {
    if (node === lastNode) continue;
    current = siblingArray(current, node.key)![node.index];
  }
  const result = siblingArray(current, lastNode.key)?.splice(lastNode.index, 1, value)[0];
  if (!result) throw new Error("replaceAtEntryPath failed");
  return result;
}
export function scrambleIds(catalogue: Catalogue, entry_or_entries: MaybeArray<EditorBase>) {
  const scrambled = {} as Record<string, string>;
  const arr = Array.isArray(entry_or_entries) ? entry_or_entries : [entry_or_entries];
  for (const entry of arr)
    forEachEntryRecursive(entry, (node) => {
      if (node.id) {
        // if (node instanceof Constraint && !(entry instanceof Constraint)) return;
        const currentId = node.id;
        const newId = catalogue.generateNonConflictingId(currentId);
        node.id = newId;
        scrambled[currentId] = newId;
      }
    });
  for (const entry of arr) {
    forEachEntryRecursive(entry, (node) => {
      if (node instanceof Condition) {
        if (node.scope in scrambled) {
          node.scope = scrambled[node.scope];
        }
        if (node.childId in scrambled) {
          node.childId = scrambled[node.childId];
        }
      }
      if (node instanceof Modifier) {
        if (node.field in scrambled) {
          node.field = scrambled[node.field];
        }
      }
    });
  }
}

/**
 * Which array a child of `key` actually belongs in under `parent`.
 *
 * Returns "" when it does not belong anywhere -- a shared entry has no home outside a
 * catalogue, for instance. Both callers already test `if (!key)`; the return type just did not
 * admit it, and claimed six unreachable branches were returning a real key.
 */
export function fixKey(
  parent: EditorBase | Catalogue,
  key: keyof typeof entries,
  catalogueKey?: keyof typeof entries,
): (string & keyof typeof entries) | "" {
  if (!parent.isCatalogue()) {
    switch (key) {
      case "sharedRules":
        return "rules";
      case "sharedProfiles":
        return "profiles";
      case "sharedInfoGroups":
        return "infoGroups";
      case "sharedSelectionEntries":
        return "selectionEntries";
      case "sharedSelectionEntryGroups":
        return "selectionEntryGroups";
      case "sharedAssociations":
        return "associations";
      default:
        return key;
    }
  } else if (catalogueKey) {
    switch (key) {
      case "sharedRules":
      case "rules":
        if (["sharedRules", "rules"].includes(catalogueKey)) {
          return catalogueKey;
        }
        return "";
      case "sharedProfiles":
      case "profiles":
        if (["sharedProfiles", "profiles"].includes(catalogueKey)) {
          return catalogueKey;
        }
        return "";
      case "sharedInfoGroups":
      case "infoGroups":
        if (["sharedInfoGroups", "infoGroups"].includes(catalogueKey)) {
          return catalogueKey;
        }
        return "";
      case "sharedSelectionEntries":
      case "selectionEntries":
        if (["sharedSelectionEntries", "selectionEntries"].includes(catalogueKey)) {
          return catalogueKey;
        }
        return "";
      case "sharedSelectionEntryGroups":
      case "selectionEntryGroups":
        if (["sharedSelectionEntryGroups", "selectionEntryGroups"].includes(catalogueKey)) {
          return catalogueKey;
        }
        return "";
      case "sharedAssociations":
      case "associations":
        if (["sharedAssociations", "associations"].includes(catalogueKey)) {
          return catalogueKey;
        }
        return "";

      default:
        return key;
    }
  }
  return key;
}
