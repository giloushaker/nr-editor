interface ReferencedRule {
  id: string;
  params?: string[];
  universal?: boolean;
  invisible?: boolean; // if true make the child rule invisible
}

interface ICost {
  name: string;
  value: number;
  typeId: string;
  defaultCostLimit?: number;
  hidden?: boolean;
}

export type ArmyRef = string | { ref: string; amount: number };

export interface ArmyBookBook {
  name: string;
  translation: Record<string, string>;
  short: string;
  version: number;
  nrversion: string;
  id: number;
  include: number[];
  playable: number;
  hereditary: Array<{
    path: string;
    ref: string;
  }>;
  reference_details: Record<string, string>;
  dictionnary: Array<{
    refs: string[];
    options: ArmyBookOption[];
  }>;
  army: ArmyBookArmy[];
  indicators?: string[];
  costIndicators?: string[];
  useunitmax?: string[];
}

export interface ArmyBookCondition {
  refs: string[];
  amount: number;
  parentMult?: boolean;
  armyTypeMult?: boolean;
  lenient?: boolean;
  amountRefs?: string[];
  perPoints?: number;
  roundDown?: boolean;
  extra?: number;
  neverHide?: boolean;
  cost?: boolean; // Use total cost of selections instead of number of selection
  armyPercent?: boolean; // amount represents a percent of the max army cost instead of a fixed value
}

export type ArmyBookConditionTypes = "hasOption" | "armyHasOption" | "hasNotOption" | "armyHasNotOption";

export type T9ARarity = "Regular" | "Common" | "Uncommon" | "Rare" | "Extraordinary" | "Legendary";

export interface ArmyBookOverride {
  hasOption?: ArmyBookCondition[];
  armyHasOption?: ArmyBookCondition[];
  hasNotOption?: ArmyBookCondition[];
  armyHasNotOption?: ArmyBookCondition[];
  options: Omit<ArmyBookOption, "option_id">;
  increment?: Omit<ArmyBookOption, "option_id">;
  decrement?: Omit<ArmyBookOption, "option_id">;
  push?: Omit<ArmyBookOption, "option_id">;
}

export interface StatCondition {
  min?: number;
  max?: number;
  values?: string[];
  excluded?: string[];
}
export interface ArmyBookOption {
  option_id: string;
  name?: string;
  cost?: number;
  costs?: ICost[];
  shared?: boolean;
  leafMaxCost?: number;
  collapsible?: boolean;
  optionsLabel?: string;
  refs?: ArmyRef[];
  options?: ArmyBookOption[];
  minSize?: number | "x";
  maxSize?: number | "x";
  spells?: string[];
  type?: "check" | "group" | "numeric";
  hasOption?: (string | ArmyBookCondition)[];
  hasNotOption?: (string | ArmyBookCondition)[];
  armyHasOption?: (string | ArmyBookCondition)[];
  armyHasNotOption?: (string | ArmyBookCondition)[];
  hasStat?: {
    global?: Record<string, StatCondition>;
    offense?: Record<string, StatCondition>;
    defense?: Record<string, StatCondition>;
  };
  hasRule?: {
    value: boolean;
    id: string;
    noparams?: boolean;
  };

  hasCategory?: string[];
  hasNotCategory?: string[];
  override?: ArmyBookOverride[];
  sortOptions?: boolean;
  optionsSuffix?: string;
  optionsDict?: string[];
  exportGroup?: string;
  parentRule?: string;
  extraCategories?: string[];
  addToUnitSize?: boolean;

  hide?: boolean;
  hideLabel?: boolean;
  invisible?: boolean;

  countAsLeaf?: boolean;
  costParentMult?: boolean;
  description?: string;
  model?: string;
  leafCostName?: string; // default is Special Equipment
  extraLeafCost?: string; // Add the cost of nodes in the same unit that have this ref to leafMaxCost
  extraLeafMaxCost?: number;
  ignoreCost?: boolean; // ignore costs of a leaf when calculating leafMaxCost
  definesType?: string;
  replaceCategory?: string;
  refopt?: string;
  target_id?: string; // option_id of the referenced option
  skipErrors?: boolean;
  extraCategoriesNoDepth?: boolean;
  removeCategoriesNoDepth?: boolean;
  removeCategories?: string[];
  optionsCostFactor?: number;
  rules?: ReferencedRule[];
  minAmount?: number;
  childrenOptions?: Omit<ArmyBookOption, "option_id"> & { replaceArrays?: boolean };
  noFirstTry?: boolean;
  noArmyMult?: boolean;
  uniqueChildrenCombo?: boolean; // Used for runes
  generalHasOption?: boolean;
  neverHide?: boolean;
  category?: string;

