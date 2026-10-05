"use strict";

// Read-only filesystem audit. Never executes game or Cordova JavaScript.
const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");
const BRIDGE_ID = "cordova-plugin-supereo-haptics";
const BRIDGE_NAMESPACE = "cordova.plugins.SupereoHaptics";

function filesIn(directory, depth = Infinity) {
  if (depth < 0) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    if (entry.name === "node_modules" || entry.name === ".git") return [];
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(filename, depth - 1) : entry.isFile() ? [filename] : [];
  });
}

function locateWWW(input) {
  const directory = fs.realpathSync(input);
  if (!fs.statSync(directory).isDirectory()) throw new Error("Expected an exported project directory or its www directory.");
  if (path.basename(directory) === "www" || fs.existsSync(path.join(directory, "scripts/c3main.js"))) return directory;
  const direct = path.join(directory, "www");
  if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) return direct;
  const candidates = new Set(filesIn(directory, 5).filter(name => path.basename(name) === "index.html" && path.basename(path.dirname(name)) === "www").map(name => path.dirname(name)));
  if (candidates.size !== 1) throw new Error("Could not select one www directory. Pass the precise exported www path.");
  return [...candidates][0];
}

function parseJavaScript(source) {
  const options = { ecmaVersion: "latest", locations: true, allowHashBang: true };
  try { return acorn.parse(source, { ...options, sourceType: "module" }); }
  catch (moduleError) {
    try { return acorn.parse(source, { ...options, sourceType: "script" }); }
    catch { throw moduleError; }
  }
}

function parseImports(source) {
  return parseJavaScript(source).body.filter(node => node.type === "ImportDeclaration" || ((node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") && node.source)).map(node => ({ specifier: node.source.value, line: node.source.loc.start.line }));
}

function localTarget(www, importer, specifier) {
  // Schemes and protocol-relative URLs are external; bare imports need an import map.
  if (/^[a-z][a-z\d+.-]*:/i.test(specifier) || specifier.startsWith("//")) return { kind: "external" };
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) return { kind: "bare" };
  try {
    const base = new URL("https://export.invalid/" + path.relative(www, importer).split(path.sep).map(encodeURIComponent).join("/"));
    const url = new URL(specifier, base);
    const pathname = decodeURIComponent(url.pathname);
    const filename = path.resolve(www, "." + pathname);
    if (pathname.includes("\0") || path.relative(www, filename).startsWith(".." + path.sep)) return { kind: "invalid", reason: "Import escapes the web root." };
    return { kind: "local", filename };
  }
  catch (error) { return { kind: "invalid", reason: error.message }; }
}

function walkAST(node, visit) {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "loc") continue;
    if (Array.isArray(value)) for (const child of value) walkAST(child, visit);
    else if (value && typeof value === "object") walkAST(value, visit);
  }
}

function literalValue(node) {
  if (node.type === "Literal") return node.value;
  if (node.type === "ArrayExpression") return node.elements.map(literalValue);
  if (node.type === "ObjectExpression") return Object.fromEntries(node.properties.map(property => {
    if (property.type !== "Property" || property.computed || property.kind !== "init") throw new Error("Nonliteral Cordova registry.");
    return [property.key.name || property.key.value, literalValue(property.value)];
  }));
  throw new Error("Nonliteral Cordova registry.");
}

function memberName(node) {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") {
    const key = node.computed ? node.property.value : node.property.name;
    return memberName(node.object) + "." + key;
  }
  return "";
}

