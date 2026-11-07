// Icon file naming and the delete rule: readable names, an id only on a clash, never deleting another node's file.
import assert from "node:assert/strict";

import { iconFilePath, ownFiles, type IconOwner } from "./icon_files";

const hq: IconOwner = { kind: "category", keys: ["cat-hq", "HQ"] };
const lordOfWarSpaced: IconOwner = { kind: "category", keys: ["c-bl1", "Lord of War"] };
const lordOfWarHyphen: IconOwner = { kind: "category", keys: ["c-bl2", "Lord-of-War"] };
const titans: IconOwner = { kind: "category", keys: ["c-low", "Lord of War: Titans"] };

// Readable names by default, slugged like NR compares them
assert.equal(iconFilePath(hq, [lordOfWarSpaced], "webp"), "icons/categories/hq.webp");
assert.equal(iconFilePath(titans, [], "png"), "icons/categories/lord-of-war-titans.png");
assert.equal(iconFilePath({ kind: "system", keys: ["sys", "system"] }, [], "svg"), "icons/system.svg");

// Two names that compare the same: the second one written gets its id, so neither overwrites the other
assert.equal(iconFilePath(lordOfWarHyphen, [lordOfWarSpaced, hq], "webp"), "icons/categories/c-bl2.webp");
// A name with nothing to slug falls back to the id
assert.equal(iconFilePath({ kind: "force", keys: ["f-1", "!!!"] }, [], "webp"), "icons/forces/f-1.webp");

const files = ["icons/categories/hq.webp", "icons/categories/HQ.png", "icons/categories/lord-of-war.webp", "icons/categories/c-bl2.webp", "icons/categories/shared.png", "icons/system.svg", "icons/notes.txt"];

// A node's own files: every spelling of its name, and its id
assert.deepEqual(ownFiles(files, hq, [lordOfWarSpaced, lordOfWarHyphen], new Set()), ["icons/categories/hq.webp", "icons/categories/HQ.png"]);
assert.deepEqual(ownFiles(files, lordOfWarHyphen, [lordOfWarSpaced, hq], new Set()), ["icons/categories/c-bl2.webp"]);
// A file both same-named nodes match by name belongs to neither, so removing one never takes the other's icon
assert.ok(!ownFiles(files, lordOfWarSpaced, [lordOfWarHyphen, hq], new Set()).includes("icons/categories/lord-of-war.webp"));
// A file an icon attribute points at is never deleted
assert.deepEqual(ownFiles(files, hq, [], new Set(["icons/categories/hq.webp"])), ["icons/categories/HQ.png"]);
// Other kinds and loose files are never a category's
assert.deepEqual(ownFiles(files, { kind: "category", keys: ["x", "system"] }, [], new Set()), []);

console.log("icon_files_check: ok");
