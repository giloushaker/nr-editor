// Declares the editor's tools to the browser's WebMCP API, so an MCP client (Claude Code via the
// WebMCP bridge extension or local relay) can drive the editor that is already open in front of you.
import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";
import type { Router } from "vue-router";
import { compactStringify } from "~/assets/shared/battlescribe/compact_json";
import { useSettingsStore } from "~/stores/settingsState";
import { TOOLS, nudge, setRouter, untilLoaded, type ModelContext, type ToolArgs } from "~/assets/editor/mcp_tools";

/**
 * What the options panel shows under "Enable MCP". Runtime only -- it dies with the page, so it
 * is a plain reactive object rather than a store.
 *
 * There is no connection API to ask: the relay's embed talks to its widget iframe over
 * postMessage and never reports the socket either way. What it does do is ask the page for its
 * tool list, and only after the relay accepted its handshake -- so that message arriving is the
 * signal that something is on the other end. A tool actually running is the same signal, and it
 * is the only one available on the browser-extension route, which has no widget at all.
 *
 * Nothing sets it back to false: a dropped socket is not observable from here either. "Connected"
 * therefore means "something reached the editor at least once this page load".
 */
export const mcpStatus = reactive({
  connected: false,
  /** Where it reached us, in terms someone can act on: "localhost port 9333". */
  address: "",
  /** The relay's own refusal, when it sends one. */
  rejected: "",
});

/** Arguments arrive as JSON from an MCP client, so they are read defensively rather than trusted. */

export default defineNuxtPlugin((nuxtApp) => {
  setRouter(nuxtApp.$router as Router);
  const settings = useSettingsStore();
  // Opt-in, and off by default: an editor that quietly answers to anything on localhost is not a
  // default anyone chose. Registration happens once, the first time it is switched on -- neither
  // modelContext nor the relay embed can be taken back out of the page, so `mcpEnabled` is
  // enforced per call below instead, which also makes switching it off take effect immediately.
  // An automated browser (Puppeteer/Playwright/WebDriver) IS a session an agent chose, so it gets
  // MCP without flipping the persisted setting — a shared profile's normal sessions stay opted out.
  if (settings.mcpEnabled || mcpImplicitlyOn()) {
    start();
    return;
  }
  const stop = watch(
    () => settings.mcpEnabled,
    (on) => {
      if (!on) return;
      stop();
      start();
    },
  );
});

// True when the browser is driven by automation (Puppeteer/Playwright/WebDriver set navigator.webdriver).
function mcpImplicitlyOn(): boolean {
  return navigator.webdriver === true;
}

let started = false;

