/**
 * nr -- the editor without a window, for a script or an agent working on data files.
 *
 * Loads a game system folder through the editor's own store (headless/env.ts) and runs the same
 * tools the in-browser MCP exposes (assets/editor/mcp_tools.ts): one implementation, two hosts.
 *
 *   nr help [tool]                         what exists / one tool's description and arguments
 *   nr <tool> [positional...] [--key value]  run a tool; "find" and "nr_find" are the same
 *   nr batch < commands                    several commands on one load, one per line
 *   nr reformat [--write] [--catalogue c]  rewrite files the way the editor saves them
 *
 * Global: --system <folder> (else $NR_SYSTEM, else the nearest folder up from here holding a
 * .gst / .gamesystem.json), --max-chars n (result cap, default 30000).
 *
 * Writing: eval, script_run and create_catalogue change the loaded data; nothing reaches the disk
 * unless --save is given (on the command, or on `batch` for all its lines at once). A save is
 * refused when the edit created new error diagnostics (--force overrides), and bumps each file's
 * revision once between two commits (--revision auto|yes|no). create_system writes at once.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { basename } from "node:path";
import { findSystemFolder, flushWrites, loadSystem, store } from "./env";
import { compactStringify } from "~/assets/shared/battlescribe/compact_json";
import { rootToJson } from "~/assets/shared/battlescribe/bs_main";

const { TOOLS, errorSnapshot } = await import("~/assets/editor/mcp_tools");
type Snapshot = ReturnType<typeof errorSnapshot>;
type Tool = (typeof TOOLS)[number];

/**
 * What a headless session may run. Not offered: nr_save (--save does it, behind the diagnostics
 * guard), nr_script_write (a script file is the user's to keep, not a side effect), and the ones
 * about choosing a system, which --system does here (nr_systems, nr_load_system, nr_unload_system).
 */
const OFFERED = new Set([
  "nr_docs",
  "nr_catalogues",
  "nr_diagnosis",
  "nr_find",
  "nr_fields",
  "nr_read",
  "nr_uninitialized",
  "nr_eval",
  "nr_conventions",
  "nr_diff",
  "nr_scripts",
  "nr_script_run",
  "nr_create_catalogue",
  "nr_create_system",
]);

/**
 * Tools that take the system as an argument: here there is exactly one, so it is filled in.
 * nr_create_catalogue finds it among the working folder's subfolders, i.e. by folder name; the
 * script tools take the open system when given nothing.
 */
const TAKES_SYSTEM = new Set(["nr_scripts", "nr_script_run", "nr_create_catalogue"]);
let systemFolder: string | undefined;

function toolNamed(name: string): Tool {
  const wanted = name.startsWith("nr_") ? name : `nr_${name}`;
  const tool = TOOLS.find((t) => t.name === wanted);
  if (!tool || !OFFERED.has(tool.name)) {
    const have = TOOLS.filter((t) => OFFERED.has(t.name)).map((t) => t.name.slice(3));
    throw new Error(`No tool "${name}" here. Have: ${have.join(", ")}, plus batch, reformat, help.`);
  }
  return tool;
}

interface Schema {
  properties?: Record<string, { type?: string }>;
  required?: string[];
}

function coerce(raw: string | true, type: string | undefined, key: string): unknown {
  if (type === "boolean") return raw === true || raw === "true";
  if (raw === true) throw new Error(`--${key} needs a value`);
  if (type === "number") {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`--${key} wants a number, got "${raw}"`);
    return n;
  }
  if (type === "array") return raw.trim().startsWith("[") ? JSON.parse(raw) : raw.split(",").map((s) => s.trim());
  if (type === "object") return JSON.parse(raw);
  return raw;
}

/**
 * Positionals fill the required arguments in order, then the remaining ones as declared; flags
 * name an argument outright and are typed by the schema. --json '{...}' passes them raw.
 */
