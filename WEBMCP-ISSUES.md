# WebMCP issues from the Ogre Kingdoms Renegades v2.0 session (2026-08-29)

Everything hit while implementing one TOW fork via the MCP, however minor. Grouped by what to do about it.
Code refs are `plugins/webmcp.client.ts` unless stated.

## Status (2026-08-29, after the first fix pass in plugins/webmcp.client.ts)

Done: A1 (exact/unique matching, ambiguity throws -- pick/pickOne/findSystem/load only), A2 (nr_save on the gst),
A4 (scriptResult walks any object, rows anything with a parent), A5/C25 (nr_eval description short; API in
nr_docs "editor/eval"), A7/D30 (results carry errors:{new,fixed} only when something changed), B8 (json(),
nr_read raw:true/depth), B9 partly (tree(), json depth/exclude/collapse, catalogue read = table of contents),
B13 (docs), C15-C24 (nr_conventions / nr_docs "editor/conventions" + "editor/writing"), C23 (nr_fields lists
profile types by name), C26 (briefing shortened, readFirst list), D22/D27/D28 (comment-tagged runs collapse in
nr_read self/target/modifiedBy and json(); expand:true).

Dropped: B10 nr_fork -- copying files is not how data should be made; forks are the homebrew exception.

Also done: A3 (store clears the unsaved flag when undo returns to the saved position), A6 (doc: the type is
categoryEntryLink and targetId: does find it; quoting rule for ':' added to nr_find).

Still open: B11 nr_diff, B12 per-catalogue force reload, B14 schema-aware add(), D29
nr_systems compactness, E31 nr_apply(spec), and the nr_eval result size cap (spill to file) -- paginate.

## A. Bugs (fix first)

1. **Catalogue matching is substring** — `pick()` :111 and `findSystem()` :332. `"Renegades v2.0"` matched both the Skaven and Ogre forks; three edits went into Skaven before `undo()`. Wants: exact id → exact name → unique substring, and **throw on ambiguity** listing the hits. Same in `find(query, catalogue)` inside eval and the `catalogue` arg of every tool.
2. **`nr_save` fails on the game-system file** — :1409 `store().gameSystems[target.gameSystemId]`; a gst has no `gameSystemId`. Use `target.gameSystemId ?? target.id`. (`$store.save_catalogue()` from eval wrote the file but returned `false` — check why.)
3. **`undo()` leaves the catalogue flagged unsaved** when the stack returns to the saved position (Skaven showed `unsaved` after a full revert; `nr_load_system force` then refuses).
4. **eval result serialisation throws "circular structure"** — `scriptResult()` :850 only unwraps `Base` instances and plain objects; a non-Base object (e.g. an entry of `node.refs`, a characteristic) inside the returned value hits `JSON.stringify` and dies with no hint of which key. Strip `parent`/`catalogue`/`target`/`refs`/`links` generically, or `row()` anything that has a `parent`.
5. **Long tool descriptions get truncated by the client** — the `nr_eval` WRITING section (the only place the write API is documented) was cut off. Keep descriptions short; move reference text into `nr_docs` pages.
6. **`nr_find` quirks**: `Faction: Skaven is:categoryEntry` → 0 hits (colon in a bare word breaks parsing; `is:categoryEntry Faction` works). `targetId:<id>` does not match `categoryLinks`. Document quoting (`name="Faction: Skaven"`) and make `targetId:` cover every link kind.
7. **Every eval/script result appends `errors: N` for the whole system** (18 pre-existing in other files). Only the delta matters; show `errors: +1 (Ogre… : comment todo)` or nothing.

## B. Missing tools / capabilities (why I reached for bash + python)

8. **Raw node JSON.** `nr_read` labels modifiers/conditions (good for reading) but I needed the file-shape (`type/field/scope/childId/value/repeats`) to write the same thing. Wrote a 40-line `raw()` dumper twice. Expose `json(node)` in eval (goodJsonKeys/arrayKeys already exist in bs_main) and `nr_read … raw:true`.
9. **No size control on reads.** Two eval results (427 KB, 85 KB) spilled to disk; the big one was Tyrant's imported Magic Items subtree. Need `depth`, `exclude:[names]`, `maxNodes`, and a compact one-line-per-node tree mode (the summary I ended up writing myself: `name {pts} [min/max] <cats> / rules: …`).
10. **No fork tool.** Copied the JSON with python, patched id/name/author, then `nr_load_system force` re-read 52 files. Want `nr_fork(catalogue, newName, {keepIds})` that also adds the gst faction category and retargets the fork's Faction links.
11. **No diff tool.** Reviewing the fork against its base = my own filtered dump + eyeballing. Want `nr_diff(catalogue, base)` (names/costs/constraints/rules per unit).
12. **No "load one catalogue"** without unsaved-check refusing the whole system; `nr_load_system catalogue:` exists but `force` refuses if *anything* is unsaved — should be per-catalogue.
13. **Verification** — diagnostics already cover dangling links (`no-target`, `bad-link-target`, `id-not-exist`); I did not know that and re-checked on disk with python. → documentation (say so in `nr_diagnosis` description and the briefing).
14. **Schema-aware `add`.** 140 hand-composed nodes; a bad `field`/`scope`/`typeId` is only caught later by a diagnostic (if at all). `add()` should validate against the same tables `nr_fields` reports and reject at write time.

