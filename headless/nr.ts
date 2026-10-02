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
 * Read-only: tools that write files are not offered, and nr_eval runs against memory that is
 * thrown away when the process exits. The one write is `reformat --write`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { findSystemFolder, loadSystem, store } from "./env";
import { compactStringify } from "~/assets/shared/battlescribe/compact_json";
import { rootToJson } from "~/assets/shared/battlescribe/bs_main";

const { TOOLS } = await import("~/assets/editor/mcp_tools");
type Tool = (typeof TOOLS)[number];

/**
 * What a headless session may run. Not offered: the ones that write files or create them
 * (nr_save, nr_create_*, nr_script_write/run), and the ones about choosing a system, which
 * --system does here (nr_systems, nr_load_system, nr_unload_system).
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
]);

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
  const order = [...(schema.required ?? []), ...Object.keys(props).filter((k) => !schema.required?.includes(k))];
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

/** Edits an eval made live only in this process; saying so beats letting them pass for saved. */
function discardedEdits(): string[] {
  return Object.values(store.gameSystems)
    .flatMap((system) => system.getAllLoadedCatalogues())
    .filter((catalogue) => store.get_catalogue_state(catalogue)?.unsaved)
    .map((catalogue) => catalogue.name);
}

/** Read before the briefing, which is written for the browser host. */
const HEADLESS_NOTE = `HEADLESS -- read this before the briefing below, which was written for the editor window.
There is no window and no person watching it. The system is the --system folder, loaded whole
at start: skip nr_systems / nr_load_system. Every tool is "nr <name without nr_>" on the command
line ("nr find ...", "nr read <id>"); several on one load with "nr batch". Nothing is saved:
nr_save does not exist here, and what nr_eval writes lives only until the process exits -- use
it to ask questions, or to try an edit and read the diagnostics delta, not to change files.`;

async function runTool(name: string, argv: string[]): Promise<string> {
  const tool = toolNamed(name);
  let result = await tool.execute(parseArgs(tool, argv));
  if (tool.name === "nr_docs" && result && typeof result === "object" && "briefing" in result) {
    result = { headless: HEADLESS_NOTE, ...result };
  }
  let out = render(result);
  const dirty = discardedEdits();
  if (dirty.length) {
    out += `\n[headless is read-only: edits to ${dirty.join(", ")} exist only in this process and were discarded]`;
  }
  return out;
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

async function main(): Promise<void> {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  let systemArg: string | undefined;
  for (const flag of ["--system", "--max-chars"]) {
    const i = argv.indexOf(flag);
    if (i < 0) continue;
    const value = argv[i + 1];
    if (value === undefined) throw new Error(`${flag} needs a value`);
    if (flag === "--system") systemArg = value;
    else maxChars = Number(value);
    argv.splice(i, 2);
  }
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help") {
    process.stdout.write(`${help(rest[0])}\n`);
    return;
  }
  // Fail on a bad tool name before paying for a load.
  if (!["batch", "reformat"].includes(command)) toolNamed(command);
  const folder = findSystemFolder(systemArg);
  const started = Date.now();
  const system = await loadSystem(folder);
  console.error(
    `[nr] ${system.gameSystem?.gameSystem.name}: ${system.getAllLoadedCatalogues().length} files from ${folder} in ${Date.now() - started} ms`,
  );
  if (command === "batch") return batch();
  if (command === "reformat") {
    process.stdout.write(`${await reformat(rest)}\n`);
    return;
  }
  process.stdout.write(`${await runTool(command, rest)}\n`);
}

try {
  await main();
  process.exit(0);
} catch (error) {
  process.stderr.write(`nr: ${(error as Error).message}\n`);
  process.exit(1);
}
