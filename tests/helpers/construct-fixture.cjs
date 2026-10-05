"use strict";

// A JavaScript integration fixture for the public Construct SDK v2 messaging
// surface demonstrated by Scirra's domMessagingPlugin sample. It runs our real
// runtime and DOM scripts. This is not a Construct editor or a device test.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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

function execute(context, relativeFile, sources = {}) {
  const filename = path.join(root, relativeFile);
  // Runtime modules have their own lexical scope. The real module loader has
  // already supplied dependencies in this fixture, so only static imports are
  // omitted. The tested module's actual executable code is retained.
  const source = (sources[relativeFile] === undefined ? fs.readFileSync(filename, "utf8") : sources[relativeFile]).replace(/^\s*import\s+[^;]+;\s*$/gm, "");
  vm.runInContext(`(function () {\n${source}\n})();`, context, { filename });
}

async function createConstructFixture(options = {}) {
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
    cordova: native ? { plugins: { SupereoHaptics: native } } : undefined,
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
  window.window = window;
  if (native) window.cordova = domContext.cordova;
  execute(domContext, "lib/core.js", options.sources);
  execute(domContext, "addon/c3runtime/domSide.js", options.sources);
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
  }
  execute(runtimeContext, "lib/core.js", options.sources);
  for (const file of ["plugin", "type", "conditions", "actions", "expressions", "instance"])
    execute(runtimeContext, `addon/c3runtime/${file}.js`, options.sources);
  const plugin = runtimeContext.C3.Plugins.Supereo_Haptics;
  instance = new plugin.Instance();
  if (options.onInstanceCreated) options.onInstanceCreated({ instance, handler, document, window });
  await Promise.all(loads);

  return {
    instance, handler, plugin, messages, triggers, vibrationCalls, window, document,
    domContext, runtimeContext,
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
