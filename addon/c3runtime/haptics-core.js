// Generated runtime-only module from lib/core.js. Registered with AddC3RuntimeScript.
(function (root, factory) {
  "use strict";
  const api = factory();
  root.SupereoHapticsCore = api;
})(globalThis, function () {
  "use strict";
  const LIMITS = Object.freeze({ events: 64, points: 32, durationMs: 10000, transientMs: 12 });
  const fail = message => { const error = new Error(message); error.code = "INVALID_PATTERN"; throw error; };
  function object(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail(label + " must be an object.");
  }
  function keys(value, allowed, label) {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(label + ": unknown field " + key + ".");
  }
  function integer(value, label, minimum, maximum) {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(label + " must be a whole number from " + minimum + " to " + maximum + ".");
    return value;
  }
  function unit(value, label) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) fail(label + " must be a finite number from 0 to 1.");
    return value;
  }
  function validatePattern(input) {
    let source = input;
    if (typeof input === "string") {
      if (input.length > 131072) fail("Pattern JSON exceeds 128 KiB.");
      try { source = JSON.parse(input); } catch (_) { fail("Pattern is not valid JSON."); }
    }
    object(source, "Pattern");
    keys(source, ["version", "events"], "Pattern");
    if (source.version !== 1) fail("Only pattern version 1 is supported.");
    if (!Array.isArray(source.events) || source.events.length < 1 || source.events.length > LIMITS.events) fail("Use 1 to 64 events.");
    const events = Array.from(source.events, (event, index) => {
      const label = "Event " + (index + 1);
      object(event, label);
      keys(event, ["timeMs", "type", "durationMs", "intensity", "sharpness", "curves"], label);
      if (event.type !== "transient" && event.type !== "continuous") fail(label + ": type must be transient or continuous.");
      const timeMs = integer(event.timeMs, label + " timeMs", 0, LIMITS.durationMs);
      const result = { timeMs, type: event.type, intensity: unit(event.intensity, label + " intensity"), sharpness: event.sharpness === undefined ? 0.5 : unit(event.sharpness, label + " sharpness") };
      if (event.type === "continuous") result.durationMs = integer(event.durationMs, label + " durationMs", 1, LIMITS.durationMs);
      else if (event.durationMs !== undefined) fail(label + ": transient events cannot have durationMs.");
      const end = timeMs + (result.durationMs || LIMITS.transientMs);
      if (end > LIMITS.durationMs) fail(label + ": the pattern must end within 10000 ms.");
      if (event.curves !== undefined) {
        if (event.type !== "continuous") fail(label + ": curves require a continuous event.");
        object(event.curves, label + " curves");
        keys(event.curves, ["intensity", "sharpness"], label + " curves");
        if (!Object.keys(event.curves).length) fail(label + ": curves cannot be empty.");
        result.curves = {};
        for (const parameter of Object.keys(event.curves)) {
          const points = event.curves[parameter];
          if (!Array.isArray(points) || !points.length || points.length > LIMITS.points) fail(label + ": each curve needs 1 to 32 points.");
          let previous = -1;
          result.curves[parameter] = Array.from(points, point => {
            object(point, label + " curve point");
            keys(point, ["timeMs", "value"], label + " curve point");
            const t = integer(point.timeMs, label + " curve timeMs", 0, result.durationMs);
            if (t <= previous) fail(label + ": curve points must have increasing, distinct times.");
            previous = t;
            return { timeMs: t, value: unit(point.value, label + " curve value") };
          });
        }
      }
      return result;
    });
    events.sort((a, b) => a.timeMs - b.timeMs);
    return { version: 1, events };
  }
  function durationMs(pattern) {
    return Math.max(...pattern.events.map(event => event.timeMs + (event.type === "continuous" ? event.durationMs : LIMITS.transientMs)));
  }
  const presets = Object.freeze({
    "selection-tick": Object.freeze({ kind: "selection" }),
    "light-impact": Object.freeze({ kind: "impact", style: "light" }),
    "medium-impact": Object.freeze({ kind: "impact", style: "medium" }),
    "strong-impact": Object.freeze({ kind: "impact", style: "heavy" }),
    "soft-impact": Object.freeze({ kind: "impact", style: "soft" }),
    "crisp-impact": Object.freeze({ kind: "impact", style: "rigid" }),
    "success": Object.freeze({ kind: "notification", notification: "success" }),
    "warning": Object.freeze({ kind: "notification", notification: "warning" }),
    "error": Object.freeze({ kind: "notification", notification: "error" })
  });
  function getPreset(name) {
    if (!Object.prototype.hasOwnProperty.call(presets, name)) {
      const error = new Error("Unknown feedback preset: " + name); error.code = "UNKNOWN_PRESET"; throw error;
    }
    return { ...presets[name] };
  }
  function describeRequest(request) {
    if (request.kind === "pattern") return "Custom pattern · " + request.pattern.events.length + " events · " + durationMs(request.pattern) + " ms";
    return request.kind === "impact" ? request.style + " impact" : request.kind === "notification" ? request.notification + " notification" : "Selection tick";
  }
  return Object.freeze({ version: 1, LIMITS, validatePattern, durationMs, presets, getPreset, describeRequest });
});
