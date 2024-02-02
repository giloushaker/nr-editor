import { getModifierOrConditionParent } from "~/assets/shared/battlescribe/bs_modifiers";
import { Base, getDataObject } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSICondition, BSIDataCatalogue } from "~/assets/shared/battlescribe/bs_types";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { ChildProcess } from "child_process";

export interface EditorSearchItem {
  id: string;
  name: string;
  editorTypeName: string;
  indent: number;
  catalogue: string | null;
  shared: boolean;
  rootId?: string;
}
function getCatalogueName(obj: Base) {
  return obj.catalogue?.getName() ?? null;
}
function getRootId(entry?: EditorBase) {
  if (!entry?.parent) return;
  while (entry?.parent && !entry.parent.isCatalogue()) {
    entry = entry.parent
  }
  return entry.id;
}
function recursive(current: Catalogue | EditorBase, iterator: string, result: EditorSearchItem[], indent = 0) {
  for (const child of (current as any)[iterator]()) {
    result.push({
      name: child.name,
      editorTypeName: child.editorTypeName,
      id: child.id,
      indent: indent,
      catalogue: getCatalogueName(child),
      rootId: getRootId(child),
      shared: child.parentKey?.includes("shared") || false,
    });
    recursive(child, iterator, result, indent + 1);
  }
}

function recursiveWithFilter(
  current: Catalogue | EditorBase,
  iterator: string,
  cb: (current: EditorBase) => unknown,
  result: EditorSearchItem[],
  indent = 0
) {
  for (const child of (current as any)[iterator]()) {
    result.push({
      name: child.name,
      editorTypeName: child.editorTypeName,
      id: child.id,
      indent: indent,
      rootId: getRootId(child),
      catalogue: getCatalogueName(child),
      shared: child.parentKey?.includes("shared") || false,
    });
    recursive(child, iterator, result, indent + 1);
  }
}

export function getSearchElements(
  catalogue: Catalogue | EditorBase,
  type: keyof Catalogue | EditorBase
): EditorSearchItem[] {
  let res: EditorSearchItem[] = [];
  recursive(catalogue, type as string, res);
  return res;
}

export function getSearchSelections(
  catalogue: Catalogue | EditorBase,
  includeRootSelectionEntries: boolean
): EditorSearchItem[] {
  const res: EditorSearchItem[] = [];
  const iterator = includeRootSelectionEntries ? "iterateSelectionEntriesWithRoot" : "iterateSelectionEntries";
  recursive(catalogue, iterator, res);
  return res;
}

export function getSearchSelectionsWithCategory(
  item: EditorBase,
  catalogue: Catalogue | EditorBase
): EditorSearchItem[] {
  const res: EditorSearchItem[] = [];
  const primary = item.getPrimaryCategory();
  recursiveWithFilter(
    catalogue,
    "iterateAllRootEntries",
    (o) => getFirstAncestor(o).getPrimaryCategory() === primary,
    res
  );
  return res;
}

export function getSearchCategories(catalogue: Catalogue): EditorSearchItem[] {
  const res: EditorSearchItem[] = [];
  for (let elt of catalogue.iterateCategoryEntries()) {
    const child = elt as any;
    if (child.isCatalogue()) {
      continue;
    }
    res.push({
      name: child.name,
      editorTypeName: child.editorTypeName,
      id: child.id,
      indent: 0,
      catalogue: getCatalogueName(child),
      shared: getFirstAncestor(child)?.parentKey?.includes("shared") || false,
    });
  }
  return res;
}

export function getSearchCatalogues(catalogue: Catalogue): EditorSearchItem[] {
  const res: EditorSearchItem[] = [];
  for (const elt of Object.values((catalogue.manager as GameSystemFiles).getAllCatalogueFiles())) {
    if (!(elt as BSIDataCatalogue).catalogue) continue;
    const obj = getDataObject(elt);
    res.push({
      name: obj.name,
      editorTypeName: "catalogue",
      id: obj.id,
      indent: 0,
      catalogue: null,
      shared: false,
    });
  }
  return res;
}

export function itemDepth(item: EditorBase): number {
  let res = 0;
  let parent = getModifierOrConditionParent(item);
  while (parent) {
    res++;
    parent = parent.parent;
  }
  return res;
}

export function getParentUnitHierarchy(item: EditorBase): EditorSearchItem[] {
  let res: EditorSearchItem[] = [];
  let parent: EditorBase | undefined = item;
  let i = 0;
  const rootDepth = itemDepth(item) - 1;
  parent = getModifierOrConditionParent(item);
  while (parent != null && !parent.isCatalogue()) {
    if (parent.editorTypeName === "selectionEntry") {
      res.push({
        name: parent.name,
        id: parent.id,
        editorTypeName: parent.editorTypeName,
        indent: i,
        rootId: getRootId(parent),
        catalogue: getCatalogueName(parent),
        shared: getFirstAncestor(parent)?.parentKey?.includes("shared") || false,
      });
      i++;
    }
    parent = parent.parent;
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

export function getFirstAncestor(item: EditorBase): EditorBase {
  let parent = item;
  while (
    parent.parent != null &&
    parent.parent.editorTypeName != "gameSystem" &&
    parent.parent.editorTypeName != "catalogue"
  ) {
    parent = parent.parent;
  }
  return parent;
}

export function getFilterSelections(item: BSICondition & EditorBase, catalogue: Catalogue): EditorSearchItem[] {
  const includeAllRootEntries = ["primary-catalogue", "roster", "force", "ancestor"];
  if (includeAllRootEntries.includes(item.scope)) {
    return getSearchSelections(catalogue, true);
  }

  const res = getSearchSelections(catalogue, false);
  if (item.scope == "self") {
    const parent: EditorBase | undefined = getModifierOrConditionParent(item);
    return parent ? res.concat(getParentSelections(parent)) : res;
  }

  // if (item.scope == "ancestor") {
  //   return res;
  // }

  if (item.scope == "parent") {
    // It looks like first level elements of shared entries and groups consider the Roster as their parent
    if (getFirstAncestor(item)) {
      return getSearchSelections(catalogue, true);
    }

    const parent: EditorBase | undefined = getModifierOrConditionParent(item);
    return parent?.parent ? res.concat(getParentSelections(parent.parent)) : res;
  }

  if (item.scope == "primary-category") {
    return getSearchSelectionsWithCategory(getFirstAncestor(item), catalogue);
  }

  const parent = catalogue.findOptionById(item.scope) as EditorBase;
  if (parent) {
    return res.concat(getParentSelections(parent));
  }
  return res;
}

export function getFilterForces(item: EditorBase, catalogue: Catalogue, scope: string): EditorSearchItem[] {
  return [];
}