function inspectCordovaRegistration(www, input) {
  const result = { packageId: BRIDGE_ID, jsRegistrationPresent: false, registeredFilesPresent: false, iosFeaturePresent: false, status: "absent", tapticEnginePresent: false, evidence: [], warning: "Native bridge missing; haptics should report native-bridge-missing after its bounded initialization wait. Taptic Engine is a different plugin." };
  const registry = path.join(www, "cordova_plugins.js");
  if (!fs.existsSync(registry)) return result;
  let modules = [];
  try {
    walkAST(parseJavaScript(fs.readFileSync(registry, "utf8")), node => {
      if (node.type === "AssignmentExpression" && memberName(node.left) === "module.exports") modules = literalValue(node.right);
    });
    if (!Array.isArray(modules)) throw new Error("Cordova registry is not an array.");
    result.evidence.push(registry);
    result.tapticEnginePresent = modules.some(module => module.pluginId === "cordova-plugin-taptic-engine");
    const bridgeModules = modules.filter(module => module.pluginId === BRIDGE_ID);
    result.jsRegistrationPresent = bridgeModules.some(module => Array.isArray(module.clobbers) && module.clobbers.includes(BRIDGE_NAMESPACE));
    result.registeredFilesPresent = bridgeModules.length >= 2 && bridgeModules.every(module => {
      if (typeof module.file !== "string") return false;
      const target = localTarget(www, registry, "./" + module.file);
      return target.kind === "local" && fs.existsSync(target.filename) && fs.statSync(target.filename).isFile();
    });
    const configs = new Set([
      path.join(path.resolve(input), "config.xml"), path.join(path.dirname(www), "config.xml"),
      path.join(path.resolve(input), "platforms/ios/config.xml"),
      path.join(path.resolve(input), "platforms/ios/App/config.xml"),
      path.join(path.dirname(www), "App/config.xml")
    ]);
    for (const filename of configs) {
      if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) continue;
      const xml = fs.readFileSync(filename, "utf8").replace(/<!--[\s\S]*?-->/g, "");
      const feature = [...xml.matchAll(/<feature\b[^>]*\bname=["']SupereoHaptics["'][^>]*>([\s\S]*?)<\/feature>/g)].some(match => [...match[1].matchAll(/<param\b([^>]+)>/g)].some(param => /\bname=["']ios-package["']/.test(param[1]) && /\bvalue=["']SupereoHaptics["']/.test(param[1])));
      if (feature) { result.iosFeaturePresent = true; result.evidence.push(filename); }
    }
    result.status = result.jsRegistrationPresent && result.registeredFilesPresent && result.iosFeaturePresent ? "ios-registration-present" : bridgeModules.length ? "incomplete" : "absent";
    if (result.status === "ios-registration-present") result.warning = "Static registration present. Native compilation, deviceready, capabilities and device playback are not established by this audit.";
    else if (result.status === "incomplete") result.warning = "Supereo Haptics installation is incomplete. Install the separate Cordova package and prepare iOS; inspect JavaScript files and the native feature registration.";
  }
  catch (error) { result.status = "unreadable"; result.warning = "Could not inspect Cordova registry: " + error.message; }
  return result;
}

function auditExport(input, { requireNativeBridge = false } = {}) {
  const www = locateWWW(input);
  const files = filesIn(www).filter(filename => /\.(?:m?js)$/i.test(filename));
  if (!files.length) throw new Error("No JavaScript files found in the selected web root.");
  const errors = [];
  const uncheckedImports = [];
  let localImports = 0;
  for (const filename of files) {
    let imports;
    try { imports = parseImports(fs.readFileSync(filename, "utf8")); }
    catch (error) { errors.push({ kind: "parse-error", importer: path.relative(www, filename), line: error.loc && error.loc.line, reason: error.message }); continue; }
    for (const entry of imports) {
      const detail = { importer: path.relative(www, filename), ...entry };
      const target = localTarget(www, filename, entry.specifier);
      if (target.kind === "external" || target.kind === "bare") uncheckedImports.push({ ...detail, kind: target.kind });
      else if (target.kind === "invalid") errors.push({ ...detail, kind: "invalid-import", reason: target.reason });
      else {
        localImports++;
        if (!fs.existsSync(target.filename) || !fs.statSync(target.filename).isFile()) errors.push({ ...detail, kind: "missing-import", target: path.relative(www, target.filename) });
      }
    }
  }
  const nativeBridge = inspectCordovaRegistration(www, input);
  if (requireNativeBridge && nativeBridge.status !== "ios-registration-present") errors.push({ kind: "native-bridge-registration", reason: nativeBridge.warning });
  return { kind: "filesystem-static-export-audit", ok: errors.length === 0, www, javascriptFiles: files.length, localStaticImports: localImports, errors, uncheckedImports, nativeBridge, scope: "Read-only static import and iOS registration audit of supplied files. Does not create a Construct export, check dynamic imports/import maps, compile native code, or establish device startup." };
}

module.exports = { auditExport, parseImports, inspectCordovaRegistration };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help")) {
    console.log("Usage: node tools/audit-export.cjs <export-root-or-www> [--json] [--require-native-bridge]\nChecks every local static import/re-export. Missing native bridge is reported separately; the optional flag makes missing iOS registration fail the audit.");
    if (!args.length) process.exitCode = 2;
  }
  else {
    try {
      const directory = args.find(value => !value.startsWith("--"));
      if (!directory || args.some(value => value.startsWith("--") && !["--json", "--require-native-bridge"].includes(value))) throw new Error("Invalid arguments; use --help.");
      const report = auditExport(directory, { requireNativeBridge: args.includes("--require-native-bridge") });
      if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
      else {
        console.log((report.ok ? "PASS" : "FAIL") + ": " + report.localStaticImports + " local static imports in " + report.javascriptFiles + " JavaScript files; web root " + report.www);
        for (const error of report.errors) console.log(JSON.stringify(error));
        console.log("Supereo native bridge: " + report.nativeBridge.status + "; Taptic Engine: " + (report.nativeBridge.tapticEnginePresent ? "present" : "not found"));
        console.log(report.nativeBridge.warning);
        if (report.uncheckedImports.length) console.log(report.uncheckedImports.length + " external/bare imports are outside this local import audit.");
        console.log(report.scope);
      }
      if (!report.ok) process.exitCode = 1;
    }
    catch (error) { console.error(error.message); process.exitCode = 2; }
  }
}
