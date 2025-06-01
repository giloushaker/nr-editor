// Règles et règles héritées
interface Rule {
  name: string;
  inherits?: string;
  type?: string;
  parameters?: any;
}

// Magic Items
interface MagicItem {
  name: string;
  type: string;
  cost: number;
  support?: any[];
  rarity?: string;
  dominant?: boolean;
  restriction?: string[];
  parameter?: string[]; // sharedMagicItems peut avoir ce champ
}

// Army Organisation (avec cas smallArmsFireDL spécial)
interface ArmyOrganisationSmallArmsLimits {
  number: number;
  pointsSlice: number;
}

interface ArmyOrganisationListEntry {
  weapons: string[];
  ratio: number;
}

interface ArmyOrganisation {
  name: string;
  logo: string;
  value?: number;
  minimum?: boolean;
  smallArmsLimits?: ArmyOrganisationSmallArmsLimits;
  list?: ArmyOrganisationListEntry[];
}

// Profile
interface ProfileRule {
  name: string;
  parameters?: any[];
}

type ProfileRules = (string | ProfileRule)[];

interface ProfileGlobal {
  chargeRate?: number;
  marchRate?: number;
  discipline?: number;
  rules?: ProfileRules;
}

interface ProfileDefensive {
  hp?: number;
  defensiveSkill?: number;
  resistance?: number;
  armour?: number | string;
  rules?: ProfileRules;
}

interface ProfileOffensiveA {
  name?: string;
  attacks?: number;
  offensiveSkill?: number;
  strength?: number;
  ap?: number;
  agility?: number;
  tags?: string[];
  rules?: ProfileRules;
}

interface UnitProfile {
  global?: ProfileGlobal;
  defensive?: ProfileDefensive;
  offensiveA?: ProfileOffensiveA;
}

// Options (nombreux cas d’options avec paramètres)
interface OptionGroupListEntry {
  name: string;
  costpermodel: number;
  god?: string; // Pour les manifestations
}

interface OptionChoiceLimits {
  minSelection: number;
  maxSelection: number;
}

interface OptionGroupParameters {
  list: OptionGroupListEntry[];
  optionChoiceLimits: OptionChoiceLimits;
}

interface OptionEntry {
  name: string;
  cost?: number | string;
  upto?: boolean;
  parameters?: {
    // Différents types d’options imbriquées
    allowanceifwizardmaster?: {
      cost: number;
      upto: boolean;
    };
    list?: OptionGroupListEntry[];
    optionChoiceLimits?: OptionChoiceLimits;
    spelllist?: { name: string; path?: string }[];
  };
  costpermodel?: number;
}

interface MountsParameters {
  list: {
    name: string;
    cost: number;
  }[];
}

interface Mounts {
  parameters: MountsParameters;
}

// Command group, wizard conclave, etc.
interface ParametersListEntry {
  name: string;
  cost?: number;
  parameters?: object;
  path?: string;
}
interface Parameters {
  list?: ParametersListEntry[];
  spelllist?: { name: string; path?: string }[];
}
interface WizardConclave {
  parameters: Parameters;
}
interface CommandGroup {
  parameters: Parameters;
}

// Army List (unité)
export interface ArmyListEntry {
  name: string;
  inherits?: string;
  categories?: string[];
  cost?: number;
  unitSize?: number;
  maxunitsize?: number;
  costpermodel?: number;
  rarity?: string;
  height?: number;
  baseSize?: { width: number; depth: number };
  profile?: UnitProfile;
  options?: OptionEntry[];
  mounts?: Mounts;
  paths?: string[];
  wizardconclave?: WizardConclave;
  commandgroup?: CommandGroup;
  modelRules?: { name: string }[];
  optionalModelRules?: { name: string }[];
  specificOptions?: OptionEntry[];
}

// Loc
interface LocObject {
  [key: string]: string;
}

export interface Loc {
  [lang: string]: LocObject;
}

// Structure racine
export interface T9aJson {
  name: string;
  prefix: string;
  version: string;
  date: string;
  logoPath: string;
  modelRules: Rule[];
  armyRules: Rule[];
  magicItems: MagicItem[];
  sharedMagicItems: MagicItem[];
  hereditarySpell: {
    name: string;
    inherits?: string;
  };
  armyOrganisation: ArmyOrganisation[];
  armyList: ArmyListEntry[];
  loc: Loc;
}
