"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Runs the shipping Cordova JavaScript entry point with a controlled exec
// transport, including success/failure callbacks and watchdog timers. Native
// Kotlin/Swift and hardware are not executed by this fixture.
function createCordovaFixture(relativeFile, options = {}) {
  const calls = [];
  const requiredModules = [];
  const timers = new Map();
  let timerId = 0;
  const exports = {};
  const context = vm.createContext({
    module: { exports }, exports, console, Promise,
    require(name) {
      requiredModules.push(name);
      if (name === "cordova-plugin-supereo-haptics.core") {
        const packagedCore = path.resolve(__dirname, "../../native/cordova-plugin-supereo-haptics/www/core.js");
        return require(packagedCore);
      }
      if (name !== "cordova/exec") throw new Error(`Unexpected dependency: ${name}`);
      return (success, failure, service, action, args) => {
        if (options.throwExec) throw new Error(options.throwExec);
        const call = { success, failure, service, action, args };
        calls.push(call);
        if (options.execHandler) options.execHandler(call);
      };
    },
    setTimeout(callback, milliseconds) {
      const id = ++timerId;
      timers.set(id, { callback, milliseconds });
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  });
  const filename = path.resolve(__dirname, "../..", relativeFile);
  vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  return {
    api: context.module.exports, calls, timers, requiredModules,
    expireTimers() {
      const pending = [...timers.values()];
      timers.clear();
      for (const timer of pending) timer.callback();
    }
  };
}

module.exports = { createCordovaFixture };