## C. Discovery / documentation (the biggest cost: ~half the session)

Facts I had to reverse-engineer that are pure convention. Some are TOW-specific — the fix is not a TOW page but a **generic, data-derived "conventions" report** (`nr_conventions(catalogue)` or a section of `nr_docs`) that samples the loaded system and states:

15. Where rules attach (TOW: `unit.infoGroups["Special Rules"].infoLinks`, not on the model, not `rules`) — count the patterns in the data and report the dominant one.
16. How parameterised rules are written (TOW: link to `Impact Hits` + `append "(2)"` on `name`).
17. Entry `type` per role (unit / model / upgrade / mount / **crew** — the Unit Strength script skipped my new crews typed `model`).
18. Root structure (units = `sharedSelectionEntries`, roots = `entryLinks`), category naming, id style.
19. Faction gating: gst `Faction: X` categories on root links; shared catalogues (Magic Items, Lores) gate on `ancestor is Faction: X`; text overrides = own hidden profile + hidden link modifier (Skaven v2 precedent). Which scopes are valid **from a profile inside a linked infoGroup** — unknown, I side-stepped by cloning the spells into the fork. `nr_fields` should say.
20. Mount conventions: ridden-monster mounts carry delta profiles (`T=(+1) W=(+4)`), Howdah mounts a full statline.
21. Per-N caps: canonical raw JSON of one "0-1 per 1,000 points" category (max 0 in force + repeat modifiers) — one example in a recipe page would have removed all doubt.
22. Script-generated boilerplate: matched-play / Unit Strength nodes are on every root link (6 modifiers + 3 constraints each). They carry `comment` tags ("Grand melee", "Battle March points", "Unit strenght script"). Generic fix: `nr_read` groups nodes by `comment` and collapses runs (`9 nodes tagged Grand melee/Battle March/Unit Strength`), expanded only with `expand:true`.
23. Profile types: `nr_fields` should list profile types with their characteristic names. Adding a profile can work off `typeName` + characteristic names because the "Fix profiles" change-hook repairs typeIds — **say so** in the write docs; I looked ids up by hand.
24. Fork provenance: nothing records "forked from X, keeps base ids"; catalogue comment or `nr_catalogues` row. Also which catalogues already carry a toggle for the thing being forked (the base Ogres had 15 `Renegades (Square Based)` conditions to bake in; the gst entry has 231 mentions).
25. Write-API doc page: `add/edit/remove/set_field/merge/move`, what `add` returns, `edit` on cost objects, how to add a characteristic, how to set a constraint value — all discovered by trial.
26. Briefing is long; the "two findings that are usually not the answer" and "TELL US WHAT IS MISSING" sections could be one line each. The index of docs pages should mark which 3 to read for a data-authoring job.

## D. Verbosity

27. `nr_read` on a catalogue root: 300 rows with `hasChildren: true` each; want per-array counts + names.
28. `nr_read` on a root link: the full 6-modifier matched-play block every time (see 22).
29. `nr_systems`/`nr_catalogues`: 130 AoS rows when working on TOW; one line per system unless asked.
30. `nr_load_system` / eval footers repeat `errors`/`unsaved` for every call (see 7).

## E. Higher level

31. **`nr_apply(spec)`** — write intent (`{unit, rules:[+"Ogre Club"], costs:{…}, options:[…]}`) and let the editor produce the right infoLink/modifier shapes. Each unit took ~40 lines of hand-built `nr_eval` JSON; a data dev could read a spec, not that.
32. Per-call undo is good; make the *ambiguity* failure (A1) impossible so undo is rarely needed.

## Worked well (keep)

- `nr_docs` briefing's "read before you write" rules; `nr_read` `modifiedBy`; `owner()`/`row()`/`label()` in eval; one call = one undo entry; result footer showing `unsaved` catalogues; `nr_find` bracket queries (`is:condition childId:…`) once the syntax was known; scripts runnable via `nr_script_run` (Unit Strength re-run after edits).
