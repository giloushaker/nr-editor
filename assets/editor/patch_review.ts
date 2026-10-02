// Previews run the real patchJson on a tagged copy of each target, so the review shows what New Recruit does at load.
import { toRaw } from "vue";
import { patchJson, shouldPatch, type PatchCondition, type PatchIndex, type PatchReport } from "~/assets/shared/battlescribe/bs_helpers";
import { entryToJson } from "~/assets/shared/battlescribe/bs_main";
import { mergePatches } from "./patch_files";

export type Json = Record<string, unknown>;

/** Keys of an entry that are operators or notes rather than values to assign. */
const OPERATORS = ["$expect", "$patchConditions", "$move", "$patchPush", "$patchRemove", "$patchUpdate"];
const META = new Set([...OPERATORS, "$note"]);

/** Where decisions are kept, beside the patch; deliberately not matched by PATCH_FILE. */
export const REVIEW_FILE = "patch-review.json";

export interface PatchEntryInfo {
  /** `field=value`, the key patchJson reports issues under. */
  key: string;
  field: string;
  value: string;
  entry: Json;
  note?: string;
  /** Operator kinds, plus "set" when the entry assigns plain keys. */
  ops: string[];
  /** Patch files the entry comes from, several when mergePatches combined it. */
  files: string[];
  fingerprint: string;
}

export interface PatchChange {
  kind: "set" | "add" | "remove";
  /** The live node the change is made on. */
  owner: Json;
  key: string;
  before?: unknown;
  /** New value for a set, the JSON element for an add. */
  after?: unknown;
  /** The live element a remove takes out. */
  element?: Json;
  /** An add whose element the live array already holds, typically because it was approved before. */
  present?: boolean;
}

export type TargetStatus = "applies" | "stale" | "in-data";

export interface TargetPreview {
  node: Json;
  before: Json;
  after: Json;
  changes: PatchChange[];
  /** Reasons patchJson gave for not doing part of the entry, minus the ones already satisfied. */
  issues: string[];
  status: TargetStatus;
}

export type EntryStatus = TargetStatus | "no-match";

export const STATUS_LABELS: Record<EntryStatus, string> = {
  applies: "applies",
  stale: "stale",
  "in-data": "already in data",
  "no-match": "no match",
};

export function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** Every key of `wanted` holds the same value in `found`, recursively; `found` may carry more (a generated id). */
export function subsetEqual(wanted: unknown, found: unknown): boolean {
  if (Array.isArray(wanted)) {
    return Array.isArray(found) && wanted.length === found.length && wanted.every((w, i) => subsetEqual(w, found[i]));
  }
  if (isRecord(wanted)) {
    return isRecord(found) && Object.entries(wanted).every(([k, v]) => subsetEqual(v, found[k]));
  }
  return sameValue(wanted, found);
}

function asList<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

/** Short stable hash of an entry, so a decision can tell when the entry it was made on changed. */
export function fingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

export function describeEntry(entry: Json): string[] {
  const ops = OPERATORS.filter((op) => op in entry);
  if (Object.keys(entry).some((k) => !META.has(k))) ops.unshift("set");
  return ops;
}

/** Merges the patch files the way New Recruit does and lists one row per entry. */
export function listEntries(parts: Array<{ name: string; patch: PatchIndex }>): { merged: PatchIndex; entries: PatchEntryInfo[] } {
  const merged = mergePatches(parts);
  const files = new Map<string, string[]>();
  for (const { name, patch } of parts) {
    for (const [field, values] of Object.entries(patch)) {
      for (const value of Object.keys(values)) {
        const key = `${field}=${value}`;
        files.set(key, [...(files.get(key) ?? []), name]);
      }
    }
  }
  const entries: PatchEntryInfo[] = [];
  for (const [field, values] of Object.entries(merged)) {
    for (const [value, entry] of Object.entries(values as Record<string, Json>)) {
      const key = `${field}=${value}`;
      entries.push({
        key,
        field,
        value,
        entry,
        note: typeof entry.$note === "string" ? entry.$note : undefined,
        ops: describeEntry(entry),
        files: files.get(key) ?? [],
        fingerprint: fingerprint(entry),
      });
    }
  }
  return { merged, entries };
}

/** The patch reduced to one entry; the field's other values stay as no-ops so `$any` still skips them. */
export function isolate(patch: PatchIndex, field: string, value: string): PatchIndex {
  const others = Object.fromEntries(Object.keys(patch[field] ?? {}).map((k) => [k, {}]));
  return { [field]: { ...others, [value]: patch[field][value] } };
}

