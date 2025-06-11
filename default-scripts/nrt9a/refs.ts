import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { ArmyBookBook, ArmyBookOption, ArmyRef } from "./army_book_interfaces";
import { deepTrasverse } from "./option_tree";
import T9AImporter from "./t9a_importer";

export interface T9ARef {
  foundInBook: boolean;
  foundInSpecial: boolean;
  ref: string;
  amount: number;
  option_id: string;
  category_id?: string;
  catalogue: Catalogue;
}

function initRef(ref: string, id: string, cat: Catalogue) {
  return {
    foundInBook: false,
    foundInSpecial: false,
    ref: ref,
    amount: 0,
    option_id: id,
    catalogue: cat,
  };
}

export function convertRef(ref: ArmyRef) {
  let actualRef = ref;
  if (typeof actualRef === "string") {
    actualRef = {
      ref: actualRef,
      amount: 1,
    };
  }
  return actualRef;
}

function readRefs(
  catalogue: Catalogue,
  res: Record<string, T9ARef>,
  opt: ArmyBookOption,
  type: "foundInBook" | "foundInSpecial"
) {
  for (let ref of opt.refs || []) {
    let actualRef = convertRef(ref);

    if (!res[actualRef.ref]) {
      res[actualRef.ref] = initRef(actualRef.ref, opt.option_id, catalogue);
    }
    res[actualRef.ref].amount++;
    res[actualRef.ref][type] = true;
  }
}

export function catalogueAllRefs(importer: T9AImporter, book: ArmyBookBook, res: Record<string, T9ARef>) {
  const army = book.army ? book.army[0] : null;
  const catalogue = importer.catalogues.find((elt) => elt.name === book.name);

  if (!catalogue) return;

  if (army) {
    deepTrasverse(army, (child) => {
      const opt = child as ArmyBookOption;
      readRefs(catalogue, res, opt, "foundInBook");
    });
  }

  if (book.dictionnary) {
    for (let cat of book.dictionnary) {
      deepTrasverse(cat, (child) => {
        const opt = child as ArmyBookOption;
        readRefs(catalogue, res, opt, "foundInBook");
      });
    }
  }
}
