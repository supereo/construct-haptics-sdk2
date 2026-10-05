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
  assert.match(fs.readFileSync(path.join(root, "addon/c3runtime/main.js"), "utf8"), /^\s*import\s*["']\.\/haptics-core\.js["'];/, "the mapped validator is the first runtime import");
  assert.deepEqual(registration.additionalRuntimeScripts, ["c3runtime/haptics-core.js"]);
  assert.deepEqual(registration.domSideScripts, ["c3runtime/domSide.js"]);
  const metadata = JSON.parse(fs.readFileSync(path.join(root, "addon/addon.json"), "utf8"));
  assert.ok(registration.additionalRuntimeScripts.every(filename => metadata["file-list"].includes(filename)), "each SDK-registered runtime helper is included in the distributable");
  const bundle = await bundleRegisteredRuntime(undefined, registration);
  const expectedFiles = ["main.js", ...runtimeModules, "haptics-core.js"].map(name => "scripts/plugins/Supereo_Haptics/c3runtime/" + name).sort();
  assert.deepEqual(bundle.mappedFiles.sort(), expectedFiles);
  assert.deepEqual(bundle.resolvedFiles.sort(), expectedFiles);
});

test("editor registration declares the separate native bridge as a pinned Cordova dependency", () => {
  const registration = captureAddonRegistration();
  assert.equal(registration.cordovaPluginReferences.length, 1);
  const [reference] = registration.cordovaPluginReferences[0];
  assert.equal(reference.id, "cordova-plugin-supereo-haptics");
  assert.equal(reference.platform, "all");
  assert.match(reference.version, /^https:\/\/raw\.githubusercontent\.com\/supereo\/construct-haptics-sdk2\/[a-f0-9]{40}\/dist\/cordova-plugin-supereo-haptics-1\.0\.0\.tgz$/);
});

test("the 1.0.0-style custom core import reproduces file-map-resolver failure despite the file being present", async () => {
  const sources = addonScripts();
  // The original released entry imported this eighth file. Reconstructing that
  // import keeps this regression self-contained without shipping the bad addon.
  sources["addon/c3runtime/main.js"] = ["haptics-core", "plugin", "type", "instance", "conditions", "actions", "expressions"].map(name => `import "./${name}.js";`).join("\n");
  sources["addon/c3runtime/haptics-core.js"] = fs.readFileSync(path.join(root, "lib/core.js"), "utf8");
  const originalRegistration = captureAddonRegistration(sources);
  originalRegistration.additionalRuntimeScripts = [];
  await assert.rejects(bundleRegisteredRuntime(sources, originalRegistration), error => /file-map-resolver: cannot find the file "scripts\/plugins\/Supereo_Haptics\/c3runtime\/haptics-core\.js"/.test(error.message));
});

test("an arbitrary helper import is rejected by the same restricted map", async () => {
  const sources = addonScripts();
  sources["addon/c3runtime/main.js"] += '\nimport "./unregistered-helper.js";';
  sources["addon/c3runtime/unregistered-helper.js"] = "globalThis.unregisteredHelperWasRun = true;";
  await assert.rejects(bundleRegisteredRuntime(sources), error => /file-map-resolver.*unregistered-helper\.js/.test(error.message));
});

test("the editor fixture captures the actual Cordova reference API payload", () => {
  const sources = { "addon/plugin.js": `
    const Plugin = class extends SDK.IPluginBase {
      constructor() {
        super("FixturePlugin");
        this._info.SetRuntimeModuleMainScript("c3runtime/main.js");
        this._info.AddCordovaPluginReference({ id: "test-only-plugin", version: "1.2.3" });
      }
    };
    Plugin.Register("FixturePlugin", Plugin);
  ` };
  const registration = captureAddonRegistration(sources);
  assert.deepEqual(registration.cordovaPluginReferences, [[{ id: "test-only-plugin", version: "1.2.3" }]]);
});

for (const worker of [false, true]) test(`registered entry initializes mapped runtime core and embedded DOM core in ${worker ? "worker" : "main thread"} contexts`, async t => {
  const f = await createConstructFixture({ worker, properties: [true, 1, false, true, 0, 0, 250] });
  t.after(() => f.release());
  assert.equal(vm.runInContext("typeof SupereoHapticsCore.validatePattern", f.runtimeContext), "function");
  assert.equal(vm.runInContext("typeof SupereoHapticsCore.validatePattern", f.domContext), "function");
  assert.deepEqual(f.registration.domSideScripts, ["c3runtime/domSide.js"]);
  assert.ok(f.bundledRuntime.resolvedFiles.includes("scripts/plugins/Supereo_Haptics/c3runtime/haptics-core.js"));
  await f.action("RegisterPattern", "loading-check", JSON.stringify({ version: 1, events: [{ type: "transient", timeMs: 0, intensity: 1 }] }));
  await f.action("PlayPattern", "loading-check");
  assert.equal(JSON.parse(f.expression("LastResultJSON")).accepted, true);
});
