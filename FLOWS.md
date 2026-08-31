# User Flows

Concise inventory of what users do, step by step, to surface friction and
human-error traps. Legend:

- ⚠ known friction (verified or reported)
- ? unverified — needs a manual check
- → "leads into flow …" (transitions are where most bugs hide)

Cross-cutting invariants to check on EVERY flow are listed at the bottom.

## Who these flows are for

Not "users" in general. A **data author**: a volunteer maintaining the
BattleScribe-format catalogues for a game system — Warhammer 40,000 10th ed,
Horus Heresy 2nd ed, The Old World, T9A — on behalf of everyone who builds
lists in NewRecruit or BattleScribe. Their working conditions shape every flow
below:

- **The source of truth is a PDF they own, not the app.** GW publishes a codex
  or a Munitorum Field Manual; the author retypes it. Copy-from-PDF into the
  editor is a first-class input, not an edge case ([paste_table.ts](scripts/paste_table.ts)).
- **The work is bursty and repetitive.** A points update is one number changed
  across 200 entries in an evening. A new codex is a week of structural work.
  Between releases, nothing.
- **The unit of shipping is a git commit**, not a save. Publishing does not go
  through BSData, so the `revision` attribute carries no distribution meaning
  here — treat every "bump the revision" affordance in the app as legacy.
