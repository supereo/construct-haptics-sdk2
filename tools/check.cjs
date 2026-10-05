"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const Ajv = require("ajv/dist/2020");
const addFormats = require("ajv-formats");
const { expectedOutputs } = require("./prepare-runtime.cjs");
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
const native = read("native/cordova-plugin-supereo-haptics/package.json");
const pluginXML = fs.readFileSync(path.join(root, "native/cordova-plugin-supereo-haptics/plugin.xml"), "utf8");
assert.ok(pluginXML.includes('id="' + native.name + '" version="' + native.version + '"'), "Native package/XML identity mismatch");
assert.equal(new Set(addon["file-list"]).size, addon["file-list"].length);
for (const file of addon["file-list"]) {
  assert.ok(!file.includes("..") && !path.isAbsolute(file), "Unsafe package path");
  assert.ok(fs.statSync(path.join(root, "addon", file)).isFile(), "Missing addon file: " + file);
}
for (const file of addon["editor-scripts"]) assert.ok(addon["file-list"].includes(file));
for (const [file, expected] of Object.entries(expectedOutputs(root))) assert.equal(fs.readFileSync(path.join(root, file), "utf8"), expected, "Stale generated runtime/DOM core: " + file);
console.log("Identity, versions, paths, and shared-source consistency PASS.");
