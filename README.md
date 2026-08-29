# NewRecruit Data Editor

## Description

NewRecruit Data Editor is a desktop application built with Electron, designed to provide a user-friendly and up-to-date editor for data files used in tabletop wargames. Inspired by the popular Battlescribe's data editor, our app aims to be a reliable alternative that continues to receive regular updates.

## Motivation

The motivation behind creating NewRecruit Data Editor stems from the frustration many tabletop wargaming enthusiasts have experienced due to the lack of updates and the negative behavior of the developer behind Battlescribe. Our goal is to provide a viable solution that not only offers an intuitive user interface but also ensures ongoing development and community involvement.

## Key Features

Continuous updates and improvements: We are committed to regularly updating and improving NewRecruit Data Editor to ensure it remains relevant and up-to-date with the latest tabletop wargaming requirements.

Community-driven development: We welcome and value the feedback and suggestions from our community. Your input plays a crucial role in shaping the future direction of NewRecruit Data Editor.

## Installation

To install NewRecruit Data Editor, follow these steps:

Download the latest release from the [Releases](https://github.com/giloushaker/nr-editor/releases)
page.

Choose the appropriate installer for your operating system (Windows, macOS, Linux).

Run the installer and follow the on-screen instructions to complete the installation process.

Once installed, launch the NewRecruit Data Editor application on your desktop.

If you are on a MAC you may have to run 
```
xattr -c <path/to/application.app>
```
to remove the "App Is Damaged and Can’t Be Opened. You Should Move It To The Trash" popup 


## Usage

Launch the NewRecruit Data Editor application.

Select the system you want to edit, or create a new one.

Open an existing data file or create a new one.

Save your changes.

Enjoy playing with your updated data file!

## Development

## Setup

Make sure to install the dependencies:

```bash
# yarn
yarn install

# npm
npm install

# pnpm
pnpm install
```

Initialize the submobules (code shared with newrecruit.eu)
```bash
git submodule update --init --recursive
```

## Development Server

Start the development server on `http://localhost:3005`

```bash
npm run dev
```

Start the Electron Application (No hot reload)
```bash
npm run electron
```

## Driving the editor from an AI agent (MCP)

The editor exposes itself to MCP clients (Claude Code, Cursor, Claude Desktop) through
[WebMCP](https://github.com/webmachinelearning/webmcp): the page registers tools on
`document.modelContext`, and a small local relay bridges them to the client. The agent then works
against the editor you already have open — edits land in your window, on your undo stack.

Setup, once:

```bash
claude mcp add --scope user webmcp -- npx @mcp-b/webmcp-local-relay
```

Then start the dev server, open `http://localhost:3005` in Chrome, and start your MCP client. Nothing
else to install — `npx` fetches the relay, and the page ships the polyfill and the relay's embed
(`public/webmcp/`, vendored from `@mcp-b/webmcp-local-relay`).

### Tools

| Tool | What it does |
|---|---|
| `nr_docs` | Serves [the wiki](https://newrecruit-docs.pages.dev) page by page, plus the editor-specific rules. Agents are told to read it first. |
| `nr_systems` | Every system on disk or in browser storage, and whether it is loaded |
| `nr_load_system` | Load a system and all its catalogues; `force` re-reads from disk |
| `nr_unload_system` | Drop the loaded catalogues, keep the files |
| `nr_create_system` | New empty system in the working folder |
| `nr_catalogues` | Loaded catalogues, with error counts |
| `nr_check` | Validation errors, each with the entry it sits on |
| `nr_find` | Find entries by name, returns ids for `nr_read` |
| `nr_read` | One entry: fields, children, errors |
| `nr_save` | Write a catalogue to disk (never prompts for a revision bump) |
| `nr_eval` | Change data: run JS in the page. One call is one undo entry |
| `nr_uninitialized` | Nodes left without their class prototype — run if a script starts throwing |

Tools are registered per tab and follow what you have open. They are declared in
[plugins/webmcp.client.ts](plugins/webmcp.client.ts) — add one there and it appears in the client
without a restart.

### If the tools do not show up

**Content blockers.** uBlock Origin, Pie Adblock and friends block the relay's WebSocket. Allowlisting
the site is not enough on its own, because the page is `localhost:3005` while the socket goes to the
relay — the plugin points it at the page's own hostname so one allowlist covers both, but a rule
matching the port or `ws://` will still bite. Incognito (extensions off) is the fastest way to confirm
whether an extension is the cause.

**More than one relay.** The relay's `--port` is a *cluster* root: a second instance joins the first
as a client instead of failing, so stale relays from closed sessions hijack the port and the browser
connects to nothing. Symptom is `webmcp_list_sources` reporting `"mode":"client"` or `count: 0`. Close
old sessions, or kill every `webmcp-local-relay` process, then reconnect once.

**Server not found after `claude mcp add`.** On Windows, `~/.claude.json` can end up with two project
entries for the same folder differing only in drive-letter case (`c:/…` vs `C:/…`), and the server
lands in the one your session is not reading. `--scope user` above avoids this entirely. Note that
`claude mcp list` aggregates across entries and will show the server as connected either way, while
`claude mcp get <name>` is scoped and tells the truth.

### Options

`?webmcpPort=9444` and `?webmcpHost=127.0.0.1` on the editor URL override where the page looks for the
relay, for when you run it with a non-default `--port`.

By default the relay accepts a widget connection from any origin, so any page you have open could
offer tools to your agent. Once your setup settles, restrict it:

```bash
claude mcp add --scope user webmcp -- npx @mcp-b/webmcp-local-relay --widget-origin http://localhost:3005
```

## Production

Build the application for production:

```bash
npm run build
```

Locally preview production build:

```bash
npm run preview
```
