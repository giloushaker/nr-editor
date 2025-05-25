import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { ArmyBookArmy, ArmyBookBook, ArmyBookOption, ArmyBookUnit } from "./army_book_interfaces";
import { catalogueAllRefs, convertRef, T9ARef } from "./refs";
import { cost } from "../t9a/costs";
import { addConstraint, hasOption, initConstraintCategories } from "./constraints";
import { BSICategoryLink, BSIEntryLink } from "~/assets/shared/battlescribe/bs_types";
import { toTitleCaseWords } from "./util";
import { Group } from "~/assets/shared/battlescribe/bs_main";
import { addDictionnaryEntries } from "./dictionnary";
import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";

const sortIndex: Record<string, number> = {
  Models: 1,
  Leadership: 2,
  "Leadership Skills": 3,
  "Specialist Skills": 4,
  "Blood Powers": 5,
  Honour: 6,
  Type: 7,
  Command: 8,
  Mount: 9,
  Magic: 10,
  Level: 11,
  Path: 12,
  Equipment: 13,
  Weapons: 14,
  "Castellan Weapons": 15,
  Manifestations: 16,
  Options: 17,
};

export default class T9AImporter {
  catalogues: Catalogue[];
  refCatalogue: Record<string, T9ARef>;
  book: ArmyBookBook;
  gst: Catalogue;
  catalogue: Catalogue;
  specialCatalogue: Catalogue;

  constructor(catalogues: Catalogue[], book: string) {
    this.book = JSON.parse((book || "").replace(/ /g, "")) as ArmyBookBook;
    this.catalogue = catalogues.find((elt) => elt.name === this.book.name)!;
    this.specialCatalogue = catalogues.find((elt) => elt.name === "Special Items")!;
    this.gst = catalogues[0];
    this.catalogues = catalogues;
    if (!this.catalogue) throw "Unable to find catalogue";

    this.refCatalogue = catalogueAllRefs(this, this.book) || {};
  }

  public async import() {
    await initConstraintCategories(this);
    await this.addDictionnary();
    await this.addUnits();
  }

  convertOption(opt: ArmyBookOption, parentArmy: ArmyBookArmy | null, parentUnit?: ArmyBookUnit): Record<string, any> {
    // Base Fields
    const res: any = {
      name: opt.name,
      id: opt.option_id,
      costs: cost(opt.cost),
      selectionEntries: [],
      selectionEntryGroups: [],
      constraints: [],
      collective: true,
      categoryLinks: [] as BSICategoryLink[],
    };

    // Name
    if (opt.type === "group" || opt.type == undefined) {
      res.name = opt.optionsLabel || opt.name;
    }

    // Max 1 for checkboxes
    if (opt.type == "check") {
      addConstraint(res, {
        type: "max",
        value: 1,
        field: "selections",
        scope: "parent",
        shared: true,
        includeChildSelections: false,
      });
    }

    // addToUnitSize indicate its models
    if (opt.addToUnitSize) {
      res.name = "Models";
      res.sortIndex = 1;
    }

    if (res.name === "Number" && parentUnit) {
      res.name = parentUnit.name;
    }

    // Sort index for groups
    if (opt.optionsLabel) {
      res.sortIndex = sortIndex[opt.optionsLabel];
    }

    let childGroup = res;

    // Cas d'une selection avec des options, il faut creer un child group
    if (opt.type == "check" || opt.type == "numeric") {
      if (opt.options?.length || opt.optionsDict?.length) {
        childGroup = {
          name: opt.optionsLabel || opt.name,
          selectionEntries: [],
          selectionEntryGroups: [],
          constraints: [],
        };
        res.selectionEntryGroups.push(childGroup);
      }
    }

    // Min Size constraint pour le child group
    if (opt.minSize) {
      addConstraint(childGroup, {
        type: "min",
        value: opt.minSize,
        field: "selections",
        scope: "parent",
        shared: true,
        includeChildSelections: false,
      });
    }

    // Max constraint pour le child group
    if (opt.maxSize) {
      addConstraint(childGroup, {
        type: "max",
        value: opt.maxSize,
        field: "selections",
        scope: "parent",
        shared: true,
        includeChildSelections: false,
      });
    }

    addDictionnaryEntries(this.catalogue.sharedSelectionEntryGroups || [], opt, childGroup);
    addDictionnaryEntries(this.specialCatalogue.sharedSelectionEntryGroups || [], opt, childGroup);

    // hasOption Constraints
    if (parentUnit) {
      hasOption("hasOption", this, opt, parentUnit, res);
    }

    // Convertis les child soit en selectionEntry ou en selectionEntryGroup
    for (let child of opt.options || []) {
      const converted = this.convertOption(child, parentArmy, parentUnit);
      if (child.type == undefined || child.type === "group") {
        childGroup.selectionEntryGroups.push(converted);
      } else {
        childGroup.selectionEntries.push(converted);
      }
    }

    // Add Category Links from Constraint Categories
    for (let ref of opt.refs || []) {
      let actualRef = convertRef(ref);
      const catalogueRef = this.refCatalogue[actualRef.ref];
      if (catalogueRef && catalogueRef.category_id) {
        const link: BSICategoryLink = {
          name: "",
          id: generateBattlescribeId(),
          targetId: catalogueRef.category_id,
          hidden: false,
        };
        res.categoryLinks.push(link);
      }
    }

    return res;
  }

  // Add dictionnaries as sharedSelectionEntryGroups
  public async addDictionnary() {
    const dictionnaries = [this.book.dictionnary];

    // Add dictionnary
    for (let dict of dictionnaries) {
      for (let elt of dict) {
        for (let ref of elt.refs) {
          const opt: ArmyBookOption = {
            ...elt,
            option_id: `dict:${elt.refs.join("-")}`,
            name: toTitleCaseWords(ref),
            optionsLabel: toTitleCaseWords(ref),
          };

          let root: Group | null = null;
          // Find an existing entry group in the catalogue
          for (let elt of this.catalogue.sharedSelectionEntryGroups || []) {
            if (elt.name === opt.name) {
              root = elt;
            }
          }

          // if no existing group, create one
          if (root == null) {
            const converted = this.convertOption(opt, this.book.army ? this.book.army[0] : null);
            await $store.add(converted, "sharedSelectionEntryGroups", this.catalogue as any);
          } else {
            // Else add entries to the existing group
            for (let child of opt.options || []) {
              const entry = this.convertOption(child, this.book.army ? this.book.army[0] : null);
              await $store.add(entry, "selectionEntries", root as any);
            }
          }
        }
      }
    }
  }

  // addUnits are sharedSelectionEntries with a link in rootSelectionEntries
  public async addUnits() {
    const army = this.book.army ? this.book.army[0] : null;

    // Add Units
    if (army) {
      for (let cat of army.options) {
        for (let unit of cat.options) {
          const converted = this.convertOption(unit, army);
          converted.type = "unit";
          const elt = await $store.add(converted, "sharedSelectionEntries", this.catalogue as any);
          if (!cat.invisible) {
            const link: BSIEntryLink = {
              type: "selectionEntry",
              costs: [],
              hidden: false,
              name: elt.name,
              targetId: elt.id,
              id: generateBattlescribeId(),
            };
            await $store.add(link, "entryLinks", this.catalogue as any);
          }
        }
      }
    }
  }
}
