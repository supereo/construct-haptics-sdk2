"use strict";

// A JavaScript integration fixture for the public Construct SDK v2 messaging
// surface demonstrated by Scirra's domMessagingPlugin sample. It runs our real
// runtime and DOM scripts. This is not a Construct editor or a device test.
const path = require("node:path");
const vm = require("node:vm");
const { captureAddonRegistration, bundleRegisteredRuntime, readAddonScript } = require("./construct-loader.cjs");

const root = path.resolve(__dirname, "../..");

class EventTargetFixture {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  dispatch(name) {
    for (const callback of [...(this.listeners.get(name) || [])]) callback({ type: name });
  }
}

class ElementFixture {
  constructor(tagName) {
    this.tagName = tagName;
    this.style = {};
    this.attributes = {};
    this.children = [];
    this.parentNode = null;
    this._textContent = "";
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  remove() {
    if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
    this.parentNode = null;
  }
  set textContent(value) { this._textContent = value; this.children = []; }
  get textContent() { return this._textContent; }
}

function executeDOMScript(context, relativeFile, sources) {
  const filename = path.join(root, relativeFile);
  vm.runInContext(readAddonScript(relativeFile.replace(/^addon\//, ""), sources), context, { filename });
}

async function createConstructFixture(options = {}) {
  // Read the shipping editor registration, resolve the registered main entry
  // through Construct's restricted runtime file map, and let esbuild process
  // its real imports. No helper library is preloaded into either context.
  const registration = captureAddonRegistration(options.sources);
  const bundledRuntime = await bundleRegisteredRuntime(options.sources, registration);
  const messages = [];
  const triggers = [];
  const loads = [];
  const vibrationCalls = [];
  const window = new EventTargetFixture();
  const document = new EventTargetFixture();
  document.hidden = false;
  document.visibilityState = "visible";
  document.body = new ElementFixture("body");
  document.createElement = tagName => new ElementFixture(tagName);
  document.createElementNS = (_, tagName) => new ElementFixture(tagName);
  const native = options.native;
  const cordova = Object.hasOwn(options, "cordova") ? options.cordova : native ? { plugins: { SupereoHaptics: native } } : undefined;
  let Handler;
  let handler;
  let instance;
  const handlers = new Map();
  const runtimeDOMMessages = new Map();
  const scheduleTimeout = options.setTimeout || setTimeout;
  const cancelTimeout = options.clearTimeout || clearTimeout;

  const domContext = vm.createContext({
    console, setTimeout: scheduleTimeout, clearTimeout: cancelTimeout, setInterval, clearInterval,
    performance: options.performance || performance, Date, Promise, structuredClone,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    window, document,
    navigator: {
      userAgent: options.userAgent || "JavaScript integration fixture",
      vibrate: options.vibrate === false ? undefined : value => {
        vibrationCalls.push(structuredClone(value));
        return options.vibrationResult !== false;
      }
    },
    cordova,
    DOMHandler: class {
      constructor(runtimeInterface, componentId) {
        this._runtimeInterface = runtimeInterface;
        this.componentId = componentId;
      }
      AddRuntimeMessageHandlers(entries) {
        for (const [name, callback] of entries) handlers.set(name, callback);
      }
      AddRuntimeMessageHandler(name, callback) { handlers.set(name, callback); }
      PostToRuntime(name, data) { runtimeDOMMessages.get(name)?.(structuredClone(data)); }
    },
    RuntimeInterface: {
      AddDOMHandlerClass(value) { Handler = value; }
    }
  });
  Object.assign(domContext, options.domGlobals);
  Object.assign(window, options.domGlobals);
  window.window = window;
  if (cordova) window.cordova = cordova;
  for (const script of registration.domSideScripts)
    executeDOMScript(domContext, "addon/" + script, options.sources);
  const runtimeInterface = {
    AddRuntimeMessageHandler(component, name, callback) { handlers.set(name, callback); },
    PostToRuntime(component, name, data) { runtimeDOMMessages.get(name)?.(structuredClone(data)); }
  };
  handler = new Handler(runtimeInterface);

  const runtime = {
    sdk: { addLoadPromise(promise) { loads.push(promise); } },
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window)
  };
  const runtimeContext = vm.createContext({
    console, setTimeout: scheduleTimeout, clearTimeout: cancelTimeout, performance: options.performance || performance, Date, Promise, structuredClone,
    C3: { Plugins: {} },
    ISDKPluginBase: class {},
    ISDKObjectTypeBase: class {},
    ISDKInstanceBase: class {
      constructor({ domComponentId } = {}) {
        this.runtime = runtime;
        this.domComponentId = domComponentId;
      }
      _getInitProperties() {
        return options.properties || [true, 1, false, true, 0, 50, 0];
      }
      _postToDOMAsync(name, data) {
        messages.push({ name, data: structuredClone(data) });
        if (!handlers.has(name)) return Promise.reject(new Error(`Unknown DOM message: ${name}`));
        // Worker mode crosses the structured clone boundary before and after
        // the handler. Both modes use the same documented asynchronous API.
        const payload = options.worker ? structuredClone(data) : data;
        return Promise.resolve().then(() => handlers.get(name)(payload)).then(value =>
          options.worker ? structuredClone(value) : value);
      }
      _postToDOM(name, data) {
        this._postToDOMAsync(name, data).catch(() => {});
      }
      _addDOMMessageHandler(name, callback) { runtimeDOMMessages.set(name, callback); }
      _trigger(condition) { triggers.push(condition); }
      _release() { this.baseReleased = true; }
    }
  });
  if (!options.worker) {
    runtimeContext.window = window;
    runtimeContext.document = document;
    runtimeContext.navigator = domContext.navigator;
    runtimeContext.cordova = cordova;
  }
  vm.runInContext(bundledRuntime.code, runtimeContext, { filename: registration.runtimeMainScript + ".bundled.js" });
  const plugin = runtimeContext.C3.Plugins.Supereo_Haptics;
  instance = new plugin.Instance();
  if (options.onInstanceCreated) options.onInstanceCreated({ instance, handler, document, window });
  await Promise.all(loads);

  return {
    instance, handler, plugin, messages, triggers, vibrationCalls, window, document,
    domContext, runtimeContext, registration, bundledRuntime,
    async message(name, data) {
      if (!handlers.has(name)) throw new Error(`Unknown DOM message: ${name}`);
      return structuredClone(await handlers.get(name)(structuredClone(data)));
    },
    async action(name, ...args) {
      const value = plugin.Acts[name].apply(instance, args);
      await value;
      await new Promise(resolve => setImmediate(resolve));
      return value;
    },
    expression(name, ...args) { return plugin.Exps[name].apply(instance, args); },
    condition(name, ...args) { return plugin.Cnds[name].apply(instance, args); },
    async flush() { await new Promise(resolve => setImmediate(resolve)); },
    async release() { instance._release(); await this.flush(); }
  };
}

module.exports = { createConstructFixture, EventTargetFixture };
