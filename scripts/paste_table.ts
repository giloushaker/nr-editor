/**
 * Turns tabular text (pasted from a PDF, spreadsheet, or web table) into profile nodes,
 * without anyone having to write a script for their system.
 *
 * The mapping the TOW paste-*.js scripts hardcode -- column name to characteristic typeId --
 * already exists in the data as profileType.characteristicTypes, so it is inferred instead.
 */
import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { BSIProfileType } from "~/assets/shared/battlescribe/bs_types";

export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

/** Column names differ in case/spacing/punctuation between sources; compare on this. */
export function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Splits on tabs when present (spreadsheets, most web tables), otherwise on runs of 2+ spaces
 * (PDF copy). Single spaces are never separators -- "Special Rules" is one column.
 */
function splitRow(line: string): string[] {
  const parts = line.includes("\t") ? line.split("\t") : line.split(/\s{2,}/);
  return parts.map((o) => o.trim());
}

export function parseTable(text: string): ParsedTable | undefined {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((o) => o.trim())
    .filter((o) => o);
  if (lines.length < 2) return undefined;

  const rows = lines.map(splitRow);
  const width = rows[0].length;
  if (width < 2) return undefined;

  // Ragged output means the separator guess was wrong; better to decline than to import garbage.
  const body = rows.slice(1).filter((r) => r.length === width);
  if (!body.length) return undefined;

  return { headers: rows[0], rows: body };
}

export interface ProfileTypeMatch {
  type: BSIProfileType;
  /** Index into headers -> characteristicType id. Absent entries are unmapped columns. */
  columns: Array<{ index: number; typeId: string; name: string }>;
  /** Column holding the profile's name, or -1 if every column mapped to a characteristic. */
  nameColumn: number;
  score: number;
}

/**
 * Picks the profile type whose characteristic names best cover the header row.
 * A leading column that matches nothing is the profile name -- that is how the real
 * tables are shaped (an unlabeled name column, then R / S / AP / Special Rules).
 */
export function matchProfileType(headers: string[], profileTypes: BSIProfileType[]): ProfileTypeMatch | undefined {
  let best: ProfileTypeMatch | undefined;

  for (const type of profileTypes) {
    const characteristics = type.characteristicTypes || [];
    if (!characteristics.length) continue;

    const byName = new Map(characteristics.map((c) => [normalizeHeader(c.name), c]));
    const columns = [] as ProfileTypeMatch["columns"];
    for (let i = 0; i < headers.length; i++) {
      const found = byName.get(normalizeHeader(headers[i]));
      if (found) columns.push({ index: i, typeId: found.id, name: found.name });
    }
    if (!columns.length) continue;

    const mapped = new Set(columns.map((c) => c.index));
    const nameColumn = headers.findIndex((_, i) => !mapped.has(i));

    // Favour covering this type's characteristics, then covering the pasted columns, so a
    // type with 20 characteristics doesn't beat the right one just by being large.
    const score = columns.length / characteristics.length + columns.length / headers.length;
    if (!best || score > best.score) best = { type, columns, nameColumn, score };
  }

  // Half the type's characteristics present is the difference between "this is a weapon
  // table" and "two column names happened to collide".
  if (best && best.columns.length / (best.type.characteristicTypes?.length || 1) < 0.5) return undefined;
  return best;
}

export interface ProfileNode {
  parentKey: "profiles";
  name: string;
  typeId: string;
  typeName: string;
  characteristics: Array<{ name: string; typeId: string; $text: string }>;
}

export function tableToProfiles(table: ParsedTable, match: ProfileTypeMatch): ProfileNode[] {
  return table.rows.map((row, i) => ({
    parentKey: "profiles" as const,
    name: match.nameColumn >= 0 ? row[match.nameColumn] : `${match.type.name} ${i + 1}`,
    typeId: match.type.id,
    typeName: match.type.name,
    characteristics: match.columns.map((c) => ({
      name: c.name,
      typeId: c.typeId,
      $text: row[c.index] ?? "",
    })),
  }));
}

/**
 * Whole path: pasted text -> profile nodes ready for editorStore.add().
 * Returns undefined when the text isn't a table or no profile type fits, so the caller
 * can fall through to the existing paste behaviour.
 */
export function pasteTableAsProfiles(text: string, catalogue: Catalogue): ProfileNode[] | undefined {
  const table = parseTable(text);
  if (!table) return undefined;
  const types = [...catalogue.iterateProfileTypes()] as unknown as BSIProfileType[];
  const match = matchProfileType(table.headers, types);
  if (!match) return undefined;
  return tableToProfiles(table, match);
}
