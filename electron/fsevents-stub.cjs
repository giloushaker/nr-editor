// chokidar wraps `require('fsevents')` in a try/catch and its canUse() check is
// `fsevents && ...`, so a falsy value makes it fall back to fs.watch -- the exact path
// Linux and Windows already take, since fsevents is a darwin-only optional dependency.
// On macOS the real package is installed and the bundler chokes trying to parse its
// fsevents.node binary (UNLOADABLE_DEPENDENCY), and electron-builder does not ship
// node_modules anyway, so the native module could never load from the packaged app.
// Aliasing the id here keeps all three platforms on the same watcher.
module.exports = undefined;
