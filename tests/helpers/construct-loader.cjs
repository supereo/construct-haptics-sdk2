"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { build } = require("esbuild-wasm");

const root = path.resolve(__dirname, "../..");
// These are Construct's standard plugin runtime modules. A file being present
// in addon.json does not by itself add a custom runtime import to its file map.
const runtimeModules = Object.freeze(["plugin.js", "type.js", "instance.js", "conditions.js", "actions.js", "expressions.js"]);

function readAddonScript(relativeFile, sources) {
  const key = "addon/" + relativeFile;
  if (sources !== undefined) {
    if (!Object.hasOwn(sources, key)) throw new Error("Addon archive is missing script: " + relativeFile);
    return sources[key];
  }
  return fs.readFileSync(path.join(root, key), "utf8");
}

function captureAddonRegistration(sources) {
  let RegisteredClass;
  const registration = { pluginId: "", runtimeMainScript: "", additionalRuntimeScripts: [], domSideScripts: [], cordovaPluginReferences: [], properties: [] };
  const info = {};
  for (const method of ["SetName", "SetDescription", "SetCategory", "SetAuthor", "SetHelpUrl", "SetIsSingleGlobal"])
    info[method] = () => {};
  info.SetRuntimeModuleMainScript = value => { registration.runtimeMainScript = value; };
  info.AddC3RuntimeScript = value => { registration.additionalRuntimeScripts.push(value); };
  info.SetDOMSideScripts = value => { registration.domSideScripts = Array.from(value); };
  info.AddCordovaPluginReference = (...args) => { registration.cordovaPluginReferences.push(structuredClone(args)); };
  info.SetProperties = value => { registration.properties = Array.from(value); };
  const SDK = {
    Plugins: {},
    Lang: { PushContext() {}, PopContext() {} },
    PluginProperty: class {
      constructor(type, id, initialValue) { this.type = type; this.id = id; this.initialValue = initialValue; }
    },
    IPluginBase: class {
      constructor(id) { registration.pluginId = id; this._info = info; }
      static Register(id, PluginClass) { registration.pluginId = id; RegisteredClass = PluginClass; }
    }
  };
  vm.runInNewContext(readAddonScript("plugin.js", sources), { SDK, lang: value => value }, { filename: "addon/plugin.js" });
  if (!RegisteredClass) throw new Error("The editor script did not register an SDK plugin class.");
  new RegisteredClass();
  if (!registration.runtimeMainScript) throw new Error("The plugin did not register a runtime module entry point.");
  return registration;
}

async function bundleRegisteredRuntime(sources, registration = captureAddonRegistration(sources)) {
  const prefix = "scripts/plugins/" + registration.pluginId + "/";
  const runtimeEntry = prefix + registration.runtimeMainScript;
  const fileMap = new Map([[runtimeEntry, readAddonScript(registration.runtimeMainScript, sources)]]);
  for (const filename of runtimeModules)
    fileMap.set(prefix + "c3runtime/" + filename, readAddonScript("c3runtime/" + filename, sources));
  for (const filename of registration.additionalRuntimeScripts)
    fileMap.set(prefix + filename, readAddonScript(filename, sources));
  const resolvedFiles = [];
  const result = await build({
    entryPoints: [runtimeEntry], bundle: true, write: false, format: "iife",
    platform: "browser", target: "es2022", logLevel: "silent",
    plugins: [{
      name: "construct-runtime-file-map",
      setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          const resolved = args.kind === "entry-point" ? args.path : path.posix.normalize(path.posix.join(path.posix.dirname(args.importer), args.path));
          if (!fileMap.has(resolved)) return { errors: [{ text: "file-map-resolver: cannot find the file \"" + resolved + "\" in the Construct runtime file map" }] };
          resolvedFiles.push(resolved);
          return { path: resolved, namespace: "construct-runtime" };
        });
        builder.onLoad({ filter: /.*/, namespace: "construct-runtime" }, args => ({ contents: fileMap.get(args.path), loader: "js" }));
      }
    }]
  });
  return { code: result.outputFiles[0].text, registration, resolvedFiles: [...new Set(resolvedFiles)], mappedFiles: [...fileMap.keys()] };
}

module.exports = { captureAddonRegistration, bundleRegisteredRuntime, readAddonScript, runtimeModules };
