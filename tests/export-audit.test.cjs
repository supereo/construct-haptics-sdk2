"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { auditExport, parseImports } = require("../tools/audit-export.cjs");
const root = path.resolve(__dirname, "..");

function exportFixture(t, worker = false) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "supereo-export-audit-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const www = path.join(directory, "www");
  const runtime = path.join(www, "scripts/plugins/Supereo_Haptics/c3runtime");
  fs.mkdirSync(runtime, { recursive: true });
  for (const name of fs.readdirSync(path.join(root, "addon/c3runtime"))) fs.copyFileSync(path.join(root, "addon/c3runtime", name), path.join(runtime, name));
  fs.writeFileSync(path.join(www, "scripts/c3main.js"), 'import "./plugins/Supereo_Haptics/c3runtime/main.js";');
  if (worker) fs.writeFileSync(path.join(www, "scripts/workermain.js"), 'import "./c3main.js";');
  fs.writeFileSync(path.join(www, "index.html"), '<script type="module" src="scripts/' + (worker ? 'workermain.js' : 'c3main.js') + '"></script>');
  return { directory, www, runtime };
}

test("the import audit parses static imports and re-exports without treating strings, comments or dynamic imports as static", () => {
  const imports = parseImports('/* import "./fake.js"; */ const text = \'import "./fake.js"\'; import "./a.js"; export { value } from "./b.js"; export * from "./c.js"; import("./dynamic.js");');
  assert.deepEqual(imports.map(item => item.specifier), ["./a.js", "./b.js", "./c.js"]);
});

for (const worker of [false, true]) test(`filesystem fixture audits the shipping registered runtime graph for ${worker ? "worker" : "main-thread"} shape and detects a removed helper`, t => {
  const fixture = exportFixture(t, worker);
  let report = auditExport(fixture.directory);
  assert.equal(report.ok, true);
  assert.equal(report.localStaticImports, worker ? 9 : 8);
  assert.equal(report.nativeBridge.status, "absent");
  fs.unlinkSync(path.join(fixture.runtime, "haptics-core.js"));
  report = auditExport(fixture.directory);
  assert.equal(report.ok, false);
  assert.deepEqual(report.errors, [{ kind: "missing-import", importer: "scripts/plugins/Supereo_Haptics/c3runtime/main.js", specifier: "./haptics-core.js", line: 1, target: "scripts/plugins/Supereo_Haptics/c3runtime/haptics-core.js" }]);
});

test("the import audit resolves web-root URLs, percent escapes, query strings and hashes exactly", t => {
  const f = exportFixture(t);
  fs.writeFileSync(path.join(f.www, "scripts/space file.js"), 'export const value = 1;');
  fs.writeFileSync(path.join(f.www, "scripts/extra.js"), 'import "/scripts/space%20file.js?version=1#part"; import "https://example.invalid/external.js"; import "mapped-name";');
  const report = auditExport(f.www);
  assert.equal(report.ok, true);
  assert.deepEqual(report.uncheckedImports.map(item => item.kind), ["external", "bare"]);
});

test("a syntax error fails the static audit instead of claiming unresolved source was checked", t => {
  const f = exportFixture(t);
  fs.writeFileSync(path.join(f.www, "scripts/broken.js"), 'import "./');
  const report = auditExport(f.directory);
  assert.equal(report.ok, false);
  assert.equal(report.errors[0].kind, "parse-error");
});

test("Taptic Engine registration is separate from Supereo and optional missing-native enforcement", t => {
  const f = exportFixture(t);
  fs.writeFileSync(path.join(f.www, "cordova_plugins.js"), 'cordova.define("cordova/plugin_list", function(require,exports,module) { module.exports = [{pluginId:"cordova-plugin-taptic-engine",file:"plugins/taptic.js",clobbers:["TapticEngine"]}]; });');
  let report = auditExport(f.directory);
  assert.equal(report.ok, true);
  assert.equal(report.nativeBridge.tapticEnginePresent, true);
  assert.equal(report.nativeBridge.jsRegistrationPresent, false);
  report = auditExport(f.directory, { requireNativeBridge: true });
  assert.equal(report.ok, false);
  assert.equal(report.errors[0].kind, "native-bridge-registration");
});

test("static iOS registration is reported only when both JavaScript modules, files, namespace and native feature are present", t => {
  const f = exportFixture(t);
  fs.mkdirSync(path.join(f.www, "plugins"));
  for (const name of ["core.js", "bridge.js"]) fs.writeFileSync(path.join(f.www, "plugins", name), "/* fixture */");
  fs.writeFileSync(path.join(f.www, "cordova_plugins.js"), 'cordova.define("cordova/plugin_list", function(require,exports,module) { module.exports = [{pluginId:"cordova-plugin-supereo-haptics",file:"plugins/core.js"},{pluginId:"cordova-plugin-supereo-haptics",file:"plugins/bridge.js",clobbers:["cordova.plugins.SupereoHaptics"]}]; });');
  fs.writeFileSync(path.join(f.directory, "config.xml"), '<widget><feature name="SupereoHaptics"><param value="SupereoHaptics" name="ios-package" /></feature></widget>');
  let report = auditExport(f.directory, { requireNativeBridge: true });
  assert.equal(report.ok, true);
  assert.equal(report.nativeBridge.status, "ios-registration-present");
  fs.unlinkSync(path.join(f.www, "plugins/core.js"));
  report = auditExport(f.directory, { requireNativeBridge: true });
  assert.equal(report.ok, false);
  assert.equal(report.nativeBridge.status, "incomplete");
});

test("the audit CLI returns failure for the reported missing-file defect and emits a structured report", t => {
  const f = exportFixture(t);
  fs.unlinkSync(path.join(f.runtime, "haptics-core.js"));
  const result = spawnSync(process.execPath, [path.join(root, "tools/audit-export.cjs"), f.directory, "--json"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.kind, "filesystem-static-export-audit");
  assert.equal(report.errors[0].target, "scripts/plugins/Supereo_Haptics/c3runtime/haptics-core.js");
});