function parseArgs(tool: Tool, argv: string[]): Record<string, unknown> {
  const schema = tool.inputSchema as Schema;
  const props = schema.properties ?? {};
  // The system is filled in by runTool, so a positional never lands on it.
  const order = [...(schema.required ?? []), ...Object.keys(props).filter((k) => !schema.required?.includes(k))].filter(
    (k) => !(k === "system" && TAKES_SYSTEM.has(tool.name)),
  );
  const args: Record<string, unknown> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--") || token === "--") {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    const value: string | true = next !== undefined && !next.startsWith("--") ? (i++, next) : true;
    if (key === "json") Object.assign(args, JSON.parse(String(value)));
    else if (key === "file" && tool.name === "nr_eval") args.code = readFileSync(String(value), "utf8");
    else if (!(key in props)) throw new Error(`${tool.name} has no argument "${key}". It takes: ${Object.keys(props).join(", ") || "nothing"}`);
    else args[key] = coerce(value, props[key].type, key);
  }
  for (const value of positional) {
    const key = order.find((k) => !(k in args));
    if (!key) throw new Error(`Too many arguments for ${tool.name}: "${value}"`);
    // "-" reads the value from stdin: eval code is easier to pass that way than quoted.
    args[key] = value === "-" ? readFileSync(0, "utf8") : coerce(value, props[key].type, key);
  }
  return args;
}

let maxChars = 30_000;

