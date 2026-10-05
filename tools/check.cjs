"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const Ajv = require("ajv/dist/2020");
const addFormats = require("ajv-formats");
const root = path.resolve(__dirname, "..");
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), "utf8").replace(/^\uFEFF/, ""));
for (const [file, schema] of [["addon/addon.json", "plugin.addon.schema.json"], ["addon/aces.json", "aces.schema.json"], ["addon/lang/en-US.json", "plugin.lang.schema.json"]]) {
  // Official schemas currently reuse an $id; isolate their registries without changing them.
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(read("vendor/construct-sdk/" + schema));
  assert.ok(validate(read(file)), file + ": " + JSON.stringify(validate.errors));
  console.log("Official schema PASS: " + file);
}
const addon = read("addon/addon.json");
assert.equal(addon.id, "Supereo_Haptics");
assert.equal(addon.name, "Supereo Haptics");
assert.equal(addon["sdk-version"], 2);
assert.equal(addon.version, read("package.json").version + ".0");
assert.equal(read("native/cordova-plugin-supereo-haptics/package.json").version, read("package.json").version);
assert.equal(new Set(addon["file-list"]).size, addon["file-list"].length);
for (const file of addon["file-list"]) {
  assert.ok(!file.includes("..") && !path.isAbsolute(file), "Unsafe package path");
  assert.ok(fs.statSync(path.join(root, "addon", file)).isFile(), "Missing addon file: " + file);
}
for (const file of addon["editor-scripts"]) assert.ok(addon["file-list"].includes(file));
const core = fs.readFileSync(path.join(root, "lib/core.js"));
for (const file of ["addon/c3runtime/haptics-core.js", "native/cordova-plugin-supereo-haptics/www/core.js"]) assert.ok(core.equals(fs.readFileSync(path.join(root, file))), "Stale generated shared validator: " + file);
console.log("Identity, versions, paths, and shared-source consistency PASS.");
