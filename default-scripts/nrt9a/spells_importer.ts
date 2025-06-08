import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { ArmyBookOption, ArmyBookPath, ArmyBookUnit } from "./army_book_interfaces";
import {
  BSIInfoGroup,
  BSIProfile,
  BSISelectionEntry,
  BSISelectionEntryGroup,
} from "~/assets/shared/battlescribe/bs_types";
import { charac, toTitleCaseWords } from "./util";
import { sortByAscending } from "~/scripts/import/import_helpers";
import T9AImporter from "./t9a_importer";
import { convertRef } from "./refs";
import { deepTrasverse } from "./option_tree";
import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";

interface T9ARule {
  title: string;
  def: string;
}

export interface SpellsBook {
  name: "Spells";
  version: number;
  nrversion: number;
  permission: number;
  playable: 0;
  id: number;
  paths: Record<string, ArmyBookPath>;
}

function computeDuration(duration: number | null | undefined) {
  if (!duration) return "Instant";
  if (duration == 2) return "Permanent";
  return "One Turn";
}

export default class SpellsImporter {
  book: SpellsBook;
  catalogues: Catalogue[];
  constructor(catalogues: Catalogue[], book: SpellsBook) {
    this.book = book;
    this.catalogues = catalogues;
  }

  private async importSpell(catalogues: Catalogue[], path: ArmyBookPath) {}

  private async importPath(catalogues: Catalogue[], path: ArmyBookPath) {
    const gst = catalogues[0];
    const spellType = gst.profileTypes?.find((elt) => elt.name === "Spell");
    if (!spellType) return;

    const res: BSIInfoGroup = {
      name: path.name,
      id: `path-${path.ref}`,
      hidden: false,
      profiles: [],
    };

    for (let spell of path.spells) {
      const spellProfile: BSIProfile = {
        id: `spell-${spell.ref}`,
        typeId: "03f2-8c24-0df8-7052",
        name: spell.name,
        typeName: "Spell",
        hidden: false,
        attributes: [
          charac(spellType, "ref", spell.ref)!,
          charac(spellType, "path", path.ref)!,
          charac(spellType, "rep", spell.rep ? "true" : "false")!,
        ],
        characteristics: [
          charac(spellType, "Num", spell.number)!,
          charac(spellType, "Name", spell.name)!,
          charac(spellType, "Effect", spell.description)!,
        ],
      };
      if (spell.cast && spell.cast[0]) {
        spellProfile.characteristics.push(charac(spellType, "Range", `${spell.cast[0].range}`)!);
        spellProfile.characteristics.push(
          charac(
            spellType,
            "Types",
            spell.cast[0].types
              .map((elt) => toTitleCaseWords(elt))
              .filter((elt) => elt.length)
              .join(", ")
          )!
        );
        spellProfile.characteristics.push(charac(spellType, "Duration", computeDuration(spell.cast[0].duration))!);
        spellProfile.characteristics.push(charac(spellType, "Cast", `${spell.cast[0].value}`)!);
      }
      res.profiles?.push(spellProfile);
    }
    sortByAscending(res.profiles!, (item) => item.characteristics.find((elt) => elt.name === "Num")?.$text || "");
    const spellCatalogue = catalogues.find((elt) => elt.name === "Spells");
    if (spellCatalogue) {
      await $store.add(res, "sharedInfoGroups", spellCatalogue as any);
    }
  }

  public async import() {
    for (let pathid in this.book.paths) {
      const path = this.book.paths[pathid];
      await this.importPath(this.catalogues, path);
    }
  }
}

function findPath(spellBook: Catalogue, pathref: string) {
  return spellBook.sharedInfoGroups?.find((elt) => elt.id === `path-${pathref}`);
}

export function insertSpells(
  importer: T9AImporter,
  opt: ArmyBookOption,
  res: Record<string, any>,
  parentUnit: ArmyBookUnit
) {
  if (!opt.refs) return;
  const spellBook = importer.catalogues.find((elt) => elt.name === "Spells");
  if (!spellBook) return;
  const possibleLevels: Record<string, number> = {
    wizardApprentice: 1,
    wizardAdept: 3,
    wizardMaster: 5,
  };

  for (let elt of opt.refs) {
    const ref = convertRef(elt);
    const pathInfoGroup = findPath(spellBook, ref.ref);
    if (pathInfoGroup) {
      const group: BSISelectionEntryGroup = {
        id: generateBattlescribeId(),
        hidden: false,
        name: "Spells",
        collapsible: true,
        selectionEntries: [
          ...(pathInfoGroup.profiles || []).map((elt) => {
            const res: BSISelectionEntry = {
              type: "upgrade",
              id: generateBattlescribeId(),
              name: elt.name,
              hidden: false,
              constraints: [
                {
                  type: "max",
                  field: "selections",
                  id: generateBattlescribeId(),
                  value: 1,
                  scope: "parent",
                },
              ],
              infoLinks: [
                {
                  id: generateBattlescribeId(),
                  name: elt.name,
                  hidden: false,
                  type: "profile",
                  targetId: elt.id,
                },
              ],
            };
            return res;
          }),
        ],
        constraints: [
          {
            type: "exactly",
            id: generateBattlescribeId(),
            scope: "parent",
            field: "selections",
            value: 1,
          },
        ],
        modifiers: [],
      };
      group.modifiers!.push({
        type: "set",
        field: group.constraints![0].id,
        value: 1,
        conditions: [
          {
            field: "selections",
            scope: "unit",
            childId: "d176-2596-3285-fa8b", // Wizard Apprentice
            type: "atLeast",
            value: 1,
            includeChildSelections: true,
          },
        ],
      });

      group.modifiers!.push({
        type: "set",
        field: group.constraints![0].id,
        value: 3,
        conditions: [
          {
            field: "selections",
            scope: "unit",
            childId: "4151-e137-d2f9-3d24", // Wizard Adept
            type: "atLeast",
            value: 1,
            includeChildSelections: true,
          },
        ],
      });

      group.modifiers!.push({
        type: "set",
        field: group.constraints![0].id,
        value: 5,
        conditions: [
          {
            field: "selections",
            scope: "unit",
            childId: "84bf-0aec-016e-49c0", // Wizard Master
            type: "atLeast",
            value: 1,
            includeChildSelections: true,
          },
        ],
      });

      if (!res.selectionEntryGroups) res.selectionEntryGroups = [];
      res.selectionEntryGroups.push(group);
    }
  }
}
