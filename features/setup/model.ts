/**
 * What the Setup page reads and writes, in its own words. Nothing here names a BattleScribe
 * field: the page only talks to a SetupAdapter, and bs_adapter.ts is the one file that maps
 * these to the current format. Swap the format, rewrite that file, keep the page.
 */
import type { ColumnFormat } from "./formats";
import type { Template } from "~/features/templates/model";

export type { ColumnFormat };
export type ProfileKind = "model" | "weapon" | "spell" | "ability" | "rule" | "tag" | "summary" | "other";
/**
 * What a shared line of a type is: an item units take and pay for (a shared entry), or text
 * units link to (a shared profile). Set on the type; the kind only supplies the default.
 */
export type SharedAs = "item" | "text";
export function defaultSharedAs(kind: ProfileKind): SharedAs {
  return kind === "spell" || kind === "ability" || kind === "rule" ? "text" : "item";
}

export interface SetupCost {
  /** Set once at creation; entries refer to it, so it is not renamed afterwards. */
  id: string;
  /** Full label, "Detachment Points". */
  name: string;
  /** What sits next to a number, "DP". */
  short: string;
}
export interface SetupColumn {
  id: string;
  name: string;
  format: ColumnFormat;
}
export interface SetupProfileType {
  id: string;
  name: string;
  kind: ProfileKind;
  /** Defaults from the kind (defaultSharedAs); the paste tests leave it out. */
  sharedAs?: SharedAs;
  columns: SetupColumn[];
}
export interface SetupCategory {
  id: string;
  name: string;
}
export interface SetupFaction {
  id: string;
  name: string;
}
export interface SetupForce {
  id: string;
  name: string;
}
export interface SetupSystem {
  id: string;
  name: string;
  costs: SetupCost[];
  profileTypes: SetupProfileType[];
  categories: SetupCategory[];
  /** This system's own templates, on top of the built-in ones. */
  templates: Template[];
  factions: SetupFaction[];
  forces: SetupForce[];
}

export interface SetupAdapter {
  /** Loads the system so the rest can be called. Resolves to nothing; read() gives the state. */
  load(systemId: string): Promise<void>;
  /** A fresh snapshot. Cheap; the page calls it again after every write. */
  read(): SetupSystem;

  addCost(cost: SetupCost): Promise<void>;
  updateCost(id: string, patch: Partial<Pick<SetupCost, "name" | "short">>): Promise<void>;
  removeCost(id: string): Promise<void>;

  addProfileType(type: Omit<SetupProfileType, "id" | "columns"> & { columns: Omit<SetupColumn, "id">[] }): Promise<void>;
  renameProfileType(id: string, name: string): Promise<void>;
  setProfileKind(id: string, kind: ProfileKind): Promise<void>;
  setSharedAs(id: string, sharedAs: SharedAs): Promise<void>;
  removeProfileType(id: string): Promise<void>;
  addColumn(typeId: string, name: string, format: ColumnFormat): Promise<void>;
  renameColumn(typeId: string, columnId: string, name: string): Promise<void>;
  setColumnFormat(typeId: string, columnId: string, format: ColumnFormat): Promise<void>;
  removeColumn(typeId: string, columnId: string): Promise<void>;

  /** Categories live on the system so every faction shares them: Troops, Elites. */
  addCategory(name: string): Promise<void>;
  renameCategory(id: string, name: string): Promise<void>;
  removeCategory(id: string): Promise<void>;

  /** The whole list, replaced. Undoable like any field. */
  saveTemplates(templates: Template[]): Promise<void>;

  addFaction(name: string): Promise<SetupFaction>;
  addForce(name: string): Promise<void>;
  renameForce(id: string, name: string): Promise<void>;

  /** Writes are held in memory until this; the page shows a Save button while it returns true. */
  undo(): Promise<void>;
  redo(): Promise<void>;
  hasUnsaved(): boolean;
  save(): Promise<void>;
}
