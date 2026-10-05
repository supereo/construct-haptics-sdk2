"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { zipSync, strToU8 } = require("fflate");
const { minify } = require("terser");
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
function walk(dir, prefix = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const name = prefix + entry.name;
    return entry.isDirectory() ? walk(path.join(dir, entry.name), name + "/") : [name];
  });
}
function archive(files) {
  return zipSync(Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([name, data]) => [name, [data, { mtime: new Date(2026, 0, 1, 0, 0, 0) }]])), { level: 9 });
}
(async () => {
  fs.mkdirSync(dist, { recursive: true });
  const core = fs.readFileSync(path.join(root, "lib/core.js"));
  for (const destination of ["addon/c3runtime/haptics-core.js", "native/cordova-plugin-supereo-haptics/www/core.js"]) {
    fs.mkdirSync(path.dirname(path.join(root, destination)), { recursive: true });
    fs.writeFileSync(path.join(root, destination), core);
  }
  const metadata = JSON.parse(fs.readFileSync(path.join(root, "addon/addon.json"), "utf8").replace(/^\uFEFF/, ""));
  const files = {};
  for (const name of metadata["file-list"]) {
    const full = path.join(root, "addon", name);
    let content = fs.readFileSync(full);
    if (name.endsWith(".js")) {
      const result = await minify(content.toString(), { module: name.startsWith("c3runtime/") && !["c3runtime/domSide.js", "c3runtime/haptics-core.js"].includes(name), compress: true, mangle: true, format: { comments: /^!/ } });
      if (typeof result.code !== "string") throw new Error("Minification produced no code: " + name);
      content = strToU8(result.code);
    }
    files[name] = content;
  }
  const version = require(path.join(root, "package.json")).version;
  fs.writeFileSync(path.join(dist, "Supereo_Haptics-" + version + ".c3addon"), archive(files));
  const nativeRoot = path.join(root, "native/cordova-plugin-supereo-haptics");
  const nativeFiles = Object.fromEntries(walk(nativeRoot).map(name => ["cordova-plugin-supereo-haptics/" + name, fs.readFileSync(path.join(nativeRoot, name))]));
  fs.writeFileSync(path.join(dist, "cordova-plugin-supereo-haptics-" + version + ".zip"), archive(nativeFiles));
  const pack = spawnSync("npm", ["pack", "--ignore-scripts", "--cache", path.join(root, ".cache/npm"), "--pack-destination", dist], { cwd: nativeRoot, encoding: "utf8" });
  if (pack.status !== 0) throw new Error(pack.stderr || "npm pack failed");
  const included = ["addon", "lib", "native", "tools", "tests", "docs", "demo", "vendor", "examples"];
  const source = {};
  for (const dir of included) {
    if (!fs.existsSync(path.join(root, dir))) continue;
    for (const name of walk(path.join(root, dir))) source[dir + "/" + name] = fs.readFileSync(path.join(root, dir, name));
  }
  for (const name of ["README.md", "LICENSE", "package.json", "package-lock.json", ".gitignore"]) source[name] = fs.readFileSync(path.join(root, name));
  fs.writeFileSync(path.join(dist, "supereo-haptics-source-" + version + ".zip"), archive(source));
  const artifacts = fs.readdirSync(dist).filter(name => /\.(c3addon|zip|tgz)$/.test(name)).sort();
  const checksums = artifacts.map(name => crypto.createHash("sha256").update(fs.readFileSync(path.join(dist, name))).digest("hex") + "  " + name).join("\n") + "\n";
  fs.writeFileSync(path.join(dist, "SHA256SUMS"), checksums);
  console.log("Packaged " + artifacts.join(", ") + "; SHA256SUMS written.");
})().catch(error => { console.error(error); process.exitCode = 1; });
