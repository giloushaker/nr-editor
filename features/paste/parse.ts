/**
 * The paste reader. Tries every profile type against the text and keeps the best fit.
 *
 * Three layouts are read:
 *   rows     one stat line per text line, "Boltgun 24" 4 5 Rapid Fire", usually under a header line
 *   columns  every value of one column, then the next (what screen OCR makes of a table):
 *            "Weapon / Boltgun / Bolt pistol / Range / 24" / 12" / S / 4 / 4 / ..."
 *   blocks   a name on its own line, then its text over the following lines, for a type whose
 *            only column is text: "Power armour / Made from thick ceramite plates, ... / ..."
 * Header words are matched loosely because OCR drops letters ("Wea on", "Ran e").
 */
import { matchesFormat, type ColumnFormat } from "../setup/formats";
import type { SetupColumn, SetupProfileType } from "../setup/model";
import type { PasteFailure, PasteResult, PasteSuccess, PastedRow } from "./model";
import { unwrap } from "./text";

// ---- text helpers ------------------------------------------------------------------------

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** How alike two short words are, 0..1. Letters OCR dropped or swapped still score high. */
function similarity(a: string, b: string): number {
  a = fold(a);
  b = fold(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}
/** "Wea on" is Weapon, "Ran e" is Range, "s" is S. Short names must match exactly. */
function isHeaderWord(word: string, name: string): boolean {
  const w = fold(word);
  const n = fold(name);
  if (!w) return false;
  if (n.length <= 2 || w.length <= 2) return w === n;
  return similarity(w, n) >= 0.6;
}
/** Names a book's table gives the name column, none of which is a stat. */
const NAME_HEADERS = ["name", "weapon", "weapons", "unit", "model", "profile", "wargear", "item"];

// ---- glyph fixes -------------------------------------------------------------------------

/**
 * OCR's usual swaps, fixed only where the column's format says the value must be a number, a roll,
 * a dice string or a distance. Free text is left alone.
 */
export function fixGlyphs(value: string, f: ColumnFormat): { value: string; guessed: boolean } {
  const before = value.trim();
  let v = before;
  if (f.preset === "number" || f.preset === "roll" || f.preset === "dice" || f.preset === "inches") {
    v = v.replace(/[Il|]/g, "1").replace(/O/g, "0").replace(/S(?=\d|$)/g, "5");
  }
  if (f.preset === "inches") {
    v = v.replace(/\s*(v'|''|”|“|"|`)\s*$/g, '"');
    // "240" for 24": a trailing 0 with no mark on a distance column is the mark misread.
    if (/^\d{3,}$/.test(v) && v.endsWith("0")) v = v.slice(0, -1) + '"';
    else if (/^\d+$/.test(v)) v = v + '"';
  }
  if (f.preset === "roll" && /^\d$/.test(v)) v = v + "+";
  // A fix that does not make the value fit was no fix ("Template" is not "Temp1ate"): keep the original.
  if (v !== before && !matchesFormat(f, v)) return { value: before, guessed: false };
  return { value: v, guessed: v !== before };
}

// ---- layout: rows -------------------------------------------------------------------------

interface Split {
  name: string;
  cells: string[];
}

/** A line with tabs or runs of spaces is already in cells. Otherwise cells are read by format. */
function splitRow(line: string, cols: SetupColumn[]): Split | null {
  const hard = line.split(/\t+| {2,}/).map((s) => s.trim()).filter(Boolean);
  if (hard.length >= 2) return { name: hard[0], cells: hard.slice(1) };
  if (hard.length === 1 && /\t/.test(line)) return { name: hard[0], cells: [] };
  // Single spaces only. Every place the name could end is tried; a split counts when each
  // fixed-shape cell it produces fits. Among those, one that fills every column and whose
  // trailing free text starts with a letter wins ("Storm bolter | 24" 4 5 | Assault 2", not
  // "Storm | bolter 24" 4 | 5 Assault 2"); failing that, the first that fills every column; failing
  // that, the first with at least two cells. "Grenade launcher" alone splits nowhere.
  const tokens = line.trim().split(/\s+/);
  const shaped = (c: SetupColumn) => c.format.preset !== "text" && c.format.preset !== "long";
  const anyShaped = cols.some(shaped);
  const statLike = (v: string) => /^[\d–-]/.test(v);
  const candidates: { split: Split; full: boolean; tidy: boolean; stat: number }[] = [];
  // A line with exactly one token per column has no name: it is pasted onto the thing it describes.
  for (let start = tokens.length === cols.length ? 0 : 1; start < tokens.length; start++) {
    const cells: string[] = [];
    let t = start;
    for (let c = 0; c < cols.length && t < tokens.length; c++) {
      const last = c === cols.length - 1;
      if (!shaped(cols[c]) && last) {
        cells.push(tokens.slice(t).join(" "));
        t = tokens.length;
      } else cells.push(tokens[t++]);
    }
    const pairs = cols.slice(0, cells.length).map((c, i) => [c, cells[i]] as const);
    const shapedCells = pairs.filter(([c]) => shaped(c));
    if (cells.length < 2 && start > 0) continue;
    const full = cells.length === cols.length;
    // Columns with no format at all (an older type: M T SV W LD OC as plain text) accept anything,
    // so only a split that fills every column counts, and the one with the most stat-looking cells wins.
    if (!anyShaped) {
      if (!full) continue;
    } else if (!shapedCells.every(([c, v]) => matchesFormat(c.format, fixGlyphs(v, c.format).value))) continue;
    const lastCell = pairs[pairs.length - 1];
    const tidy = full && (shaped(lastCell[0]) || /^[A-Za-z-]/.test(lastCell[1]));
    candidates.push({ split: { name: tokens.slice(0, start).join(" "), cells }, full, tidy, stat: cells.filter(statLike).length });
  }
  if (!anyShaped) candidates.sort((a, b) => b.stat - a.stat);
  const pick = candidates.find((c) => c.tidy) ?? candidates.find((c) => c.full) ?? candidates[0];
  return pick?.split ?? null;
}

// ---- the reader --------------------------------------------------------------------------

interface Attempt {
  type: SetupProfileType;
  layout: "rows" | "columns" | "blocks";
  rows: PastedRow[];
  unread: string[];
  headerHits: number;
  cellsOk: number;
  cellsAll: number;
}

function readRows(lines: string[], type: SetupProfileType): Attempt {
  const cols = type.columns;
  const rows: PastedRow[] = [];
  const unread: string[] = [];
  let headerHits = 0;
  const isSub = (l: string | undefined) => !!l && /^[-–•*]\s*/.test(l);
  for (const [i, raw] of lines.entries()) {
    const words = raw.split(/\t+|\s{2,}|\s+/).filter(Boolean);
    const hits = words.filter((w) => cols.some((c) => isHeaderWord(w, c.name)) || NAME_HEADERS.some((h) => isHeaderWord(w, h))).length;
    if (hits >= Math.max(2, Math.ceil(words.length / 2))) {
      headerHits += hits;
      continue;
    }
    const sub = /^[-–•*]\s*/.test(raw);
    const line = raw.replace(/^[-–•*]\s*/, "");
    const split = splitRow(line, cols);
    if (!split) {
      // A name with no stats, right before dashed lines, is a weapon whose stat lines are those
      // sub-lines: "Grenade launcher" then "- Frag grenade", "- Krak grenade".
      if (!sub && isSub(lines[i + 1])) rows.push({ name: line, values: {}, flags: [], sub: false });
      else unread.push(raw);
      continue;
    }
    rows.push(toRow(split.name, split.cells, cols, sub));
  }
  return score({ type, layout: "rows", rows, unread, headerHits });
}

function readColumns(lines: string[], type: SetupProfileType): Attempt {
  const cols = type.columns;
  // Where each header word sits: the block after it is that column's values.
  const marks: { at: number; col: SetupColumn | "name" }[] = [];
  lines.forEach((l, i) => {
    if (l.split(/\s+/).length > 2) return;
    if (NAME_HEADERS.some((h) => isHeaderWord(l, h))) marks.push({ at: i, col: "name" });
    else {
      const col = cols.find((c) => isHeaderWord(l, c.name));
      if (col) marks.push({ at: i, col });
    }
  });
  // A text column right after a number column often loses its header to OCR: the tail block after
  // the last marked column is given to the first unmarked column.
  const blocks = marks.map((m, i) => ({ col: m.col, values: lines.slice(m.at + 1, marks[i + 1]?.at ?? lines.length) }));
  const nameBlock = blocks.find((b) => b.col === "name") ?? (marks.length && marks[0].at > 0 ? { col: "name" as const, values: lines.slice(0, marks[0].at) } : undefined);
  if (!nameBlock) return score({ type, layout: "columns", rows: [], unread: lines, headerHits: marks.length });
  const names = nameBlock.values;
  const byCol = new Map<string, string[]>();
  for (const b of blocks) if (b.col !== "name") byCol.set(b.col.id, b.values);
  // The tail of the last marked block may hold the unheaded text column: split it where its values stop fitting.
  const missing = cols.filter((c) => !byCol.has(c.id));
  if (missing.length === 1 && blocks.length) {
    const lastCol = blocks[blocks.length - 1].col;
    if (lastCol !== "name") {
      const vals = byCol.get(lastCol.id)!;
      const cut = vals.findIndex((v) => !matchesFormat(lastCol.format, fixGlyphs(v, lastCol.format).value));
      if (cut > 0) {
        byCol.set(lastCol.id, vals.slice(0, cut));
        byCol.set(missing[0].id, vals.slice(cut));
      }
    }
  }
  const rows: PastedRow[] = names.map((n) => {
    const sub = /^[-–•*]\s*/.test(n);
    return { name: n.replace(/^[-–•*]\s*/, ""), values: {}, flags: [], sub };
  });
  const unread: string[] = [];
  for (const col of cols) {
    const vals = byCol.get(col.id) ?? [];
    // Multi-line cells ("Ordnance 1," / "One use only") are joined back when the block runs long.
    const fitted = vals.length > rows.length && (col.format.preset === "text" || col.format.preset === "long") ? joinContinuations(vals, rows.length) : vals;
    rows.forEach((r, i) => {
      if (i >= fitted.length) {
        r.flags.push({ columnId: col.id, reason: "missing" });
        return;
      }
      const g = fixGlyphs(fitted[i], col.format);
      r.values[col.id] = g.value;
      if (!matchesFormat(col.format, g.value)) r.flags.push({ columnId: col.id, reason: "format" });
      else if (g.guessed) r.flags.push({ columnId: col.id, reason: "guessed" });
    });
    if (fitted.length > rows.length) unread.push(...fitted.slice(rows.length));
  }
  return score({ type, layout: "columns", rows, unread, headerHits: marks.length });
}

// ---- layout: blocks -----------------------------------------------------------------------

/**
 * Name lines and the text under them, for a type with one text column. A name is a short line
 * with no sentence punctuation at its end, at the start or right after a line that ends one
 * (a wrapped line ends mid-sentence, so it is never taken for a name).
 */
function readBlocks(lines: string[], type: SetupProfileType): Attempt {
  const col = type.columns[0];
  const textOnly = type.columns.length === 1 && (col.format.preset === "long" || col.format.preset === "text");
  if (!textOnly) return score({ type, layout: "blocks", rows: [], unread: lines, headerHits: 0 });
  const endsSentence = (l: string) => /[.!?:;)"”']$/.test(l);
  const isName = (l: string, prev?: string) => l.length <= 48 && l.split(/\s+/).length <= 6 && !/[.,;:]$/.test(l) && (!prev || endsSentence(prev));
  const rows: PastedRow[] = [];
  const unread: string[] = [];
  let body: string[] = [];
  const close = () => {
    if (!rows.length) return;
    const text = unwrap(body.join("\n"));
    rows[rows.length - 1].values[col.id] = text;
    if (!text) rows[rows.length - 1].flags.push({ columnId: col.id, reason: "missing" });
    body = [];
  };
  for (const [i, line] of lines.entries()) {
    if (isName(line, lines[i - 1])) {
      close();
      rows.push({ name: line, values: {}, flags: [], sub: false });
    } else if (rows.length) body.push(line);
    else unread.push(line);
  }
  close();
  // The name-then-text shape is this layout's header: full marks when every name got its text.
  const headerHits = rows.length && rows.every((r) => r.values[col.id]) ? type.columns.length : 0;
  return score({ type, layout: "blocks", rows, unread, headerHits });
}

/** "Ordnance 1," then "One use only" is one cell: a line ending in a comma continues on the next. */
function joinContinuations(vals: string[], want: number): string[] {
  const out: string[] = [];
  for (const v of vals) {
    if (out.length && /,$/.test(out[out.length - 1])) out[out.length - 1] += " " + v;
    else out.push(v);
    if (out.length > want) break;
  }
  return out;
}

function toRow(name: string, cells: string[], cols: SetupColumn[], sub: boolean): PastedRow {
  const row: PastedRow = { name: name.trim(), values: {}, flags: [], sub };
  // A name with no cells at all is a group line; its stat lines come as sub-lines. Nothing to flag.
  if (!cells.length) return row;
  cols.forEach((col, i) => {
    if (i >= cells.length) {
      row.flags.push({ columnId: col.id, reason: "missing" });
      return;
    }
    const g = fixGlyphs(cells[i], col.format);
    row.values[col.id] = g.value;
    if (!matchesFormat(col.format, g.value)) row.flags.push({ columnId: col.id, reason: "format" });
    else if (g.guessed) row.flags.push({ columnId: col.id, reason: "guessed" });
  });
  return row;
}

function score(a: Omit<Attempt, "cellsOk" | "cellsAll">): Attempt {
  let ok = 0;
  let all = 0;
  for (const r of a.rows) {
    if (!Object.keys(r.values).length) continue; // a group line has no cells to score
    for (const col of a.type.columns) {
      all++;
      if (col.id in r.values && !r.flags.some((f) => f.columnId === col.id && f.reason !== "guessed")) ok++;
    }
  }
  return { ...a, cellsOk: ok, cellsAll: all };
}

function fit(a: Attempt): number {
  if (!a.rows.length || !a.cellsAll) return 0;
  const cells = a.cellsOk / a.cellsAll;
  const header = Math.min(1, a.headerHits / Math.max(1, a.type.columns.length));
  const read = a.rows.length / (a.rows.length + a.unread.length);
  // A name that starts with a digit is a stat value taken for a name: that read is the wrong shape.
  const numbered = a.rows.filter((r) => /^\d/.test(r.name)).length / a.rows.length;
  return cells * 0.6 + header * 0.25 + read * 0.15 - numbered * 0.1;
}

/**
 * Reads `text` as stat lines of one of `types`. Never throws; a miss says why. `prefer` is the
 * type whose section the author pasted into: it wins a near tie (two weapon types with the same
 * columns), a clearly better fit still wins over it.
 */
export function parsePaste(text: string, types: SetupProfileType[], prefer?: string, force?: string): PasteResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return fail(["Nothing was pasted."], ["Copy the table from the book first."]);
  const usable = types.filter((t) => t.columns.length && (!force || t.id === force));
  if (!usable.length) return fail(["No profile type has any columns yet."], ["Add a profile type with its columns in Setup, then paste again."]);

  const attempts = usable.flatMap((t) => [readRows(lines, t), readColumns(lines, t), readBlocks(lines, t)]);
  let best = attempts.reduce((b, a) => (fit(a) > fit(b) ? a : b));
  const preferred = attempts.filter((a) => a.type.id === prefer).reduce<Attempt | null>((b, a) => (!b || fit(a) > fit(b) ? a : b), null);
  if (preferred && fit(preferred) >= fit(best) - 0.05) best = preferred;
  const f = fit(best);
  if ((f < 0.45 && !force) || !best.rows.length) {
    const reasons = usable.map((t) => {
      const r = attempts.find((a) => a.type === t && a.layout === "rows")!;
      const c = attempts.find((a) => a.type === t && a.layout === "columns")!;
      const b = attempts.find((a) => a.type === t && a.layout === "blocks")!;
      const pct = (a: Attempt) => (a.cellsAll ? Math.round((100 * a.cellsOk) / a.cellsAll) : 0);
      return `${t.name}: ${r.headerHits || c.headerHits ? "header found" : "no header line"}, ${Math.max(pct(r), pct(c), pct(b))}% of cells fit its columns (${t.columns.map((x) => x.name).join(" ")}).`;
    });
    return fail(reasons, [
      "Copy one table at a time, header row included, so the column names are in the text.",
      "If the text came from screen OCR one column at a time, that is fine, but every column needs its header word above it.",
      "If the stat line has columns the profile type does not, add them to the type first.",
      "Scanned PDF? Run OCR in row mode (tesseract --psm 6) so each weapon stays on one line.",
    ]);
  }
  const out: PasteSuccess = { ok: true, typeId: best.type.id, layout: best.layout, rows: best.rows, unread: best.unread, confidence: Math.round(f * 100) / 100 };
  return out;
}

function fail(reasons: string[], hints: string[]): PasteFailure {
  return { ok: false, reasons, hints };
}

export const _test = { similarity, isHeaderWord, splitRow };
