import {
  flattenRecursive,
  recurseThis,
} from "~/assets/shared/battlescribe/bs_helpers";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export interface EditorSearchItem {
  id: string;
  name: string;
  editorTypeName: string;
  indent: number;
}

export function getSearchElements(
  catalogue: Catalogue,
  type: keyof Catalogue
): EditorSearchItem[] {
  let res: EditorSearchItem[] = [];
  let rec = recurseThis(catalogue, type, 1000) as any;
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
    });
  }
  return res;
}