function render(value: unknown): string {
  const text = typeof value === "string" ? value : compactStringify(value, 1);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n… [truncated: the result was ${text.length} chars. Narrow it -- limit in find, depth/exclude in json() and tree(), fewer fields -- or raise --max-chars.]`;
}

function loadedCatalogues() {
  return Object.values(store.gameSystems).flatMap((system) => system.getAllLoadedCatalogues());
}

/** Catalogues edited in this process and not written yet. */
function unsavedCatalogues() {
  return loadedCatalogues().filter((catalogue) => store.get_catalogue_state(catalogue)?.unsaved);
}

/** Read before the briefing, which is written for the browser host. */
const HEADLESS_NOTE = `HEADLESS -- read this before the briefing below, which was written for the editor window.
There is no window and no person watching it. The system is the --system folder, loaded whole
at start: skip nr_systems / nr_load_system. Every tool is "nr <name without nr_>" on the command
line ("nr find ...", "nr read <id>"); several on one load with "nr batch". There is no nr_save:
an edit (nr_eval, nr_script_run, nr_create_catalogue) is written only when the command carries
--save, and the save is refused if the edit created new error diagnostics. Without --save, it is
a dry run: try the edit, read the diagnostics delta, then run it again with --save.`;

async function runTool(name: string, argv: string[]): Promise<string> {
  const tool = toolNamed(name);
  const args = parseArgs(tool, argv);
  if (tool.name === "nr_create_catalogue" && args.system === undefined && systemFolder) {
    args.system = basename(systemFolder);
  }
  let result = await tool.execute(args);
  if (tool.name === "nr_docs" && result && typeof result === "object" && "briefing" in result) {
    result = { headless: HEADLESS_NOTE, ...result };
  }
  return render(result);
}

/** The revision a file has in git HEAD, or undefined (not in a repository, new file, zipped). */
function headRevision(path: string): number | undefined {
  let text: string;
  try {
    text = execFileSync("git", ["show", `HEAD:./${basename(path)}`], {
      cwd: dirname(path),
      encoding: "utf8",
      maxBuffer: 1 << 30,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
  if (path.endsWith(".json")) {
    const data = JSON.parse(text);
    return (data.gameSystem ?? data.catalogue)?.revision;
  }
  const found = text.match(/<(?:gameSystem|catalogue)\b[^>]*\brevision="(\d+)"/);
  return found ? Number(found[1]) : undefined;
}

type RevisionMode = "auto" | "yes" | "no";

/**
 * Writes every catalogue the commands edited, unless they created new error diagnostics.
 *
 * Revision, "auto": bumped when the file's revision is still the one committed in git -- i.e.
 * once between two commits, however many saves happen in between. The editor asks this in a
 * dialog; there is none here. "yes" / "no" force it.
 */
async function save(before: Snapshot, force: boolean, revision: RevisionMode): Promise<{ text: string; refused: boolean }> {
  const after = errorSnapshot();
  const added = [...after].filter(([key]) => !before.has(key)).map(([, finding]) => finding);
  const errors = added.filter((finding) => finding.severity === "error");
  const others = added.filter((finding) => finding.severity !== "error");
  const lines: string[] = [];
  const show = (finding: (typeof added)[number]) =>
    `  ${finding.severity}: ${finding.msg} [${finding.catalogue}${finding.at?.path ? ` / ${finding.at.path}` : ""}]`;
  const edited = unsavedCatalogues();
  if (!edited.length) return { text: "[--save: nothing was edited, nothing written]", refused: false };
  if (errors.length && !force) {
    lines.push(`NOT SAVED: the edit created ${errors.length} new error diagnostic(s). Fix the edit, or --force if it is meant.`);
    lines.push(...errors.slice(0, 20).map(show));
    if (errors.length > 20) lines.push(`  ... and ${errors.length - 20} more`);
    return { text: lines.join("\n"), refused: true };
  }
  lines.push(`SAVED ${edited.length} file(s):`);
  for (const catalogue of edited) {
    const system = store.gameSystems[catalogue.gameSystemId ?? catalogue.id];
    const path = catalogue.fullFilePath;
    const wasDirty = path ? uncommitted(path) : false;
    const committed = path ? headRevision(path) : undefined;
    const bump = revision === "yes" || (revision === "auto" && committed !== undefined && catalogue.revision === committed);
    const from = catalogue.revision;
    await store.save_catalogue(system, catalogue, bump ? "yes" : "no");
    const notes = [
      committed === undefined ? "not in git HEAD" : "",
      from !== catalogue.revision ? `revision ${from} -> ${catalogue.revision}` : `revision ${catalogue.revision}`,
      wasDirty ? "already had uncommitted changes" : "",
    ].filter(Boolean);
    lines.push(`  ${path ?? catalogue.name} (${notes.join(", ")})`);
  }
  await flushWrites();
  if (errors.length) lines.push(`Forced past ${errors.length} new error diagnostic(s):`, ...errors.slice(0, 20).map(show));
  if (others.length) lines.push(`New warnings/notes (not blocking):`, ...others.slice(0, 20).map(show));
  return { text: lines.join("\n"), refused: false };
}

/** After the commands: either write, or say plainly that the edits are gone. */
async function finish(before: Snapshot, options: { save: boolean; force: boolean; revision: RevisionMode }): Promise<boolean> {
  if (options.save) {
    const { text, refused } = await save(before, options.force, options.revision);
    process.stdout.write(`${text}\n`);
    return !refused;
  }
  const dirty = unsavedCatalogues().map((catalogue) => catalogue.name);
  if (dirty.length) {
    process.stdout.write(`[not saved: edits to ${dirty.join(", ")} were a dry run. Same command with --save to write them]\n`);
  }
  return true;
}

function help(name?: string): string {
  if (name) {
    const tool = toolNamed(name);
    return `${tool.name}\n\n${tool.description}\n\narguments: ${compactStringify(tool.inputSchema, 1)}`;
  }
  const lines = TOOLS.filter((t) => OFFERED.has(t.name)).map(
    (t) => `  ${t.name.slice(3).padEnd(14)} ${t.description.split("\n")[0].slice(0, 100)}`,
  );
  return [
    "nr <tool> [positional...] [--key value] [--system folder]",
    "",
    ...lines,
    "",
    "  batch          several commands on one load: one per line on stdin, same syntax (quotes ok)",
    "  reformat       rewrite files the way the editor saves them: dry run, --write to apply",
    "",
    "Edits (eval, script_run, create_catalogue) are a dry run unless --save: written only if they",
    "created no new error diagnostic (--force overrides); revision bumped once per commit",
    "(--revision auto|yes|no). create_system needs --folder <parent> and writes at once.",
    "",
    "nr help <tool> for the full description and arguments. Start with: nr docs",
  ].join("\n");
}

/** Shell-like split: quotes group, backslash escapes inside double quotes. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: string | undefined;
  let any = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = undefined;
      else if (c === "\\" && quote === '"' && i + 1 < line.length) cur += line[++i];
      else cur += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      any = true;
    } else if (/\s/.test(c)) {
      if (cur || any) out.push(cur);
      cur = "";
      any = false;
    } else cur += c;
  }
  if (quote) throw new Error(`Unclosed ${quote} in: ${line}`);
  if (cur || any) out.push(cur);
  return out;
}

async function batch(): Promise<void> {
  const lines = readFileSync(0, "utf8").split("\n");
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const [name, ...rest] = splitLine(line.trim());
    process.stdout.write(`\n=== ${line.trim()}\n`);
    try {
      process.stdout.write(`${await runTool(name, rest)}\n`);
    } catch (error) {
      process.stdout.write(`ERROR: ${(error as Error).message}\n`);
    }
  }
}

/**
 * How two parsed files differ, ignoring key order and treating an empty array as absent (the
 * editor never writes one). Grouped by what happened to which key, with one example path each,
 * so a key the editor drops everywhere reads as one line rather than a thousand.
 */
function differences(a: unknown, b: unknown): string[] {
  const groups = new Map<string, { count: number; example: string }>();
  const note = (what: string, path: string) => {
    const group = groups.get(what);
    if (group) group.count++;
    else groups.set(what, { count: 1, example: path });
  };
  const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object";
  const absent = (v: unknown) => v === undefined || (Array.isArray(v) && v.length === 0);
  const walk = (x: unknown, y: unknown, path: string, key: string) => {
    if (x === y || (absent(x) && absent(y))) return;
    if (absent(y)) return note(`dropped "${key}"`, path);
    if (absent(x)) return note(`added "${key}"`, path);
    if (!isObj(x) || !isObj(y) || Array.isArray(x) !== Array.isArray(y)) {
      return note(`changed "${key}" (${JSON.stringify(x)?.slice(0, 40)} -> ${JSON.stringify(y)?.slice(0, 40)})`, path);
    }
    if (Array.isArray(x) && Array.isArray(y) && x.length !== y.length) {
      return note(`"${key}" length ${x.length} -> ${y.length}`, path);
    }
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      walk(x[k], (y as Record<string, unknown>)[k], Array.isArray(x) ? `${path}[${k}]` : `${path}.${k}`, Array.isArray(x) ? key : k);
    }
  };
  walk(a, b, "", "(root)");
  return [...groups].map(([what, { count, example }]) => `${what} x${count}, e.g. ${example.slice(1)}`);
}

/** True when git knows the file and it differs from HEAD. Outside a repository: false. */
function uncommitted(path: string): boolean {
  try {
    return execFileSync("git", ["status", "--porcelain", "--", path], { cwd: dirname(path), encoding: "utf8" }).trim() !== "";
  } catch {
    return false;
  }
}

/**
 * Writes each file exactly as the editor's save would, so the next real edit diffs only itself.
 *
 * Dry run by default. A JSON file whose content would change (not just its layout) is reported
 * with where, and left alone even with --write unless --force: that is the editor normalising or
 * dropping something, which deserves a look before it lands. A file with uncommitted edits is
 * never touched: the point is a commit that is only the reformat.
 */
async function reformat(argv: string[]): Promise<string> {
  const write = argv.includes("--write");
  const force = argv.includes("--force");
  const i = argv.indexOf("--catalogue");
  const only = i >= 0 ? argv[i + 1]?.toLowerCase() : undefined;
  const lines: string[] = [];
  for (const system of Object.values(store.gameSystems)) {
    for (const catalogue of system.getAllLoadedCatalogues()) {
      if (only && catalogue.id !== only && !catalogue.name.toLowerCase().includes(only)) continue;
      const path = catalogue.fullFilePath;
      if (!path) continue;
      if (uncommitted(path)) {
        lines.push(`dirty    ${path} -- has uncommitted changes; commit or stash them first, so the reformat is its own diff`);
        continue;
      }
      const original = readFileSync(path, "utf8");
      if (!path.endsWith(".json")) {
        lines.push(`skip     ${path} (XML: the editor rewrites it on save; not compared here)`);
        continue;
      }
      const next = rootToJson(catalogue);
      if (next === original) {
        lines.push(`same     ${path}`);
        continue;
      }
      const diff = differences(JSON.parse(original), JSON.parse(next));
      if (diff.length && !force) {
        lines.push(`CONTENT  ${path} -- would change data, not only layout; left alone (--force to write anyway):`);
        lines.push(...diff.map((d) => `           ${d}`));
        continue;
      }
      if (write) writeFileSync(path, next);
      lines.push(`${write ? "written " : "layout  "} ${path}${diff.length ? " (forced, content changes)" : ""}`);
    }
  }
  if (!write) lines.push("", "Dry run. --write rewrites the files marked layout.");
  return lines.join("\n");
}

/** Pulls a global flag out of argv: its value, true for a bare switch, undefined when absent. */
function takeFlag(argv: string[], flag: string, withValue: boolean): string | true | undefined {
  const i = argv.indexOf(flag);
  if (i < 0) return undefined;
  if (!withValue) {
    argv.splice(i, 1);
    return true;
  }
  const value = argv[i + 1];
  if (value === undefined) throw new Error(`${flag} needs a value`);
  argv.splice(i, 2);
  return value;
}

async function main(): Promise<boolean> {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const systemArg = takeFlag(argv, "--system", true) as string | undefined;
  const max = takeFlag(argv, "--max-chars", true);
  if (max !== undefined) maxChars = Number(max);
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help") {
    process.stdout.write(`${help(rest[0])}\n`);
    return true;
  }
  // reformat has its own --write/--force; everywhere else these are the save switches.
  const options =
    command === "reformat"
      ? { save: false, force: false, revision: "auto" as RevisionMode }
      : {
          save: takeFlag(rest, "--save", false) === true,
          force: takeFlag(rest, "--force", false) === true,
          revision: (takeFlag(rest, "--revision", true) ?? "auto") as RevisionMode,
        };
  if (!["auto", "yes", "no"].includes(options.revision)) throw new Error("--revision is auto, yes or no");
  // Fail on a bad tool name before paying for a load.
  const tool = ["batch", "reformat"].includes(command) ? undefined : toolNamed(command);
  // A new system has nothing to load yet: the tool creates the folder and writes the file itself.
  if (tool?.name === "nr_create_system") {
    process.stdout.write(`${await runTool(command, rest)}\n`);
    await flushWrites();
    return true;
  }
  const folder = findSystemFolder(systemArg);
  systemFolder = folder;
  const started = Date.now();
  const system = await loadSystem(folder);
  console.error(
    `[nr] ${system.gameSystem?.gameSystem.name}: ${system.getAllLoadedCatalogues().length} files from ${folder} in ${Date.now() - started} ms`,
  );
  if (command === "reformat") {
    process.stdout.write(`${await reformat(rest)}\n`);
    return true;
  }
  const before = errorSnapshot();
  if (command === "batch") await batch();
  else process.stdout.write(`${await runTool(command, rest)}\n`);
  return await finish(before, options);
}

try {
  // Exit 2: a --save refused by the diagnostics guard -- the command ran, nothing was written.
  process.exit((await main()) ? 0 : 2);
} catch (error) {
  process.stderr.write(`nr: ${(error as Error).message}\n`);
  process.exit(1);
}
