import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSICharacteristic, BSIInfoLink, BSIProfile, BSIProfileType } from "~/assets/shared/battlescribe/bs_types";
import { findRule } from "./rule_importer";

export interface T9AProfileRule {
  name: string;
  id: string;
}

export interface T9AProfile {
  name: string;
  cost: string;
  height: string;
  basesize: string;
  rarity?: string;
  global: {
    Ad: string;
    Ma: string;
    Di: string;
  };
  globalrules: Array<T9AProfileRule>;
  defense: {
    HP: string;
    Df: string;
    Re: string;
    Arm: string;
  };
  defenserules: Array<T9AProfileRule>;
  defensearmour: Array<T9AProfileRule>;
  offensename: string;
  offense: {
    At: string;
    Of: string;
    St: string;
    AP: string;
    Ag: string;
  };
  offenserules: Array<T9AProfileRule>;
  fluff: string;
  unit_id: string;
}

function findProfileType(catalogues: Catalogue[], name: string) {
  const gst = catalogues[0];
  for (let prf of gst.profileTypes || []) {
    if (prf.name === name) return prf;
  }
  return null;
}

export interface StatsBook {
  name: "Unit Stats";
  version: number;
  nrversion: number;
  permission: number;
  playable: 0;
  id: number;
  units: Record<string, Record<string, T9AProfile>>;
}

export const bookNames: Record<string, string> = {
  se: "Sylvan Elves",
};

function charac(type: BSIProfileType, name: string, val: string) {
  const charType = type.characteristicTypes?.find((elt) => elt.name === name);
  let value: number | string = val;

  if (val?.match(/-+[0-9]+/)) {
    value = parseInt(val);
  } else {
    value = val;
    if (value == null) value = "";
  }

  if (charType) {
    const res: BSICharacteristic = { name: charType.name, typeId: charType.id || "", $text: value };

    return res;
  }

  return null;
}

export default class ProfileImporter {
  book: StatsBook;
  catalogues: Catalogue[];
  constructor(catalogues: Catalogue[], book: StatsBook) {
    this.book = book;
    this.catalogues = catalogues;
  }

  private importProfile(unit: EditorBase, profile: T9AProfile, armyName: string) {
    let target = unit;
    unit.forEach((child) => {
      if (child.type === "model") {
        target = child as EditorBase;
      }
    });

    // While we are at it, we can change the unit type of single models to model
    if (target === unit) unit.type = "model";
    const profileTypes = {
      global: findProfileType(this.catalogues, "Global"),
      defensive: findProfileType(this.catalogues, "Defensive"),
      offensive: findProfileType(this.catalogues, "Offensive"),
    };

    // Rarity
    if (profile.rarity) {
      unit.comment = `Rarity: ${profile.rarity}`;
    }

    // Global
    if (profileTypes.global) {
      const globalPrf: BSIProfile = {
        typeId: profileTypes.global.id!,
        typeName: profileTypes.global.name,
        name: profileTypes.global.name,
        id: generateBattlescribeId(),
        hidden: false,
        attributes: [],
        characteristics: [
          charac(profileTypes.global, "Cha", profile.global.Ma),
          charac(profileTypes.global, "Mob", profile.global.Ad),
          charac(profileTypes.global, "Dis", profile.global.Di),
          charac(profileTypes.global, "Height", profile.height),
          charac(profileTypes.global, "Model Rules", profile.globalrules?.map((elt) => elt.name).join(", ")),
        ].filter((elt) => elt != null),
      };
      globalPrf.characteristics.push();

      $store.add(globalPrf, "profiles", target);

      for (let rule of profile.globalrules || []) {
        const link = findRule(this.catalogues, armyName, rule.name);
        if (link) {
          $store.add(link, "infoLinks", target);
        }
      }
    }

    // Defense
    if (profileTypes.defensive) {
      const globalPrf: BSIProfile = {
        typeId: profileTypes.defensive.id!,
        typeName: profileTypes.defensive.name,
        name: profileTypes.defensive.name,
        id: generateBattlescribeId(),
        hidden: false,
        attributes: [],
        characteristics: [
          charac(profileTypes.defensive, "Arm", profile.defense.Arm),
          charac(profileTypes.defensive, "Def", profile.defense.Df),
          charac(profileTypes.defensive, "HP", profile.defense.HP),
          charac(profileTypes.defensive, "Res", profile.defense.Re),
          charac(profileTypes.defensive, "Model Rules", profile.defenserules?.map((elt) => elt.name).join(", ")),
        ].filter((elt) => elt != null),
      };
      globalPrf.characteristics.push();
      $store.add(globalPrf, "profiles", target);

      for (let rule of profile.defenserules || []) {
        const link = findRule(this.catalogues, armyName, rule.name);
        if (link) {
          $store.add(link, "rules", target);
        }
      }
    }

    // Offense
    if (profileTypes.offensive) {
      const globalPrf: BSIProfile = {
        typeId: profileTypes.offensive.id!,
        typeName: profileTypes.offensive.name,
        name: profile.offensename,
        id: generateBattlescribeId(),
        hidden: false,
        attributes: [],
        characteristics: [
          charac(profileTypes.offensive, "AP", profile.offense.AP),
          charac(profileTypes.offensive, "Agi", profile.offense.Ag),
          charac(profileTypes.offensive, "Att", profile.offense.At),
          charac(profileTypes.offensive, "Off", profile.offense.Of),
          charac(profileTypes.offensive, "Str", profile.offense.St),
          charac(profileTypes.offensive, "Model Rules", profile.offenserules?.map((elt) => elt.name).join(", ")),
        ].filter((elt) => elt != null),
      };
      globalPrf.characteristics.push();
      $store.add(globalPrf, "profiles", target);

      for (let rule of profile.offenserules || []) {
        const link = findRule(this.catalogues, armyName, rule.name);
        if (link) {
          $store.add(link, "rules", target);
        }
      }
    }
  }

  public import() {
    for (let armyShort in this.book.units) {
      const armyName = bookNames[armyShort];
      if (armyName) {
        const catalogue = this.catalogues.find((elt) => elt.name === armyName);
        if (catalogue) {
          for (let unitId in this.book.units[armyShort]) {
            const t9aProfile = this.book.units[armyShort][unitId];
            const unit = catalogue.entryLinks?.find((entry) => entry.target?.name === t9aProfile.name);
            if (unit) {
              // Root entries are all links
              const target = unit.target;
              this.importProfile(target as EditorBase, t9aProfile, armyName);
            }
          }
        }
      }
    }
  }
}
