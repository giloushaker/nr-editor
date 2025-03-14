const fs = require("fs");

const packagePath = "./package.json"
const json = JSON.parse(fs.readFileSync(packagePath))
let [_, major, minor, patch] = json.version.match(/([0-9]+)[.]([0-9]+)[.]([0-9]+)/)
if (process.argv.includes("--major")) {
    major = (Number(major) || 0) + 1
    minor = 0;
    patch = 0;
}
else if (process.argv.includes("--minor")) {
    minor = (Number(minor) || 0) + 1
    patch = 0;
}
else {
    patch = (Number(patch) || 0) + 1
}
json.version = `${major}.${minor}.${patch}`
fs.writeFileSync(packagePath, JSON.stringify(json, null, 2));
