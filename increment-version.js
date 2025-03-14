const fs = require("fs");

function incrementObjectVersion(json) {
    let [_, major, minor, patch] = json.version.match(/([0-9]+)[.]([0-9]+)[.]([0-9]+)/);
    if (process.argv.includes("--major")) {
        major = (Number(major) || 0) + 1;
        minor = 0;
        patch = 0;
    }
    else if (process.argv.includes("--minor")) {
        minor = (Number(minor) || 0) + 1;
        patch = 0;
    }
    else {
        patch = (Number(patch) || 0) + 1;
    }
    json.version = `${major}.${minor}.${patch}`;
    return json.version
}

function incrementJsonFileVersion(path) {
    const json = JSON.parse(fs.readFileSync(path));
    const version = incrementObjectVersion(json);
    fs.writeFileSync(path, JSON.stringify(json, null, 2));
    return version
}
function setJsonFileVersion(path, version) {
    const json = JSON.parse(fs.readFileSync(path));
    json.version = version
    fs.writeFileSync(path, JSON.stringify(json, null, 2));
}
const newVersion = incrementJsonFileVersion("./package.json");
setJsonFileVersion("./package-lock.json", newVersion);
