/**
 * SetupAdapter over the BattleScribe format, through the editor store so every write is
 * undoable and marks the file unsaved like any other edit.
 *
 * Mapping, all of it:
 *   cost          -> gameSystem.costTypes[]            (defaultCostLimit -1 = unlimited)
 *   profile type  -> gameSystem.profileTypes[]         (kind: model | weapon | undefined)
 *   column        -> profileType.characteristicTypes[] (valueFormat; kind number | longText kept in step for display)
 *   faction       -> a catalogue file
 *   force         -> gameSystem.forceEntries[]
 */
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { BSICategory,
  BSICharacteristicType, BSICostType, BSIForce, BSIProfileType, BSIValueFormat } from "~/assets/shared/battlescribe/bs_types";
import type { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { uniqueId } from "~/features/ui/ids";
import { renameNode } from "./rename";
import { useEditorStore } from "~/stores/editorStore";
import type { ColumnFormat, ProfileKind, SetupAdapter, SetupColumn, SetupCost, SetupProfileType, SetupSystem } from "./model";
import { defaultSharedAs, type SharedAs } from "./model";
import type { Template } from "~/features/templates/model";

/** The display kind the rest of the app reads, derived from the format so the two never disagree. */
function kindFor(f: ColumnFormat): string | undefined {
  return f.preset === "number" ? "number" : f.preset === "long" ? "longText" : undefined;
}
function formatOf(c: BSICharacteristicType): ColumnFormat {
  if (c.valueFormat) return c.valueFormat;
  // Older data has only a kind, or nothing. Anything short and unknown is treated as free text.
  return { preset: c.kind === "number" ? "number" : c.kind === "longText" ? "long" : "text" };
}
function toBs(f: ColumnFormat): BSIValueFormat {
  const out: BSIValueFormat = { preset: f.preset };
  if (f.empty) out.empty = f.empty;
  if (f.preset === "choice") out.choices = f.choices || [];
  if (f.preset === "custom") out.pattern = f.pattern || "";
  return out;
}
const PROFILE_KINDS: ProfileKind[] = ["model", "weapon", "spell", "ability", "rule", "tag", "summary"];
const PROFILE_KIND: Record<string, ProfileKind> = Object.fromEntries(PROFILE_KINDS.map((k) => [k, k]));
const PROFILE_KIND_BS: Record<ProfileKind, string | undefined> = { ...Object.fromEntries(PROFILE_KINDS.map((k) => [k, k])), other: undefined } as Record<ProfileKind, string | undefined>;

export class BsSetupAdapter implements SetupAdapter {
  private files!: GameSystemFiles;
  private system!: Catalogue;
  private get store() {
    return useEditorStore();
  }
  /** A readable id no node in the system has. add() keeps it since it is free. */
  private id(base: string, prefix?: Parameters<typeof uniqueId>[2]) {
    return uniqueId(base, (id) => this.system.findOptionByIdGlobal(id) !== undefined, prefix);
  }

  async load(systemId: string) {
    const { system, catalogue } = await this.store.open_catalogue(systemId);
    this.files = system;
    this.system = catalogue;
  }

  read(): SetupSystem {
    const sys = this.system;
    return {
      id: sys.id,
      name: sys.name,
      costs: (sys.costTypes || []).map((o) => ({ id: o.id, name: o.name, short: o.shortName || o.name })),
      profileTypes: (sys.profileTypes || []).map(toProfileType),
      categories: (sys.categoryEntries || []).map((o) => ({ id: o.id, name: o.name })),
      templates: readTemplates(sys as unknown as { nrTemplates?: string }),
      factions: Object.values(this.files.catalogueFiles).map((o) => ({ id: o.catalogue.id, name: o.catalogue.name })),
      forces: (sys.forceEntries || []).map((o) => ({ id: o.id, name: o.name })),
    };
  }

  async addCost(cost: SetupCost) {
    // add() keeps the id when nothing else in the system has it, which is the point of asking for one.
    const data: Partial<BSICostType> = { id: cost.id, name: cost.name, shortName: cost.short, defaultCostLimit: -1, hidden: false };
    await this.store.add(data, "costTypes", this.system as unknown as EditorBase);
  }
  async updateCost(id: string, patch: Partial<Pick<SetupCost, "name" | "short">>) {
    const node = find(this.system.costTypes, id);
    if (!node) return;
    if (patch.name !== undefined) this.store.set_field(node, "name", patch.name);
    if (patch.short !== undefined) this.store.set_field(node, "shortName", patch.short);
  }
  async removeCost(id: string) {
    await this.remove(this.system.costTypes, id);
  }

  async addProfileType(type: Omit<SetupProfileType, "id" | "columns"> & { columns: Omit<SetupColumn, "id">[] }) {
    const id = this.id(type.name);
    const data: Partial<BSIProfileType> = {
      id,
      name: type.name,
      kind: PROFILE_KIND_BS[type.kind],
      characteristicTypes: type.columns.map((c) => ({ id: this.id(`${id}-${c.name}`), name: c.name, kind: kindFor(c.format), valueFormat: toBs(c.format) })),
    };
    await this.store.add(data, "profileTypes", this.system as unknown as EditorBase);
  }
  async renameProfileType(id: string, name: string) {
    this.rename(this.system.profileTypes, id, name);
  }
  async setProfileKind(id: string, kind: ProfileKind) {
    const pt = find(this.system.profileTypes, id);
    if (pt) this.store.set_field(pt, "kind", PROFILE_KIND_BS[kind]);
  }
  /** NR-only field on the profile type; BattleScribe ignores it. */
  async setSharedAs(id: string, sharedAs: SharedAs) {
    const pt = find(this.system.profileTypes, id);
    if (pt) this.store.set_field(pt, "sharedAs", sharedAs);
  }
  async removeProfileType(id: string) {
    await this.remove(this.system.profileTypes, id);
  }
  async addColumn(typeId: string, name: string, format: ColumnFormat) {
    const pt = find(this.system.profileTypes, typeId);
    if (!pt) return;
    const col: Partial<BSICharacteristicType> = { id: this.id(`${pt.id}-${name}`), name, kind: kindFor(format), valueFormat: toBs(format) };
    await this.store.add(col, "characteristicTypes", pt);
  }
  async renameColumn(typeId: string, columnId: string, name: string) {
    this.rename(find(this.system.profileTypes, typeId)?.characteristicTypes, columnId, name);
  }
  async setColumnFormat(typeId: string, columnId: string, format: ColumnFormat) {
    const col = find(find(this.system.profileTypes, typeId)?.characteristicTypes, columnId);
    if (!col) return;
    this.store.set_field(col, "valueFormat", toBs(format));
    this.store.set_field(col, "kind", kindFor(format));
  }
  async removeColumn(typeId: string, columnId: string) {
    await this.remove(find(this.system.profileTypes, typeId)?.characteristicTypes, columnId);
  }

  async addFaction(name: string) {
    const gameSystem = this.files.gameSystem!.gameSystem;
    const taken = new Set([gameSystem.id, ...Object.keys(this.files.catalogueFiles)]);
    const created = await this.store.create_catalogue(this.files, {
      catalogue: {
        id: uniqueId(name, (id) => taken.has(id), "faction"),
        name,
        library: false,
        gameSystemId: gameSystem.id,
        gameSystemRevision: gameSystem.revision,
        revision: 1,
        battleScribeVersion: "2.03",
      },
    });
    return { id: created.catalogue.id, name: created.catalogue.name };
  }

  /** NR-only: the list as JSON in one attribute on the game system. BattleScribe ignores it. */
  async saveTemplates(templates: Template[]) {
    this.store.set_field(this.system as unknown as EditorBase, "nrTemplates", JSON.stringify(templates.map((t) => ({ ...t, custom: true }))));
  }
  async addCategory(name: string) {
    const data: Partial<BSICategory> = { id: this.id(name), name, hidden: false } as Partial<BSICategory>;
    await this.store.add(data, "categoryEntries", this.system as unknown as EditorBase);
  }
  async renameCategory(id: string, name: string) {
    this.rename(this.system.categoryEntries, id, name);
  }
  async removeCategory(id: string) {
    await this.remove(this.system.categoryEntries, id);
  }

  async addForce(name: string) {
    const force: Partial<BSIForce> = { id: this.id(name, "force"), name, hidden: false, categoryLinks: [] };
    await this.store.add(force, "forceEntries", this.system as unknown as EditorBase);
  }
  async renameForce(id: string, name: string) {
    this.rename(this.system.forceEntries, id, name);
  }

  async undo() {
    await this.store.undo();
  }
  async redo() {
    await this.store.redo();
  }
  hasUnsaved() {
    return this.files.getAllLoadedCatalogues().some((c) => this.store.get_catalogue_state(c)?.unsaved);
  }
  async save() {
    const increment = await this.store.prompt_revision(this.files);
    for (const cat of this.files.getAllLoadedCatalogues()) {
      if (this.store.get_catalogue_state(cat)?.unsaved) await this.store.save_catalogue(this.files, cat, increment);
    }
  }

  private rename(list: { id: string; name: string }[] | undefined, id: string, name: string) {
    const node = find(list, id);
    if (node) renameNode(this.store, node, name);
  }
  private async remove(list: { id: string }[] | undefined, id: string) {
    const node = find(list, id);
    if (node) await this.store.remove(node as unknown as EditorBase);
  }
}

export function readTemplates(system: { nrTemplates?: string }): Template[] {
  try {
    const list = system.nrTemplates ? (JSON.parse(system.nrTemplates) as Template[]) : [];
    return Array.isArray(list) ? list.map((t) => ({ ...t, custom: true })) : [];
  } catch {
    return [];
  }
}

function find<T extends { id: string }>(list: T[] | undefined, id: string): (T & EditorBase) | undefined {
  return list?.find((o) => o.id === id) as (T & EditorBase) | undefined;
}

export function toProfileType(pt: BSIProfileType): SetupProfileType {
  return {
    id: (pt as { id: string }).id,
    name: pt.name,
    kind: PROFILE_KIND[pt.kind || ""] || "other",
    sharedAs: (pt as { sharedAs?: SharedAs }).sharedAs ?? defaultSharedAs(PROFILE_KIND[pt.kind || ""] || "other"),
    columns: (pt.characteristicTypes || []).map((c) => ({
      id: (c as { id: string }).id,
      name: c.name,
      format: formatOf(c),
    })),
  };
}