function start() {
  if (started) return;
  started = true;
  const settings = useSettingsStore();

  // Chrome only exposes modelContext behind the experimental-web-platform-features flag, so install
  // the polyfill first; it no-ops where a native implementation already exists.
  initializeWebMCPPolyfill();

  // navigator.modelContext is the deprecated alias; document.modelContext is where the spec landed.
  const owner = document as unknown as { modelContext?: ModelContext };
  const legacy = navigator as unknown as { modelContext?: ModelContext };
  const mc = owner.modelContext ?? legacy.modelContext;
  if (!mc?.registerTool) {
    console.info("[webmcp] no document.modelContext — the WebMCP polyfill failed to install");
    return;
  }
  for (const tool of TOOLS) {
    // Results go to an MCP client, which expects content blocks; a thrown error becomes a tool error.
    mc.registerTool({
      ...tool,
      execute: async (args: ToolArgs) => {
        // The only enforcement point that works after registration, so it is the one that counts.
        if (!settings.mcpEnabled && !mcpImplicitlyOn())
          throw new Error("MCP is switched off in the editor's options.");
        await untilLoaded();
        if (!mcpStatus.connected) {
          mcpStatus.connected = true;
          if (!mcpStatus.address) mcpStatus.address = "this browser";
        }
        // The same layout the files are saved in: name/id first, small objects on one line. A
        // result is read by something that pays per token, and JSON.stringify(x, null, 1) spent
        // a third of them on newlines.
        const text = compactStringify(await tool.execute(args), 1);
        // A result the client cannot hold gets spilled to a file and read back in slices, which
        // costs more than narrowing the question. Cut here, and say how to narrow it.
        const content = [
          {
            type: "text",
            text:
              text.length <= MAX_RESULT_CHARS
                ? text
                : `${text.slice(0, MAX_RESULT_CHARS)}\n… [truncated: the result was ${text.length} chars. Narrow it: depth/exclude in json() and tree(), limit in nr_find, fewer fields in the return value.]`,
          },
        ];
        const note = nudge(tool.name);
        if (note) content.push({ type: "text", text: note });
        return { content };
      },
    });
  }
  // Console handle: $mcp("nr_read", { id }) runs a tool and gives back its plain result. Calls
  // execute directly rather than going through modelContext, so there is no JSON round-trip and
  // no content-block wrapper in the way -- the point is to read the value, not the envelope.
  globalThis.$mcp = async (name: string, args: Record<string, unknown> = {}) => {
    const tool = TOOLS.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`No tool "${name}". Have: ${TOOLS.map((t) => t.name).join(", ")}`);
    return await tool.execute(args);
  };
  console.info(`[webmcp] registered ${TOOLS.length} editor tools — try them with $mcp("nr_docs")`);

  // The local relay is WebSocket-only, so the page hosts its embed itself (public/webmcp, vendored
  // from the relay package). It must be a real <script src> — the embed resolves widget.html
  // relative to its own src — and it is injected after registration so the tools are there already.
  const embed = document.createElement("script");
  // Resolved against <base>, not the origin: a leading-slash "/webmcp/..." lands on the drive root
  // under Electron's file:// and outside the baseURL on GitHub Pages, and the embed never loads.
  embed.src = new URL("webmcp/embed.js", document.baseURI).href;
  embed.async = true;
  // The relay's own --port is configurable, so allow ?webmcpPort= rather than pinning its default.
  const params = new URLSearchParams(location.search);
  const port = params.get("webmcpPort");
  if (port) embed.setAttribute("data-relay-port", port);

  // The embed defaults to 127.0.0.1, which a content blocker sees as a different host from the page
  // it is running on — so "allow on this site" never covers the socket and the connection is blocked
  // with no visible cause. Keep both on the same host when we are already on loopback.
  const onLoopback = ["localhost", "127.0.0.1"].includes(location.hostname);
  const host = params.get("webmcpHost") ?? (onLoopback ? location.hostname : null);
  if (host) embed.setAttribute("data-relay-host", host);

  document.head.appendChild(embed);
  listenForRelay(port ?? RELAY_DEFAULT_PORT);
}

/** About 20k tokens: enough for a survey, short of what makes a client spill the reply to disk. */
const MAX_RESULT_CHARS = 80_000;

/** The relay's own default, which the embed applies when no data-relay-port is set. */
const RELAY_DEFAULT_PORT = "9333";

/**
 * Watches the relay widget's own traffic for a sign of life.
 *
 * The widget asks the page for its tool list only once the relay has accepted its handshake, so
 * that request is the earliest honest "something is connected"; `webmcp.relay.rejected` is the
 * matching failure, and carries the relay's reason. This is a second, passive listener beside the
 * embed's own -- both see the same messages, and this one never answers any of them.
 *
 * No host or IP in the message: someone reading the options panel should not have to know what
 * 127.0.0.1 is.
 */
function listenForRelay(port: string) {
  addEventListener("message", (event: MessageEvent) => {
    const type = (event.data as { type?: unknown } | null)?.type;
    if (type === "webmcp.tools.list.request" || type === "webmcp.tools.invoke.request") {
      mcpStatus.address = `localhost port ${port}`;
      mcpStatus.connected = true;
      mcpStatus.rejected = "";
    } else if (type === "webmcp.relay.rejected") {
      const why = (event.data as { message?: unknown }).message;
      mcpStatus.rejected = `The relay on localhost port ${port} refused the connection${
        typeof why === "string" && why ? `: ${why}` : ""
      }`;
    }
  });
}
