"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const target = process.argv[2] && path.resolve(process.argv[2]);
if (!target) throw new Error("Usage: node tools/create-demo-host.cjs /path/to/new/cordova/www");
// Never replace a Construct export's bootstrap. This assembles a separate generic demo.
if (fs.existsSync(path.join(target, "supereo-demo-installed"))) throw new Error("Destination already assembled; choose a fresh demo host.");
if (fs.existsSync(path.join(target, "index.html"))) throw new Error("Destination contains index.html. Preserve the generated host's www directory and choose a fresh empty directory.");
fs.mkdirSync(path.join(target, "lib"), { recursive: true });
for (const name of ["style.css", "patterns.js", "demo.js"]) fs.copyFileSync(path.join(root, "demo", name), path.join(target, name));
fs.copyFileSync(path.join(root, "lib/core.js"), path.join(target, "lib/core.js"));
const html = fs.readFileSync(path.join(root, "demo/index.html"), "utf8")
  .replace('<script defer src="../lib/core.js">', '<script defer src="cordova.js"></script><script defer src="lib/core.js">')
  .replace('<a href="../docs/INSTALLATION.md">Installation &amp; exports ↗</a>', '<span>See the source package installation guide.</span>');
fs.writeFileSync(path.join(target, "index.html"), html);
fs.writeFileSync(path.join(target, "supereo-demo-installed"), "Supereo Haptics 1.0.0 generic Cordova demo\n");
console.log("Assembled generic demo at " + target + ". Install the native bridge and prepare/build the host separately.");