- **The house rules are strict and mostly unenforced by tooling.** Per
  [BSData's guidelines](https://github.com/BSData/wh40k-9e/wiki/Guidelines):
  catalogues MUST define units as shared entries; the `.gst` MUST NOT hold
  shared wargear (factions price it differently); keywords SHOULD be Category
  links; and above all "all choices that are valid _or possibly_ valid MUST be
  represented and MUST NOT raise errors". Nothing in the editor checks any of
  this — see G2.
- **They are not programmers.** They will not write a script or author a
  schema; the affordance has to be in the UI or it does not exist for them.
- **They are accountable in public.** A wrong points value becomes a GitHub
  issue with their name on it within a day.

---

## A. Getting data in front of you

**A1. First run — nothing open yet**
1. Land on Systems → empty state: three cards (GitHub / this computer / start fresh)
2. Pick one
- ✓ FIXED: the no-folder-support case names the browsers that work ("Chrome,
  Edge, Brave, or Opera") instead of just disabling the button
  ([system.vue:86-100](pages/system.vue#L86-L100)).
- ? A returning user with a working folder never sees the empty state again, so
  the GitHub path is discoverable exactly once. Do authors who started local
  ever find repo import? — needs a counter: which of the three entry cards gets
  used, first session vs later.
- → A2, A3

**A2. Open a system from a local folder**
1. Choose folder → browser/Electron folder picker
2. Rows appear per system, chipped `folder`
3. Click a row → progress screen → catalogue list
- ⚠ In the browser the folder handle survives a restart but the *permission*
  does not; the user gets a "🔒 forgot its permission" banner and one button
  ([system.vue:44-50](pages/system.vue#L44-L50)). Recovery is fine — discovering
  that this is normal and not corruption is the friction.
- ? Loading a large system (40k 10e is ~150 catalogue files) shows a counter but
  no cancel. Wrong folder picked = wait it out.
- → B1

**A3. Import from GitHub**
1. + Add system → Import from GitHub → search list, or paste `owner/repo`
2. Pick branch or tag → Import (downloads the repo zip)
- ⚠ Unauthenticated GitHub API. `githubRateLimitedUntil()` exists
  ([github.ts:35](assets/shared/battlescribe/github.ts#L35)), so a user who
  browses several repos in a session can hit 60 req/h and see failures, with no
  sign-in offered anywhere.
- ⚠ The import is a **zip snapshot, not a clone**. No remote, no branch
  tracking, no pull. The only refresh is re-import — see A4, E1.
- → A4, E1

**A4. Reload after a `git pull`**
1. Pull in your git client, outside the app
2. Systems → the row now reads `↻ Reload` → click
- ⚠ **Reload silently discards unsaved in-memory edits.** `openRow` calls
  `load_systems_from_folder` with no unsaved check, and `load_system` defaults
  `keepState` to false, which clears `unsaved`/`changed` and re-reads from disk
  ([editorStore.ts:459-472](stores/editorStore.ts#L459-L472),
  [system.vue:243](pages/system.vue#L243)). The tooltip says "Re-reads files
  from disk — use after git pull"; it does not say the unsaved work goes away.
  Every other exit path in the app guards this (F3).
- ⚠ "Open" and "throw away and re-read" are the same button in the same place,
  distinguished only by label text.

---

## B. The core loop — find, change, check, save

**B1. Find the entry you need to change**
1. Open a catalogue → left panel tree
2. Ctrl+F → type a name
3. Matching rows highlight, ancestors expand
- ⚠ **The tree search box is plain substring matching** (`findOptionsByText`,
  [editorStore.ts:2071](stores/editorStore.ts#L2071)) while the editor
  *contains* a full query language — `is:constraint value:>0`,
  `has:profile[...]`, `refs:0`, `in:entry[...]`
  ([bs_search.ts](assets/editor/bs_search.ts)). It is wired to `nr_find` for
  agents and `$store.query()` for scripts, and to nothing a human can type. The
  AI has strictly better search than the person.
- ⚠ Above 300 matches the ancestors stop being expanded
  ([editorStore.ts:2080](stores/editorStore.ts#L2080)) — a broad search looks
  like it half-worked rather than like it was capped.
- ⚠ The system-wide search page (`/search/:id`) is a *third* search: regex over
  name/text/description/id, paginated, no query language, and it calls
  `system.loadAll()` first ([editorStore.ts:2104](stores/editorStore.ts#L2104)),
  so the first search of a session loads every catalogue in the system.
- → B2, C1

**B2. Change a field**
1. Select the entry → right panel
2. Type in a field → it applies on the fly
- ✓ FIXED: consecutive keystrokes in one box collapse into one undo entry, and
  the burst breaks on node/key change, undo/redo, or a pause
  ([field_edit_stack.ts](stores/field_edit_stack.ts)) — so undo after typing a
  name restores the old name, not the last character.
- ⚠ Editing anything under a **profileType** queues `fix_profiles`, which loads
  every catalogue in the system and walks it
  ([editorStore.ts:574-598](stores/editorStore.ts#L574-L598)). Coalesced, but
  the first such edit in a session stalls a big system with no indication that
  renaming a characteristic is a system-wide operation.
- → B3

**B3. See what you broke**
1. Keep editing; error markers appear on entries
2. (or) ask an agent — `nr_check` (D2)
- ⚠ Validation answers "is this file internally consistent" (broken links,
  missing targets). It does not answer any of the BSData house rules the author
  is actually judged on — units-must-be-shared, no shared wargear in the `.gst`,
  keywords as Category links. See G2.
- ? Is there a way to see *all* errors in a catalogue as a flat list, or only
  markers in the tree? Agents get a list via `nr_check`; humans may not.
- → B4

**B4. Save**
1. Save All in the titlebar
2. Prompt: "Would you like to increase the revision of this catalogue?"
3. Files written
- ⚠ Step 2 is a modal on the way to disk, asking about something that no longer
  affects distribution (see preamble). `prompt_revision`
  ([editorStore.ts:639](stores/editorStore.ts#L639)) plus the GitHub
  auto-increment branch and the settings flag behind it are all legacy weight on
  the most frequent action in the product.
- ? Is the prompt still wanted at all, or should saving just save? If it stays,
  it currently answers once per *system* and applies to every unsaved catalogue
  ([editorStore.ts:683-700](stores/editorStore.ts#L683-L700)), and a "no" sets
  `incremented = true` so it never returns that session
  ([editorStore.ts:624](stores/editorStore.ts#L624)) — both fine if nobody cares
  about the number, both wrong if anyone does.
- → E1

---

## C. Repetitive work — most of a data author's day

**C1. Points pass across a catalogue**
1. New Field Manual drops with ~200 changed values
2. For each: find entry (B1) → open → edit the cost → next
- ⚠ There is no bulk edit. CLAUDE.md describes a "Builder Panel: Spreadsheet-like
  bulk editing" as part of the three-panel layout;
  [components/catalogue/](components/catalogue/) has `left_panel`, `right_panel`
  and `edit_v2` only. Either it was removed or never built, and the docs still
  promise it.
- ⚠ Even a filtered view would help and is nearly free: `is:entry value:>0`
  already parses (B1), it just has no UI. The 200-edit evening is the
  highest-volume flow in the product and has the least support.
- → D3 (this is the flow authors will hand to an agent first)

**C2. Get a new unit in from a PDF**
1. Copy the statline table out of the PDF
2. Paste into the editor → profiles created
- ✓ FIXED: column→characteristic mapping is *inferred* from
  `profileType.characteristicTypes` rather than hardcoded per system, and the
  splitter handles both tab-separated (spreadsheet) and 2+-space (PDF copy) text
  ([paste_table.ts](scripts/paste_table.ts)). Data authors will not write a
  mapping file, so inference is the only version of this that ships.
- ? Where is paste-table reachable from in the UI — context menu, a panel, or
  only via the bundled TOW scripts? If it is script-only it does not exist for
  the audience it was built for.
- ? What happens on a PDF whose columns wrapped mid-row, or a header the
  inference does not recognise — silent wrong mapping, or a visible failure? —
  needs a counter: pastes attempted, pastes that produced profiles, and the top
  unmatched header strings. That list is a free backlog.

**C3. Share an entry and link it**
1. Create the entry once → move it to the catalogue's shared list
2. Link to it from every place it is used
- ⚠ Required by house rules for *every unit* ("Catalogues MUST define units as
  shared entries"), so this is not an advanced move — it is the default shape of
  correct data, executed by hand, per unit.
- ? `get_move_targets`/`move_to_key`
  ([editorStore.ts:1638-1760](stores/editorStore.ts#L1638-L1760)) do this and
  leave a link behind at the old path. Is that discoverable from the context
  menu, or must you already know it exists?

**C4. Run a script**
1. System → Scripts → pick one → Run
- ⚠ The page says "this feature is not finished"
  ([scripts/[id].vue:11](pages/scripts/[id].vue#L11)), then documents authoring
  in a `<pre>` block: create a `scripts` folder, write JS, bundle with rollup if
  you need imports. Every part of that is outside the stated audience.
- ⚠ Scripts are the only bulk-edit mechanism (C1), and they are gated behind
  being a programmer.

---

## D. The same work, driven by an AI agent (MCP)

The editor registers tools on `document.modelContext`
([webmcp.client.ts](plugins/webmcp.client.ts)); a local relay bridges them to
Claude Code/Cursor. The agent drives **the window you already have open** — not
a copy — so every flow above is the surface it acts on.

**D1. Connect an agent**
1. `claude mcp add --scope user webmcp -- npx @mcp-b/webmcp-local-relay`
2. `npm run dev`, open the page in Chrome, start the MCP client
- ⚠ Three documented failure modes, all silent: content blockers kill the
  WebSocket; a second relay instance joins the first as a *client* rather than
  failing, so a stale relay hijacks the port; and on Windows a drive-letter-case
  split in `~/.claude.json` puts the server in a project entry your session is
  not reading. Each is in the README because each was hit.
- ⚠ The relay accepts widget connections from any origin by default — any page
  you have open can offer tools to your agent until you pass `--widget-origin`.
- ? Tools register per tab. Two editor tabs = two sets of the same tool names
  with hash suffixes. Does the agent reliably pick the tab you are looking at?

**D2. Agent audits the catalogue** (works well today)
1. `nr_catalogues` to orient → `nr_check` for errors → `nr_find` to locate →
   `nr_read` for one entry
- ✓ FIXED: everything returned is projected to plain rows, because engine nodes
  carry `parent`/`catalogue`/`refs` back-references and `JSON.stringify` blows up
  on the cycle ([webmcp.client.ts:96-116](plugins/webmcp.client.ts#L96-L116)).
  The same back-reference set stops `nr_uninitialized`'s walk from re-walking the
  whole tree from every node.
- ✓ FIXED: tools read the store at call time, not at registration, so they follow
  what you have open as you navigate.
- ⚠ Read is the strong half, and it is the half humans already had. The agent's
  real advantage is `nr_find` (B1) — the query language humans cannot reach.

**D3. Agent makes an edit**
1. Agent finds the entries
2. Agent calls `nr_eval` with JavaScript
- ✓ FIXED: **one call is one undo entry.** `collapseUndo` records `undoStackPos`
  before the body and splices whatever the store actions pushed into a single
  composite ([webmcp.client.ts](plugins/webmcp.client.ts)). A 200-entry pass is
  one Ctrl+Z, so a wrong batch is reversible — which is what makes C1 safe to
  hand to an agent at all. It deliberately leaves the stack alone if the script
  called `undo()` itself, since then there is no contiguous run to collapse.
- ✓ FIXED: every store action is in scope unqualified (`set_field`, `add`,
  `remove`, …), enumerated off the store at call time so a newly added action is
  available without touching the plugin. Plus `find()` (the B1 query language),
  `row()`, and `$h` for all of `bs_helpers`.
- ✓ FIXED: the result carries the validation delta and the unsaved list, so a
  write that breaks something surfaces in the same call instead of waiting for
  the agent to remember `nr_check`.
- ⚠ Raw assignment is *discouraged, not prevented*. `node.name = "x"` still
  skips undo and `changed()`, leaving the file unmarked and unsaved while looking
  done; it can also leave plain JSON where a `Base` subclass belongs, invisible
  until something calls a method on it. The tool description says so in as many
  words, and `nr_uninitialized` still exists to find the wreckage — but the only
  thing standing between the agent and a silent corruption is the agent reading
  the description.
- → D4

**D4. Agent saves**
1. `nr_save`
- ⚠ Nothing stops an agent saving a catalogue it left mid-edit, or one that
  `nr_check` would have flagged — `nr_save` never consults errors. Combined with
  D3 (no undo entry), a bad batch is written to disk with no way back.
- ⚠ `nr_save` carries an `incrementRevision` argument and its whole three-mode
  vocabulary ("yes"/"no"/"github") for a number that no longer means anything
  (B4) — schema surface the model has to reason about for no outcome.

**D5. Tool-surface principles** *(what D3's shape was chosen against)*

- **Scripts, not one tool per action.** C1 is 200 edits; per-action tools make
  that 200 round trips. One script tool with the store in scope does it in one
  call, one undo entry, one reviewable body. Adopted in D3.
- **Writes go through the same door as the UI.** Store actions give undo,
  `changed()`, reindexing and revalidation for free. Every bug in this section
  traces to "there is a second door" (raw assignment), which is still open.
- **Don't ship helpers you already have.** `groupBy` and ~60 others are in
  [bs_helpers.ts](assets/shared/battlescribe/bs_helpers.ts); exposing the module
  as `$h` was the whole feature. It also avoids collisions — bs_helpers exports
  `add`, `remove` and `copy`, which are store action names too.
- **Enumerate, don't list.** Scope is built by walking the store, so it cannot
  drift from the store the way a hand-maintained list would.
- **Every write returns the validation delta**, so the agent self-corrects in
  the loop rather than on the next prompt.
- **Errors are instructions.** `pick()` listing the loaded catalogue names when
  the name does not match ([webmcp.client.ts:88](plugins/webmcp.client.ts#L88))
  is the pattern — the agent recovers without a round trip.
- ? Still no diff a human can review *before* a write lands. The undo stack is
  the only review surface and it is after the fact. A dry-run flag is not really
  available (the body has side effects by construction); the realistic version is
  the agent reporting `row()`s and waiting.
- ? Does the model actually reach for the store actions, or keep assigning
  directly despite the description? If the latter, the fix is a guard, not more
  prose. — needs a counter: `nr_eval` bodies touching `set_field`/`add`/`remove`
  vs. those that assign.

---

## E. Shipping it back to the community

**E1. Get changes back to the repo**
1. Save (B4)
2. …commit and push with an outside git client
- ✗ MISSING: **there is no push, commit, or pull-request flow anywhere in the
  codebase.** `github.ts` reads — refs, trees, blobs, zips, notifications — and
  never writes; there is no `/pulls` call in the project.
- ⚠ [system.vue:82](pages/system.vue#L82) tells the user "Send edits back as a
  pull request when you're done." Nothing implements that sentence. A first-time
  author reads it as a feature they will find later.
- ⚠ For GitHub-imported systems (A3) the files landed in browser storage from a
  zip, with no repo on disk to commit — so the promised path is not merely
  missing, it is unavailable by construction on that import route.
- ? Electron folder systems sitting in a real git checkout could at least shell
  out; `getFolderRemote` already reads the remote
  ([editorStore.ts:478](stores/editorStore.ts#L478)) to auto-discover GitHub
  integration, so the information is present and unused for this.

---

## F. Recovering from mistakes

**F1. Undo**
1. Ctrl+Z
- ⚠ The undo stack is closures in a non-persisted Pinia store
  ([editorStore.ts:203](stores/editorStore.ts#L203)) — it cannot be persisted and
  it is not. A refresh, crash, or Electron restart loses all undo history while
  the *edits* survive in the catalogue. Clipboard and selection go the same way;
  the open/collapsed tree does not (`editorUIState`, `open_state` both persist),
  so the app comes back looking identical with no history behind it.
- ⚠ Undo is per-session and global, not per-catalogue: with three catalogues
  open, Ctrl+Z walks back through whichever you touched last.
- → D3 (agent edits may not be on the stack at all)

**F2. Someone changed the file underneath you**
1. `git pull`, or another program writes the file
2. A ⚠ icon appears next to the catalogue name in the titlebar
- ⚠ The recovery is in the tooltip only: "You may want to reload the system
  through the Systems tab"
  ([catalogue.vue:31-35](pages/catalogue.vue#L31-L35)). No button, no link — and
  the reload it sends you to is the one that discards unsaved work without asking
  (A4). The two halves of this flow are set up to destroy exactly the work the
  warning is about.
- ? The watcher marks `isChangedOnDisk` per file, but the computed checks the
  catalogue *and* its imports and shows one icon. Can the user tell "the file I
  am editing changed" from "something I import changed"?

**F3. Close or refresh with unsaved changes**
1. Close the window / tab
2. Prompt: "You have unsaved changes that will be lost"
- ✓ FIXED: guarded in both Electron (`showMessageBox` + `closeWindow`) and web
  (`beforeunload`)
  ([catalogue.vue:267-288](pages/catalogue.vue#L267-L288)).
- ⚠ The listener is registered on the catalogue page and the catalogue-list page
  only. Closing the tab while on **Scripts**, **Search**, or **Systems**
  (`/system`) skips the prompt — and Scripts is a page you reach *in order to*
  make bulk edits, so the state at risk there is the largest.

---

## G. Dev & maintenance

**G1. Change shared engine code**
1. Edit under `assets/shared/` (a submodule shared with newrecruit.eu)
2. `npm run check` for the standalone checks
   ([bs_search_check.ts](assets/editor/bs_search_check.ts),
   [field_edit_stack_check.ts](stores/field_edit_stack_check.ts))
- ⚠ Checks exist for the two pieces where a bug loses work or lies silently (undo
  coalescing, the query parser) and nothing else. That is a deliberate floor, not
  coverage — a change to save, load, or the revision logic in B4/A4 has no check
  that fails.

**G2. ✗ MISSING: house-rule linting**
- The BSData conventions in the preamble are statically checkable — units shared,
  no shared wargear in the `.gst`, keywords as Category links, no hidden root
  entries. Nothing checks them; authors find out in review or from a player's
  GitHub issue. Same gap for agents: an agent can satisfy `nr_check` completely
  and still hand back data a reviewer rejects.

---

## Cross-cutting

Check these on every flow above; do not restate them per flow.

1. **Unsaved is the only state that matters.** Any path that unloads, reloads or
   navigates must either preserve `unsaved` or ask. A4 and F2 don't; F3 does.
2. **Both platforms.** Electron gets a real FS and a file watcher; web gets FSA
   in Chromium only and IndexedDB otherwise. Every save/load/watch step has three
   behaviours, and unsupported ones must name Chromium rather than just disabling
   a control (A1 does this).
3. **Session state is not persisted; UI state is.** Undo, redo, clipboard,
   selection and filter die on refresh; open/collapsed tree and settings survive.
   Assume anything not written to disk is gone.
4. **Anything that walks every catalogue is a stall.** `loadAll` (B1 search page),
   `fix_profiles` (B2), full validation. Systems run to hundreds of files: show
   progress, or don't trigger it from a keystroke.
5. **Agents share the human's session.** Same store, same undo stack, same
   unsaved flags, same window — an agent flow that bypasses the store (D3)
   corrupts the human's flows, not a sandbox.
6. **The audience does not write code.** Any capability reachable only through a
   script, a bundler, or a JSON file does not exist for the people this editor is
   for (C1, C4, D5).
