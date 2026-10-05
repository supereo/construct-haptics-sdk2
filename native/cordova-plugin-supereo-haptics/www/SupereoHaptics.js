"use strict";
const exec = require("cordova/exec");
const core = require("cordova-plugin-supereo-haptics.core");
const SERVICE = "SupereoHaptics";
const TIMEOUT_MS = 5000;
function errorFrom(value, fallback) {
  const details = value && typeof value === "object" ? value : { message: typeof value === "string" ? value : fallback };
  const error = new Error(details.message || fallback || "Native haptics request failed.");
  error.code = details.code || "NATIVE_ERROR";
  error.nativeDetails = details;
  return error;
}
function unit(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    const error = new Error(name + " must be a number from 0 to 1."); error.code = "INVALID_REQUEST"; throw error;
  }
  return value;
}
function call(action, args) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (action === "play") {
        try { exec(() => {}, () => {}, SERVICE, "stop", []); } catch (_) { /* Best-effort cancellation. */ }
      }
      reject(errorFrom({ code: "BRIDGE_TIMEOUT", message: "Native " + action + " did not respond within 5000 ms." }));
    }, TIMEOUT_MS);
    const finish = (ok, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (ok) resolve(value); else reject(errorFrom(value));
    };
    try { exec(value => finish(true, value), value => finish(false, value), SERVICE, action, args); }
    catch (error) { finish(false, { code: "BRIDGE_EXCEPTION", message: error.message }); }
  });
}
function normalizeRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw errorFrom({ code: "INVALID_REQUEST", message: "A feedback request must be an object." });
  const request = { ...input };
  if (!["selection", "impact", "notification", "pattern"].includes(request.kind)) throw errorFrom({ code: "INVALID_REQUEST", message: "Unknown feedback kind." });
  if (request.kind === "impact" && !["light", "medium", "heavy", "soft", "rigid"].includes(request.style)) throw errorFrom({ code: "INVALID_REQUEST", message: "Choose light, medium, heavy, soft or rigid impact." });
  if (request.kind === "notification" && !["success", "warning", "error"].includes(request.notification)) throw errorFrom({ code: "INVALID_REQUEST", message: "Choose success, warning or error notification." });
  if (request.kind === "pattern") request.pattern = core.validatePattern(request.pattern);
  request.strength = request.strength === undefined ? 1 : unit(request.strength, "Request strength");
  request.overlap = request.overlap === undefined ? "replace" : request.overlap;
  if (!["replace", "ignore"].includes(request.overlap)) throw errorFrom({ code: "INVALID_REQUEST", message: "Overlap must be replace or ignore." });
  if (request.requestId !== undefined && (typeof request.requestId !== "string" || request.requestId.length > 128)) throw errorFrom({ code: "INVALID_REQUEST", message: "requestId must be a string up to 128 characters." });
  return request;
}
module.exports = Object.freeze({
  getCapabilities() { return call("getCapabilities", []); },
  play(input) {
    try { return call("play", [normalizeRequest(input)]); }
    catch (error) { return Promise.reject(error); }
  },
  stop() { return call("stop", []); },
  setState(input) {
    try {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw errorFrom({ code: "INVALID_REQUEST", message: "State must be an object." });
      const state = {};
      if (input.enabled !== undefined) {
        if (typeof input.enabled !== "boolean") throw errorFrom({ code: "INVALID_REQUEST", message: "enabled must be true or false." });
        state.enabled = input.enabled;
      }
      if (input.strength !== undefined) state.strength = unit(input.strength, "Overall strength");
      return call("setState", [state]);
    } catch (error) { return Promise.reject(error); }
  }
});
