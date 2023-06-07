import { getModifierOrConditionParent } from "~/assets/shared/battlescribe/bs_editor";
import { flattenRecursive, recurseThis } from "~/assets/shared/battlescribe/bs_helpers";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSICondition } from "~/assets/shared/battlescribe/bs_types";

export interface EditorSearchItem {
  id: string;
  name: string;
  editorTypeName: string;
  indent: number;
  catalogue: string | null;
  parentKey: string | null;
}

export function getSearchElements(
  catalogue: Catalogue | EditorBase,
  type: keyof Catalogue | EditorBase
): EditorSearchItem[] {
  let res: EditorSearchItem[] = [];
  let rec = recurseThis(catalogue, type as any, 1000) as any;
  let flat = flattenRecursive(rec, 0, []);

  for (let elt of flat) {
    const current = elt.current as any;
    if (current.isCatalogue()) {
      continue;
    }
    res.push({
      name: current.name,
      editorTypeName: current.editorTypeName,
      id: current.id,
      indent: elt.depth,
      catalogue: current.catalogue.getName(),
      parentKey: current.parentKey,
    });
  }
  return res;
}

export function getSearchSelections(
  catalogue: Catalogue | EditorBase,
  includeRootSelectionEntries: boolean
): EditorSearchItem[] {
  let res: EditorSearchItem[] = [];
  let rec = includeRootSelectionEntries
    ? recurseThis(catalogue, "iterateSelectionEntriesWithRoot" as any, 1000)
    : (recurseThis(catalogue, "iterateSelectionEntries" as any, 1000) as any);
  let flat = flattenRecursive(rec, 0, []);

  for (let elt of flat) {
    const current = elt.current as any;
    if (current.isCatalogue()) {
      continue;
    }
    res.push({
      name: current.name,
      editorTypeName: current.editorTypeName,
      id: current.id,
      indent: elt.depth,
      catalogue: current.catalogue.getName(),
      parentKey: current.parentKey,
    });
  }
  return res;
}

export function getSearchCategories(catalogue: Catalogue): EditorSearchItem[] {
  let res: EditorSearchItem[] = [];

  for (let elt of catalogue.iterateCategoryEntries()) {
    const current = elt as any;
    if (current.isCatalogue()) {
      continue;
    }
    res.push({
      name: current.name,
      editorTypeName: current.editorTypeName,
      id: current.id,
      indent: 1,
      catalogue: current.catalogue.getName(),
      parentKey: current.parentKey,
    });
  }
  return res;
}

export function itemDepth(item: EditorBase): number {
  let res = 0;
  let parent: EditorBase | null = getModifierOrConditionParent(item);
  while (parent) {
    res++;
    parent = parent.parent || null;
  }
  return res;
}

export function getParentUnitHierarchy(item: EditorBase): EditorSearchItem[] {
  let res: EditorSearchItem[] = [];
  let parent: EditorBase | null = item;
  let i = 1;
  const rootDepth = itemDepth(item);
  parent = getModifierOrConditionParent(item);
  while (parent != null && !parent.isCatalogue()) {
    res.push({
      name: parent.name,
      id: parent.id,
      editorTypeName: parent.editorTypeName,
      indent: i,
      catalogue: parent.catalogue.getName(),
      parentKey: parent.parentKey,
    });
    i++;
    parent = parent.parent || null;
  }
  res = res.reverse();
  res.forEach((elt, ind) => {
    elt.indent = ind + rootDepth;
  });
  return res;
}

export function getParentSelections(item: EditorBase): EditorSearchItem[] {
  const parentElements = getSearchElements(item, "iterateRootEntries");
  parentElements.splice(0, 1);
  return parentElements;
}

export function scopeIsId(item: BSICondition) {
  return (
    ["self", "parent", "ancestor", "primary-category", "primary-catalogue", "force", "roster"].includes(item.scope) ==
    false
  );
}

export function getFilterSelections(item: BSICondition & EditorBase, catalogue: Catalogue): EditorSearchItem[] {
  const includeAllRootEntries = ["primary-catalogue", "roster", "force"];
  if (includeAllRootEntries.includes(item.scope)) {
    return getSearchSelections(catalogue, true);
  }

  const res = getSearchSelections(catalogue, false);
  if (item.scope == "self") {
    const parent: EditorBase | null = getModifierOrConditionParent(item);
    return res.concat(getParentSelections(parent));
  }

  if (item.scope == "parent") {
    let parent: EditorBase | null = getModifierOrConditionParent(item);
    if (parent.parent) {
      parent = parent.parent;
    }
    return res.concat(getParentSelections(parent));
  }

  if (scopeIsId(item)) {
    const parent = catalogue.findOptionById(item.scope) as EditorBase;
    return res.concat(getParentSelections(parent));
  }

  if (item.scope == "primary-category") {
    // All root selection entries that have the same primary category as item's unit
  }

  return res;
}

export function getFilterForces(item: EditorBase, catalogue: Catalogue, scope: string): EditorSearchItem[] {
  return [];
}

/*
 TODO: check what happens if we select Query Forces instead of selections
       check what happens with conditions in Force Entries
       check what happens with conditions in Shared Selection Entries/Groups
*/