/** Which entry of `values` patchJson would apply to `node`, if any. */
function matchedValue(node: Json, field: string, values: Record<string, Json>): string | undefined {
  const current = node[field];
  const direct = String(current);
  const own = Object.prototype.hasOwnProperty.call(values, direct) && values[direct];
  const value = own ? direct : current !== undefined && values.$any ? "$any" : undefined;
  if (!value) return undefined;
  const conditions = values[value].$patchConditions as PatchCondition[] | undefined;
  return !conditions || shouldPatch(node, conditions) ? value : undefined;
}

/** The live nodes each entry applies to; a match nested in another match of the same entry is covered by the outer one. */
export function findTargets(forEachNode: (cb: (node: Json) => void) => void, patch: PatchIndex): Map<string, Json[]> {
  const found = new Map<string, Json[]>();
  const fields = Object.entries(patch);
  forEachNode((node) => {
    for (const [field, values] of fields) {
      const value = matchedValue(node, field, values as Record<string, Json>);
      if (value === undefined) continue;
      const key = `${field}=${value}`;
      const list = found.get(key);
      if (list) list.push(node);
      else found.set(key, [node]);
    }
  });
  for (const [key, nodes] of found) {
    const set = new Set(nodes.map((n) => toRaw(n)));
    found.set(
      key,
      nodes.filter((n) => {
        for (let p = n.parent as Json | undefined; p; p = p.parent as Json | undefined) if (set.has(toRaw(p))) return false;
        return true;
      }),
    );
  }
  return found;
}

/** The node as it would be written to its file, without the editor's back-references. */
export function plainCopy(node: object): Json {
  return JSON.parse(entryToJson(node as Json)) as Json;
}

/** Records which live object each object of the copy came from. */
function tag(copy: unknown, live: unknown, map: Map<Json, Json>) {
  if (Array.isArray(copy)) {
    if (Array.isArray(live)) copy.forEach((el, i) => tag(el, live[i], map));
    return;
  }
  if (!isRecord(copy) || !isRecord(live)) return;
  map.set(copy, live);
  for (const key of Object.keys(copy)) tag(copy[key], live[key], map);
}

function identity(node: Json): string | undefined {
  if (typeof node.id === "string") return `id:${node.id}`;
  if (typeof node.typeId === "string") return `typeId:${node.typeId}`;
  return undefined;
}

/** Turns the patched copy back into edits on the live node; untagged objects are new, missing ones removed. */
function diff(after: Json, live: Json, map: Map<Json, Json>, changes: PatchChange[]) {
  for (const key of Object.keys(after)) {
    const a = after[key];
    const l = live[key];
    if (Array.isArray(a) && (l === undefined || Array.isArray(l)) && a.every(isRecord)) {
      const liveArr = (l ?? []) as Json[];
      const rawLive = liveArr.map((el) => toRaw(el));
      const kept = new Set<Json>();
      const pairs = new Map<Json, Json>();
      for (const el of a as Json[]) {
        const source = map.get(el);
        const raw = source && toRaw(source);
        if (raw && rawLive.includes(raw) && !kept.has(raw)) {
          kept.add(raw);
          pairs.set(el, source);
        }
      }
      // A wholesale assigned array (`costs: [...]`) pairs by id/typeId, so it reads as the values that moved.
      for (const el of a as Json[]) {
        const id = identity(el);
        const i = id ? liveArr.findIndex((existing, j) => !kept.has(rawLive[j]) && identity(existing) === id) : -1;
        if (pairs.has(el) || i < 0) continue;
        kept.add(rawLive[i]);
        pairs.set(el, liveArr[i]);
      }
      for (const el of a as Json[]) {
        const source = pairs.get(el);
        if (source) {
          diff(el, source, map, changes);
          // An untagged element replaces the old one outright, so keys it lacks go away as they do in New Recruit.
          if (!map.has(el)) for (const gone of Object.keys(plainCopy(source)).filter((k) => !(k in el))) changes.push({ kind: "set", owner: source, key: gone, before: source[gone], after: undefined });
        } else changes.push({ kind: "add", owner: live, key, after: el, present: liveArr.some((existing) => subsetEqual(el, plainCopy(existing))) });
      }
      liveArr.forEach((el, i) => {
        if (!kept.has(rawLive[i])) changes.push({ kind: "remove", owner: live, key, element: el });
      });
    } else if (isRecord(a) && map.get(a) === l) {
      diff(a, l as Json, map, changes);
    } else if (!sameValue(a, isRecord(l) || Array.isArray(l) ? JSON.parse(entryToJson(l as Json)) : l)) {
      changes.push({ kind: "set", owner: live, key, before: l, after: a });
    }
  }
}

