import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { ArmyBookArmy, ArmyBookBook, ArmyBookOption, ArmyBookUnit } from "./army_book_interfaces";
import { catalogueAllRefs, convertRef, T9ARef } from "./refs";
import { cost } from "../t9a/costs";
import {
  addConstraint,
  hasNotOption,
  hasOption,
  initConstraintCategories,
  leafMaxCost,
  setSpecialEquipment,
} from "./constraints";
import { BSICategoryLink } from "~/assets/shared/battlescribe/bs_types";
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
  categoryCatalogue: Catalogue;

  constructor(catalogues: Catalogue[], book: string) {
    this.book = JSON.parse((book || "").replace(/ /g, "")) as ArmyBookBook;
    this.catalogue = catalogues.find((elt) => elt.name === this.book.name)!;
    this.specialCatalogue = catalogues.find((elt) => elt.name === "Special Items")!;
    this.categoryCatalogue = catalogues.find((elt) => elt.name === "Categories")!;
    this.gst = catalogues[0];
    this.catalogues = catalogues;
    if (!this.catalogue) throw "Unable to find catalogue";

    this.refCatalogue = catalogueAllRefs(this, this.book) || {};
  }

  public async import() {
    await initConstraintCategories(this);

    await this.cleanup();
    await this.insertArmyForceEntry();
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
      modifiers: [],
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

    // add hasOption Constraints
    hasOption("hasOption", this, opt, res);
    hasOption("armyHasOption", this, opt, res);
    hasNotOption("hasNotOption", this, opt, res);
    hasNotOption("armyHasNotOption", this, opt, res);

    leafMaxCost(this, opt, res);

    // Add Category Links from Constraint Categories
    for (let ref of opt.refs || []) {
      let actualRef = convertRef(ref);
      const category = this.categoryCatalogue.categoryEntries?.find((elt) => elt.comment === actualRef.ref);

      if (category) {
        const link: BSICategoryLink = {
          name: "",
          id: generateBattlescribeId(),
          targetId: category.id,
          hidden: false,
        };
        res.categoryLinks.push(link);
      }
    }

    // Convertis les child soit en selectionEntry ou en selectionEntryGroup
    for (let child of opt.options || []) {
      const converted = this.convertOption(child, parentArmy, parentUnit);

      // Make a link for shared items
      if (child.shared) {
        // Find the target in the special catalogue
        for (let group of this.specialCatalogue.sharedSelectionEntryGroups || []) {
          for (let entry of group.selectionEntries || []) {
            if (entry.name === converted.name) {
              // Found
              converted.targetId = entry.id;
              break;
            }
          }
          if (converted.targetId) break;
        }

        if (converted.targetId) {
          if (!childGroup.entryLinks) childGroup.entryLinks = [];
          childGroup.entryLinks.push(converted);
        } else {
          console.log("Could not find target for shared item: " + converted.name);
        }
      } else {
        if (child.type == undefined || child.type === "group") {
          childGroup.selectionEntryGroups.push(converted);
        } else {
          childGroup.selectionEntries.push(converted);
        }
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
            option_id: `dictoptionid12345678910:${elt.refs.join("-")}`,
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
            const added = await $store.add(converted, "sharedSelectionEntryGroups", this.catalogue as any);
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
        const catRef = cat.refs ? cat.refs[0] : "?";

        // Add Category entry to the book if it does not exist
        let primaryCategory = this.gst.categoryEntries?.find((elt) => elt.comment === catRef);
        if (!primaryCategory) primaryCategory = this.catalogue.categoryEntries?.find((elt) => elt.comment === catRef);
        if (!primaryCategory && cat.refs) {
          const newCategory: any = {
            comment: cat.refs[0],
            id: generateBattlescribeId(),
            name: cat.name,
            hidden: false,
          };
          primaryCategory = await $store.add(newCategory, "categoryEntries", this.catalogue as any);
          if (primaryCategory) {
            const categoryLink = {
              name: primaryCategory.name,
              hidden: false,
              id: generateBattlescribeId(),
              targetId: primaryCategory.id,
            };

            const force = this.catalogue.forceEntries?.find((elt) => elt.name === "Army");
            if (force) {
              await $store.add(categoryLink, "categoryLinks", force as any);
            }
          }
        }

        for (let unit of cat.options) {
          const converted = this.convertOption(unit, army);
          converted.type = "unit";
          const elt = (await $store.add(converted, "sharedSelectionEntries", this.catalogue as any)) as EditorBase;
          if (!cat.invisible) {
            const link: any = {
              type: "selectionEntry",
              costs: [],
              hidden: false,
              name: elt.name,
              targetId: elt.id,
              id: generateBattlescribeId(),
              categoryLinks: [],
            };

            elt.forEach(async (elt) => {
              await setSpecialEquipment(elt as EditorBase);
            });

            // Add Primary Category

            if (primaryCategory) {
              link.categoryLinks.push({
                name: "",
                id: generateBattlescribeId(),
                targetId: primaryCategory.id,
                hidden: false,
                primary: true,
              });
            }
            await $store.add(link, "entryLinks", this.catalogue as any);
          }
        }
      }
    }
  }

  async insertArmyForceEntry() {
    const node = {
      name: "Army",
      id: generateBattlescribeId(),
      hidden: false,
      categoryLinks: [
        {
          name: "Characters",
          hidden: false,
          id: generateBattlescribeId(),
          targetId: "953d-22cd-7ee1-36dc",
        },
        {
          name: "Core Units",
          hidden: false,
          id: generateBattlescribeId(),
          targetId: "4bcd-01c8-ce5e-7108",
        },
        {
          name: "Special",
          hidden: false,
          id: generateBattlescribeId(),
          targetId: "f8f1-3d4f-12bf-73cd",
        },
      ],
    };
    if (this.catalogue.name !== "Special Items") {
      await $store.add(node, "forceEntries", this.catalogue as any);
    }
  }

  async cleanup() {
    const toDelete = [
      "sharedSelectionEntries",
      "selectionEntries",
      "forceEntries",
      "categoryEntries",
      "sharedSelectionEntryGroups",
      "selectionEntryLinks",
      "sharedSelectionEntryLinks",
      "entryLinks",
    ];

    for (let elt of toDelete) {
      const node = (this.catalogue as any)[elt] as EditorBase[];
      await $store.remove(node);
    }
  }
}
