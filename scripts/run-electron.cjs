#!/usr/bin/env node
// Dev launcher for `npm run electron`.
//
// Chromium refuses to start when its SUID helper exists but isn't root-owned with
// mode 4755, which is always the case for node_modules/electron/dist/chrome-sandbox
// on a developer machine. The usual fallback (unprivileged user namespaces) is also
// closed on Ubuntu 24.04+, where kernel.apparmor_restrict_unprivileged_userns is 1.
//
// So pass --no-sandbox, but only on Linux and only here: packaged builds go through
// electron-builder and keep their sandbox.
const { spawn } = require("child_process");
const electron = require("electron");

const args = [".output/public", ...process.argv.slice(2)];
if (process.platform === "linux" && !args.includes("--no-sandbox")) {
  args.push("--no-sandbox");
}

spawn(electron, args, { stdio: "inherit" }).on("exit", (code) => process.exit(code ?? 0));
