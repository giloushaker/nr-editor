import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { ArmyBookArmy, ArmyBookBook, ArmyBookOption, ArmyBookUnit } from "./army_book_interfaces";
import { catalogueAllRefs, convertRef, T9ARef } from "./refs";
import { cost } from "../t9a/costs";
import {
  addConstraint,
  armyConstraints,
  hasNotOption,
  hasOption,
  initConstraintCategories,
  leafMaxCost,
  setSpecialEquipment,
} from "./constraints";
import { BSICategoryLink, BSIInfoLink } from "~/assets/shared/battlescribe/bs_types";
import { cleanup, toTitleCaseWords } from "./util";
import { Group } from "~/assets/shared/battlescribe/bs_main";
import { addDictionnaryEntries } from "./dictionnary";
import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";
import { findRule } from "./rule_importer";
import { override } from "./override";
import { insertSpells } from "./spells_importer";

const sortIndex: Record<string, { index: number; collapsible: boolean }> = {
  Models: { index: 1, collapsible: false },
  Leadership: { index: 2, collapsible: true },
  "Leadership Skills": { index: 3, collapsible: true },
  "Specialist Skills": { index: 4, collapsible: true },
  "Blood Powers": { index: 5, collapsible: true },
  Honour: { index: 6, collapsible: true },
  Type: { index: 7, collapsible: true },
  Command: { index: 8, collapsible: true },
  Mount: { index: 9, collapsible: true },
  Magic: { index: 10, collapsible: true },
  Level: { index: 11, collapsible: true },
  Path: { index: 12, collapsible: true },
  Equipment: { index: 13, collapsible: true },
  Weapons: { index: 14, collapsible: true },
  "Castellan Weapons": { index: 15, collapsible: true },
  Manifestations: { index: 16, collapsible: true },
  Options: { index: 13, collapsible: false },

  Weapon: { index: 1, collapsible: true },
  "Melee Weapon": { index: 2, collapsible: true },
  "Hand Weapon Enchant": { index: 3, collapsible: true },
  "Ranged Weapon": { index: 4, collapsible: true },
  Shield: { index: 5, collapsible: true },
  "Shield Enchant": { index: 6, collapsible: true },
  Armour: { index: 7, collapsible: true },
  "Armour Enchant": { index: 8, collapsible: true },
  Artefact: { index: 9, collapsible: true },
  "Postions and Scrolls": { index: 10, collapsible: true },
};

export default class T9AImporter {
  catalogues: Catalogue[];
  refCatalogue: Record<string, T9ARef> = {};
  book: ArmyBookBook;
  specialBook?: ArmyBookBook;
  gst: Catalogue;
  catalogue: Catalogue;
  specialCatalogue: Catalogue;
  categoryCatalogue: Catalogue;

  constructor(catalogues: Catalogue[], book: any, specialBook?: any) {
    this.book = book;
    this.catalogue = catalogues.find((elt) => elt.name === this.book.name)!;
    this.specialCatalogue = catalogues.find((elt) => elt.name === "Special Items")!;
    this.categoryCatalogue = catalogues.find((elt) => elt.name === "Categories")!;
    this.gst = catalogues[0];
    this.catalogues = catalogues;
    if (!this.catalogue) {
      console.error(catalogues);
      throw "Unable to find catalogue: " + this.book.name;
    }

    catalogueAllRefs(this, this.book, this.refCatalogue);
    if (specialBook) {
      catalogueAllRefs(this, specialBook, this.refCatalogue);
    }
  }

  /*
   ** Import order: ruledefs.json > spells.json > special.json > all catalogues json > unitstats.json
   */

  public async import() {
    await cleanup(this.catalogue);

    await initConstraintCategories(this);
    await this.insertArmyForceEntry();
    await this.addDictionnary();
    await this.addUnits();

    await armyConstraints(this);
  }

  convertOption(opt: ArmyBookOption, parentArmy: ArmyBookArmy | null, parentUnit?: ArmyBookUnit): Record<string, any> {
    // Base Fields
    const res: any = {
      name: opt.name || "",
      id: opt.option_id,
      costs: cost(opt.cost),
      selectionEntries: [],
      selectionEntryGroups: [],
      constraints: [],
      modifiers: [],
      collective: true,
      categoryLinks: [] as BSICategoryLink[],
      infoLinks: [],
      type: "upgrade",
      hidden: false,
    };

    // Add comment to identify shared items from special.json
    if (opt.shared && this.catalogue.name === "Special Items") res.comment = "shared item";

    // Name
    if (opt.type === "group" || opt.type == undefined) {
      res.name = opt.optionsLabel || opt.name || "";
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
      res.type = "model";
    }

    // Sort index for groups
    if (opt.optionsLabel && sortIndex[opt.optionsLabel]) {
      res.sortIndex = sortIndex[opt.optionsLabel].index;
      res.collapsible = sortIndex[opt.optionsLabel].collapsible;
    }

    let childGroup = res;

    // Cas d'une selection avec des options, il faut creer un child group
    if (opt.type == "check" || opt.type == "numeric") {
      if (opt.options?.length || opt.optionsDict?.length) {
        childGroup = {
          name: opt.optionsLabel || opt.name || "",
          selectionEntries: [],
          selectionEntryGroups: [],
          constraints: [],
        };
        res.selectionEntryGroups!.push(childGroup);
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
        comment: "minSize",
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
        comment: "maxSize",
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

    // Rarity
    if (opt.rarity) {
      res.comment = `Rarity: ${opt.rarity}`;
    }
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
      if (child.shared && child.cost) {
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
          if (converted.targetId == null) {
            childGroup.selectionEntries.push(converted);
          } else {
            if (!childGroup.entryLinks) childGroup.entryLinks = [];
            childGroup.entryLinks.push(converted);
          }
        }
      }
    }

    // Add rule links
    const rule = findRule(this.catalogues, this.book.name, res.name);
    if (rule) {
      if (parentUnit) {
        res.targetId = rule.id;
        res.type = "selectionEntry";
      } else {
        res.infoLinks.push(
          ...(rule.infoLinks || []).map((link) => {
            const res: BSIInfoLink = {
              hidden: false,
              targetId: link.targetId,
              name: link.name,
              id: link.id,
              type: link.type,
            };
            return res;
          })
        );
      }
    }

    // Modifiers
    override(this, opt, res);

    // Spells
    if (parentUnit) {
      insertSpells(this, opt, res, parentUnit);
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
            option_id: generateBattlescribeId(),
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
            converted.comment = `dict:${elt.refs.join("-")}`;
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

        // Add Units
        for (let unit of cat.options) {
          const converted = this.convertOption(unit, army, unit);
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
}
