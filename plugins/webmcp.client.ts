// Declares the editor's tools to the browser's WebMCP API, so an MCP client (Claude Code via the
// WebMCP bridge extension or local relay) can drive the editor that is already open in front of you.
// Chrome 146+ ships document.modelContext natively; older browsers need the extension's polyfill.
import type { Catalogue, EditorBase, IErrorMessage } from "~/assets/shared/battlescribe/bs_main_catalogue";

interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: any) => Promise<unknown> | unknown;
}

const store = () => {
  const found = (globalThis as any).$store;
  if (!found) throw new Error("The editor is still starting up — open a system first.");
  return found;
};

// Every loaded catalogue across every open system; tools read this at call time so they stay
// correct as you navigate, rather than capturing whatever was open at registration.
function catalogues(): Catalogue[] {
  const systems = Object.values(store().gameSystems ?? {}) as any[];
  return systems.flatMap((s) => (s.getAllLoadedCatalogues ? [...s.getAllLoadedCatalogues()] : []));
}

function pick(name?: string): Catalogue[] {
  const all = catalogues();
  if (!name) return all;
  const wanted = String(name).toLowerCase();
  const hit = all.filter((c: any) => c.id === name || (c.name ?? "").toLowerCase().includes(wanted));
  if (!hit.length) throw new Error(`No loaded catalogue matching "${name}". Loaded: ${all.map((c) => c.name).join(", ")}`);
  return hit;
}

function pathOf(node: any): string {
  const parts = [] as string[];
  for (let cur = node; cur; cur = cur.parent) parts.push(cur.name ?? cur.id ?? "?");
  return parts.reverse().slice(1).join(" / ");
}

// Engine nodes carry parent/catalogue/refs back-references, so everything a tool returns has to be
// projected to plain data or JSON.stringify blows up on the cycle.
function row(node: any) {
  return {
    id: node.id,
    name: node.name,
    type: node.editorTypeName,
    catalogue: node.catalogue?.name,
    path: pathOf(node),
  };
}

function errorRow(e: IErrorMessage, catalogue: Catalogue) {
  return {
    msg: (e.msg ?? "").replace(/<[^>]+>/g, ""),
    severity: e.severity ?? "error",
    catalogue: catalogue.name,
    at: e.source ? row(e.source) : undefined,
  };
}

const TOOLS: WebMcpTool[] = [
  {
    name: "nr_catalogues",
    description:
      "What the editor currently has open: systems, their loaded catalogues, and how many validation errors each has. Start here to orient.",
    inputSchema: { type: "object", properties: {} },
    execute: () =>
      catalogues().map((c: any) => ({
        id: c.id,
        name: c.name,
        gameSystem: c.gameSystemId,
        isGameSystem: Boolean(c.isGameSystem?.()),
        errors: c.errors?.length ?? 0,
        unsaved: Boolean(store().get_catalogue_state?.(c)?.unsaved),
      })),
  },
  {
    name: "nr_check",
    description:
      "Validation errors in the loaded catalogues (broken links, missing targets, bad references), each with the entry it is on. This is how you test a data change.",
    inputSchema: {
      type: "object",
      properties: {
        catalogue: { type: "string", description: "Name or id; omit for all loaded catalogues" },
        limit: { type: "number", description: "Max errors to return (default 100)" },
      },
    },
    execute: ({ catalogue, limit = 100 }: { catalogue?: string; limit?: number }) => {
      const found = pick(catalogue).flatMap((c: any) => (c.errors ?? []).map((e: IErrorMessage) => errorRow(e, c)));
      return { total: found.length, shown: Math.min(found.length, limit), errors: found.slice(0, limit) };
    },
  },
  {
    name: "nr_find",
    description:
      "Find entries by name across the loaded catalogues. Returns compact rows with the id that nr_read takes.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Case-insensitive name substring" },
        type: { type: "string", description: 'Filter by editor type, e.g. "selectionEntry", "profile", "rule", "modifier"' },
        catalogue: { type: "string" },
        limit: { type: "number", description: "Default 50" },
      },
      required: ["query"],
    },
    execute: ({ query, type, catalogue, limit = 50 }: any) => {
      const wanted = String(query).toLowerCase();
      const hits = [] as any[];
      for (const c of pick(catalogue) as any[]) {
        c.forEachObjectWhitelist((node: EditorBase) => {
          if (type && (node as any).editorTypeName !== type) return;
          if (!(node.name ?? "").toLowerCase().includes(wanted)) return;
          hits.push(row(node));
        });
      }
      return { total: hits.length, shown: Math.min(hits.length, limit), entries: hits.slice(0, limit) };
    },
  },
  {
    name: "nr_read",
    description: "Read one entry by id: its own fields, its children, and any errors on it.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Entry id, from nr_find" } },
      required: ["id"],
    },
    execute: ({ id }: { id: string }) => {
      for (const c of catalogues() as any[]) {
        const node = c.index?.[id];
        if (!node) continue;
        const fields = Object.fromEntries(
          Object.entries(node).filter(([k, v]) => typeof v !== "object" && typeof v !== "function" && !k.startsWith("_"))
        );
        const children = [] as any[];
        node.forEachObjectWhitelist?.((child: EditorBase) => {
          if (child !== node) children.push(row(child));
        }, undefined, 2);
        return {
          ...row(node),
          fields,
          children,
          errors: (node.errors ?? []).map((e: IErrorMessage) => errorRow(e, c)),
        };
      }
      throw new Error(`No entry with id "${id}" in the loaded catalogues.`);
    },
  },
  {
    name: "nr_save",
    description: "Write a catalogue to disk. Does not prompt for a revision bump.",
    inputSchema: {
      type: "object",
      properties: {
        catalogue: { type: "string", description: "Name or id" },
        incrementRevision: { type: "string", description: '"yes", "no" (default) or "github"' },
      },
      required: ["catalogue"],
    },
    execute: async ({ catalogue, incrementRevision = "no" }: any) => {
      const target = pick(catalogue)[0] as any;
      const system = store().gameSystems[target.gameSystemId];
      if (!system) throw new Error(`No open system for catalogue "${target.name}"`);
      const bumped = await store().save_catalogue(system, target, incrementRevision);
      return { saved: target.name, revision: target.revision, revisionIncremented: bumped };
    },
  },
  {
    name: "nr_eval",
    description:
      "Escape hatch: run JavaScript in the editor page. $store is the editor store, $catalogue the open catalogue. Return a JSON-serialisable value.",
    inputSchema: {
      type: "object",
      properties: { code: { type: "string", description: "Async function body" } },
      required: ["code"],
    },
    execute: async ({ code }: { code: string }) => {
      const fn = new Function(`return (async () => {${code}})();`);
      return await fn();
    },
  },
];

export default defineNuxtPlugin(() => {
  // navigator.modelContext is the deprecated alias; document.modelContext is where the spec landed.
  const mc = ((document as any).modelContext ?? (navigator as any).modelContext) as
    | { registerTool: (t: WebMcpTool) => void }
    | undefined;
  if (!mc?.registerTool) {
    console.info("[webmcp] no document.modelContext — needs Chrome 146+ or the WebMCP bridge extension");
    return;
  }
  for (const tool of TOOLS) {
    // Results go to an MCP client, which expects content blocks; a thrown error becomes a tool error.
    mc.registerTool({
      ...tool,
      execute: async (args: any) => ({
        content: [{ type: "text", text: JSON.stringify(await tool.execute(args), null, 1) }],
      }),
    });
  }
  console.info(`[webmcp] registered ${TOOLS.length} editor tools`);
});
