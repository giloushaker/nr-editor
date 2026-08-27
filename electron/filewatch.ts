import type { Stats } from "fs";
const chokidar = require("chokidar");

const chokidar_watchers = {} as Record<string, any>;
const watchers = {} as Record<string, Record<string, (p: string, stats: Stats) => unknown>>;
export let persistent = false;

// A save we made ourselves still fires change events; ignore them for a moment after the write
// so the editor does not report its own save as an external change.
const SELF_WRITE_GRACE_MS = 2000;
const self_writes = {} as Record<string, number>;
export function mark_self_write(path: string) {
  self_writes[fix_path(path)] = Date.now() + SELF_WRITE_GRACE_MS;
}
export function fix_path(str: string) {
  return str.replace(/\\/g, "/");
}
export function initialize(path: string | number) {
  if (chokidar_watchers[path]) {
    return chokidar_watchers[path];
  }
  // awaitWriteFinish: one slow write emits several OS events, and a single grace window cannot
  // cover events that keep arriving; waiting for the size to settle collapses them into one.
  const watcher = chokidar.watch(path, {
    persistent,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });
  watcher.on("change", (p: string, stats: Stats) => {
    if (Date.now() < (self_writes[fix_path(p)] || 0)) return;
    if (path in watchers) {
      for (const cb of Object.values(watchers[path])) {
        cb(p, stats);
      }
    }
  });
  chokidar_watchers[path] = watcher;
}
export function cleanup(path: string) {
  if (path in chokidar_watchers) {
    chokidar_watchers[path].close();
    delete chokidar_watchers[path];
  }
}
export function add_watcher(
  id: string,
  watcher_id: string | number,
  callback: (path: string, stats: Stats) => unknown
) {
  id = fix_path(id);
  if (!(id in watchers)) {
    watchers[id] = {};
    initialize(id);
  }
  watchers[id][watcher_id] = callback;
}
export function remove_watcher(id: string, watcher_id: string | number) {
  id = fix_path(id);
  if (watchers[id]) {
    if (watchers[id][watcher_id]) {
      delete watchers[id][watcher_id];
    }
    if (Object.values(watchers[id]).length === 0) {
      cleanup(id);
      delete watchers[id];
    }
  }
}
export function get_watchers(watcher_id: string) {
  const result = [];
  for (const id in watchers) {
    const obj = watchers[id];
    if (watcher_id in obj) {
      result.push(id);
    }
  }
  return result;
}
export function remove_watchers(watcher_id: any) {
  for (const id in watchers) {
    remove_watcher(id, watcher_id);
  }
}
export function get_watcher_count() {
  return Object.values(chokidar_watchers).length;
}