// Same walk as patchJson's arraysAt, for checking whether a failed update already holds its values.
function arraysAt(obj: Json, path: string): Json[][] {
  let holders: unknown[] = [obj];
  const keys = path.split(".");
  const found: Json[][] = [];
  keys.forEach((key, i) => {
    const next: unknown[] = [];
    for (const holder of holders) {
      if (!isRecord(holder)) continue;
      const value = holder[key];
      if (i === keys.length - 1) {
        if (Array.isArray(value)) found.push(value as Json[]);
      } else if (Array.isArray(value)) next.push(...value);
      else if (isRecord(value)) next.push(value);
    }
    holders = next;
  });
  return found;
}

/** Whether a reported issue only means the entry was already applied (a removal counts once the author approved it). */
function satisfied(reason: string, entry: Json, before: Json, approved: boolean): boolean {
  if (reason.startsWith("expected ")) {
    const assigned = Object.keys(entry).filter((k) => !META.has(k));
    return assigned.length > 0 && assigned.every((k) => sameValue(before[k], entry[k]));
  }
  const update = /^\$patchUpdate (\S+): nothing matches (.*)$/.exec(reason);
  if (update) {
    const updates = asList((entry.$patchUpdate as Record<string, Json | Json[]>)[update[1]]);
    return updates.some(({ $match, ...values }) => {
      const matched = JSON.stringify($match) === update[2];
      return matched && arraysAt(before, update[1]).some((arr) => arr.some((el) => subsetEqual(values, el)));
    });
  }
  return approved && reason.startsWith("$patchRemove ");
}

/** What the entry does to one target: patchJson on a copy, diffed back onto the live node. */
export function previewTarget(node: Json, patch: PatchIndex, info: PatchEntryInfo, approved = false): TargetPreview {
  const before = plainCopy(node);
  const after = plainCopy(node);
  const map = new Map<Json, Json>();
  tag(after, node, map);
  const report: PatchReport = { matched: new Set(), issues: [] };
  patchJson(after, isolate(patch, info.field, info.value), report);
  const changes: PatchChange[] = [];
  diff(after, node, map, changes);
  const issues = report.issues.filter((i) => i.entry === info.key && !satisfied(i.reason, info.entry, before, approved)).map((i) => i.reason);
  const pending = changes.filter((c) => !c.present);
  const status: TargetStatus = issues.length ? "stale" : pending.length ? "applies" : "in-data";
  return { node, before, after, changes, issues, status };
}

/** The entry's overall status: the most actionable of its targets'. */
export function entryStatus(targets: TargetPreview[]): EntryStatus {
  if (!targets.length) return "no-match";
  if (targets.some((t) => t.status === "stale")) return "stale";
  if (targets.some((t) => t.status === "applies")) return "applies";
  return "in-data";
}

/** One line of the review list: an entry and what it does to each of its targets. */
export interface ReviewRow {
  info: PatchEntryInfo;
  targets: TargetPreview[];
  status: EntryStatus;
  /** File of the first target, the list's first grouping. */
  file: string;
  /** Top-level entry holding the first target, the second grouping. */
  group: string;
}

/** The subset of the editor store the review applies changes through. */
export interface EditPath<N> {
  undoStackPos: number;
  set_field(node: N, key: string, value: unknown): boolean;
  add(data: Json, key: string, parent: N): Promise<unknown>;
  remove(node: N): Promise<unknown>;
  collapse_undo(from: number, type?: string): void;
  end_field_edit(): void;
}

/** Replays a preview through the store as one undo entry; present adds are skipped so approving twice never duplicates. */
export async function applyChanges<N>(store: EditPath<N>, changes: PatchChange[]): Promise<number> {
  const from = store.undoStackPos;
  let applied = 0;
  store.end_field_edit();
  for (const c of changes) {
    if (c.kind === "set" && store.set_field(c.owner as unknown as N, c.key, c.after)) applied++;
  }
  for (const c of changes) {
    if (c.kind !== "remove" || !c.element) continue;
    await store.remove(c.element as unknown as N);
    applied++;
  }
  for (const c of changes) {
    if (c.kind !== "add" || c.present) continue;
    await store.add(JSON.parse(JSON.stringify(c.after)) as Json, c.key, c.owner as unknown as N);
    applied++;
  }
  store.end_field_edit();
  store.collapse_undo(from, "patch");
  return applied;
}