  diffstatlines?: boolean;
  unit_id?: string;
  loses_rules?: string[];

  offstatline?: string;
  defstatline?: string;
  globstatline?: string;

  hereditary?: {
    ref: string;
    path: string;
  }[];

  magic?: ArmyBookMagic;
  boundSpells?: ArmyBookMagicSpell[];
  replaceSpells?: boolean;

  extraVp?: number;
  statline?: string;
  parsername?: string;
  alias?: string;

  maxUnitCost?: number;
  overrideInactiveNodes?: boolean;
  parent?: ArmyBookOption;

  allowHideChildren?: boolean;

  exportParams?: boolean; // Keep parenthesis stuff in the text export (used for Spell Scroll)
  rarity?: T9ARarity;
  sharedRarity?: string;
  rarityModifier?: number;
}

export interface ArmyBookUnit extends ArmyBookOption {
  name: string;
  logo?: string;
  overrideInactiveNodes?: boolean;
}

export interface ArmyBookCategory extends ArmyBookOption {
  options: ArmyBookUnit[];
  name: string;
  maxCost?: number;
  minCost?: number;
  maxPercent?: number;
  minPercent?: number;
  maxPerPoints?: {
    value: number;
    perPoints: number;
  };
  refs?: string[];
}

export interface ArmyBookForce extends ArmyBookOption {}

export interface ArmyBookArmy extends ArmyBookOption {
  options: ArmyBookCategory[];
  initiated: boolean;
  maxCost?: number;
}

export interface ArmyBookProfile extends Record<string, any> {
  name: string;
  type: string;
  basesize: string;
  height: string;
  rarity: "Regular" | "Common" | "Uncommon" | "Rare" | "Extraordinary" | "Legendary";
  global: {
    Ad: string;
    Ma: string;
    Di: string;
    Hgt: string;
    Rea?: string;
  };
  defense: {
    HP: string;
    Df: string;
    Re: string;
    Arm: string;
  };
  offense: {
    At: string;
    Of: string;
    St: string;
    AP: string;
    Ag: string;
  }[];
  offensename: string;
  unit_id: string;
  option_id: string;
}

export interface ArmyBookMagicSpellMod {
  free?: boolean;
  mandatory?: boolean;
  range?: number;
  castValue?: number | string;
  attribute?: {
    path: string;
    ref: string;
  };
  bound?: boolean;
  types?: string[];
}

export interface ArmyBookMagicSpell {
  path: string;
  ref: string;
  mods?: ArmyBookMagicSpellMod;
  hasOption?: ArmyBookCondition[];
  hasNotOption?: ArmyBookCondition[];
}

export interface ArmyBookMagic {
  amount?: number | "x";
  replaceSpells?: boolean;
  spells?: ArmyBookMagicSpell[];
  pathsLimits?: Record<string, number>;
  choices?: string[];
  mandatorySpells?: string[];
  paths?: string[];
  noChoice?: boolean;
}
export interface ArmyBookSpellCast {
  value: string | number;
  range: string | number;
  types: string[];
  duration: number;
}

export interface ArmyBookSpell {
  number: string;
  ref: string;
  name: string;
  description: string;
  fontSize?: number;
  dispNumber?: string;
  cast: ArmyBookSpellCast[];
  rep?: boolean;
  army?: string;
  free?: boolean;
  mandatory?: boolean;
  whNumber?: string;
  attribute?: ArmyBookMagicSpell;
  icon?: string;
  alt?: { icon: string; description: string; cast: Array<ArmyBookSpellCast> };
}
export interface ArmyBookPath {
  name: string;
  ref: string;
  spells: ArmyBookSpell[];
}
