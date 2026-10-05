"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { captureAddonRegistration, bundleRegisteredRuntime, runtimeModules } = require("./helpers/construct-loader.cjs");
const { createConstructFixture } = require("./helpers/construct-fixture.cjs");
const root = path.resolve(__dirname, "..");

function addonScripts() {
  const metadata = JSON.parse(fs.readFileSync(path.join(root, "addon/addon.json"), "utf8"));
  return Object.fromEntries(metadata["file-list"].filter(name => name.endsWith(".js")).map(name => ["addon/" + name, fs.readFileSync(path.join(root, "addon", name), "utf8")]));
}

test("editor registration loads the actual runtime entry and declares its only DOM script", async () => {
  const registration = captureAddonRegistration();
  assert.equal(registration.pluginId, "Supereo_Haptics");
  assert.equal(registration.runtimeMainScript, "c3runtime/main.js");
  assert.deepEqual(registration.domSideScripts, ["c3runtime/domSide.js"]);
  const bundle = await bundleRegisteredRuntime(undefined, registration);
  const expectedFiles = ["main.js", ...runtimeModules].map(name => "scripts/plugins/Supereo_Haptics/c3runtime/" + name).sort();
  assert.deepEqual(bundle.mappedFiles.sort(), expectedFiles);
  assert.deepEqual(bundle.resolvedFiles.sort(), expectedFiles);
});

test("the 1.0.0-style custom core import reproduces file-map-resolver failure despite the file being present", async () => {
  const sources = addonScripts();
  // The original released entry imported this eighth file. Reconstructing that
  // import keeps this regression self-contained without shipping the bad addon.
  sources["addon/c3runtime/main.js"] = 'import "./haptics-core.js";\n' + sources["addon/c3runtime/main.js"];
  sources["addon/c3runtime/haptics-core.js"] = fs.readFileSync(path.join(root, "lib/core.js"), "utf8");
  await assert.rejects(bundleRegisteredRuntime(sources), error => /file-map-resolver: cannot find the file "scripts\/plugins\/Supereo_Haptics\/c3runtime\/haptics-core\.js"/.test(error.message));
});

test("an arbitrary helper import is rejected by the same restricted map", async () => {
  const sources = addonScripts();
  sources["addon/c3runtime/main.js"] += '\nimport "./unregistered-helper.js";';
  sources["addon/c3runtime/unregistered-helper.js"] = "globalThis.unregisteredHelperWasRun = true;";
  await assert.rejects(bundleRegisteredRuntime(sources), error => /file-map-resolver.*unregistered-helper\.js/.test(error.message));
});

for (const worker of [false, true]) test(`registered entry initializes bundled core in ${worker ? "worker" : "main thread"} runtime and DOM contexts`, async t => {
  const f = await createConstructFixture({ worker, properties: [true, 1, false, true, 0, 0, 250] });
  t.after(() => f.release());
  assert.equal(vm.runInContext("typeof SupereoHapticsCore.validatePattern", f.runtimeContext), "function");
  assert.equal(vm.runInContext("typeof SupereoHapticsCore.validatePattern", f.domContext), "function");
  assert.deepEqual(f.registration.domSideScripts, ["c3runtime/domSide.js"]);
  assert.ok(f.bundledRuntime.resolvedFiles.every(file => !file.includes("haptics-core.js")));
  await f.action("RegisterPattern", "loading-check", JSON.stringify({ version: 1, events: [{ type: "transient", timeMs: 0, intensity: 1 }] }));
  await f.action("PlayPattern", "loading-check");
  assert.equal(JSON.parse(f.expression("LastResultJSON")).accepted, true);
});