export interface Segment {
  text: string;
  kind: "same" | "add" | "del";
}

/** Longest-common-subsequence diff of two token lists, merged into runs. */
export function diffTokens(a: string[], b: string[]): Segment[] {
  const n = a.length;
  const m = b.length;
  // Too big to diff token by token: show it as one replacement rather than stall the page.
  if (n * m > 4_000_000) return [...(n ? [{ text: a.join(""), kind: "del" as const }] : []), ...(m ? [{ text: b.join(""), kind: "add" as const }] : [])];
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  }
  const out: Segment[] = [];
  const push = (text: string, kind: Segment["kind"]) => {
    const last = out[out.length - 1];
    if (last?.kind === kind) last.text += text;
    else out.push({ text, kind });
  };
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      push(a[i++], "same");
      j++;
    } else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) push(b[j++], "add");
    else push(a[i++], "del");
  }
  return out;
}

/** Word-level diff of two texts, whitespace kept as its own tokens. */
export function diffText(a: string, b: string): Segment[] {
  const tokens = (s: string) => s.match(/\s+|[^\s]+/g) ?? [];
  return diffTokens(tokens(a), tokens(b));
}

export interface DiffLine {
  text: string;
  kind: "same" | "add" | "del" | "gap";
}

/** Line diff of two JSON documents, unchanged runs longer than 2 * context folded into a gap. */
export function diffJson(before: unknown, after: unknown, context = 3): DiffLine[] {
  const lines = (v: unknown) => JSON.stringify(v, null, 2).split("\n").map((l) => `${l}\n`);
  const segments = diffTokens(lines(before), lines(after));
  const all: DiffLine[] = [];
  for (const s of segments) for (const text of s.text.split("\n").slice(0, -1)) all.push({ text, kind: s.kind });
  const out: DiffLine[] = [];
  const changed = all.map((l) => l.kind !== "same");
  const near = (i: number) => changed.slice(Math.max(0, i - context), i + context + 1).some(Boolean);
  let skipped = 0;
  all.forEach((line, i) => {
    if (near(i)) {
      if (skipped) out.push({ text: `… ${skipped} unchanged lines`, kind: "gap" });
      skipped = 0;
      out.push(line);
    } else skipped++;
  });
  if (skipped) out.push({ text: `… ${skipped} unchanged lines`, kind: "gap" });
  return out;
}

export type Decision = "approved" | "rejected";

export interface ReviewRecord {
  status: Decision;
  date: string;
  comment?: string;
  /** fingerprint() of the entry when decided; a different one means the entry changed since. */
  fingerprint: string;
}

export interface ReviewFile {
  version: 1;
  decisions: Record<string, ReviewRecord>;
}

export function parseReview(text: string): ReviewFile {
  const json = JSON.parse(text) as Partial<ReviewFile>;
  const decisions: Record<string, ReviewRecord> = {};
  for (const [key, record] of Object.entries(json.decisions ?? {})) {
    if (record && (record.status === "approved" || record.status === "rejected")) decisions[key] = record;
  }
  return { version: 1, decisions };
}

/** Keys sorted so the file diffs cleanly in git. */
export function serializeReview(review: ReviewFile): string {
  const decisions = Object.fromEntries(Object.keys(review.decisions).sort().map((k) => [k, review.decisions[k]]));
  return `${JSON.stringify({ version: 1, decisions }, null, 2)}\n`;
}

/** A `$note` split so its GitHub issue references ("BSData/wh40k-11e#1389") render as links. */
export function noteParts(note: string): Array<{ text: string; href?: string }> {
  const parts: Array<{ text: string; href?: string }> = [];
  let last = 0;
  for (const match of note.matchAll(/([\w.-]+\/[\w.-]+)#(\d+)/g)) {
    if (match.index > last) parts.push({ text: note.slice(last, match.index) });
    parts.push({ text: match[0], href: `https://github.com/${match[1]}/issues/${match[2]}` });
    last = match.index + match[0].length;
  }
  if (last < note.length) parts.push({ text: note.slice(last) });
  return parts;
}
