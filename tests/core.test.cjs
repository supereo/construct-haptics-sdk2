"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../lib/core.js");

const transient = (fields = {}) => ({ type: "transient", timeMs: 0, intensity: 1, ...fields });
const continuous = (fields = {}) => ({ type: "continuous", timeMs: 0, durationMs: 100, intensity: 0.75, ...fields });
const pattern = (...events) => ({ version: 1, events });
const invalid = value => assert.throws(() => core.validatePattern(value), error => error.code === "INVALID_PATTERN" && typeof error.message === "string" && error.message.length > 0);

test("normalization accepts JSON and object inputs, sorts events, and preserves caller data", () => {
  const source = pattern(continuous({ timeMs: 50, curves: { intensity: [{ timeMs: 0, value: 0 }, { timeMs: 100, value: 1 }] } }), transient());
  const before = structuredClone(source);
  const normalized = core.validatePattern(source);
  assert.deepEqual(source, before);
  assert.deepEqual(normalized.events.map(event => event.timeMs), [0, 50]);
  assert.deepEqual(normalized.events.map(event => event.sharpness), [0.5, 0.5]);
  assert.equal(core.durationMs(normalized), 150);
  assert.deepEqual(core.validatePattern(JSON.stringify(source)), normalized);
  normalized.events[1].curves.intensity[0].value = 0.25;
  assert.equal(source.events[0].curves.intensity[0].value, 0);
});

test("valid inclusive duration/event/point boundaries are accepted", () => {
  const inputs = [
    pattern(continuous({ durationMs: 10000, intensity: 0, sharpness: 1 })),
    pattern(continuous({ timeMs: 9999, durationMs: 1 })),
    pattern(transient({ timeMs: 9988 })),
    pattern(...Array.from({ length: 64 }, (_, i) => transient({ timeMs: i }))),
    pattern(continuous({ curves: {
      intensity: Array.from({ length: 32 }, (_, i) => ({ timeMs: i, value: i / 31 })),
      sharpness: [{ timeMs: 0, value: 1 }, { timeMs: 100, value: 0 }]
    } }))
  ];
  for (const input of inputs) assert.equal(core.validatePattern(input).version, 1);
  assert.equal(core.durationMs(core.validatePattern(inputs[0])), 10000);
});

test("malformed JSON, top-level schema, empty, excessive, and sparse events are rejected", async t => {
  const cases = [
    ["malformed JSON", "{not JSON"], ["oversized JSON", " ".repeat(131073)],
    ["null", null], ["array", []], ["boolean", false], ["number", 1],
    ["missing version", { events: [transient()] }], ["wrong version", { version: 2, events: [transient()] }],
    ["unknown field", { ...pattern(transient()), loop: true }],
    ["missing events", { version: 1 }], ["non-array events", { version: 1, events: {} }],
    ["empty events", pattern()], ["too many events", pattern(...Array.from({ length: 65 }, () => transient()))],
    ["sparse events", { version: 1, events: new Array(1) }], ["null event", pattern(null)], ["array event", pattern([])]
  ];
  for (const [label, value] of cases) await t.test(label, () => invalid(value));
});

test("event timing and unit ranges reject coercion, fractions, nonfinite numbers, and wrong fields", async t => {
  const cases = [
    ["missing type", { timeMs: 0, intensity: 1 }], ["unknown type", transient({ type: "buzz" })],
    ["unknown event field", transient({ amplitude: 255 })],
    ["negative time", transient({ timeMs: -1 })], ["fractional time", transient({ timeMs: 0.1 })],
    ["string time", transient({ timeMs: "0" })], ["infinite time", transient({ timeMs: Infinity })],
    ["transient exceeds duration", transient({ timeMs: 9989 })],
    ["transient with duration", transient({ durationMs: 1 })],
    ["missing intensity", { type: "transient", timeMs: 0 }],
    ["negative intensity", transient({ intensity: -0.01 })], ["intensity above one", transient({ intensity: 1.01 })],
    ["string intensity", transient({ intensity: "1" })], ["null intensity", transient({ intensity: null })],
    ["NaN intensity", transient({ intensity: NaN })], ["infinite intensity", transient({ intensity: Infinity })],
    ["sharpness above one", transient({ sharpness: 1.01 })], ["null sharpness", transient({ sharpness: null })],
    ["boolean sharpness", transient({ sharpness: false })],
    ["zero continuous duration", continuous({ durationMs: 0 })], ["negative duration", continuous({ durationMs: -1 })],
    ["fractional duration", continuous({ durationMs: 1.1 })], ["string duration", continuous({ durationMs: "100" })],
    ["missing continuous duration", { type: "continuous", timeMs: 0, intensity: 1 }],
    ["continuous end exceeds duration", continuous({ timeMs: 9999, durationMs: 2 })]
  ];
  for (const [label, event] of cases) await t.test(label, () => invalid(pattern(event)));
});

test("continuous curves enforce event-relative timing and bounded ordered control points", async t => {
  const cases = [
    ["curves on transient", transient({ curves: { intensity: [{ timeMs: 0, value: 1 }] } })],
    ["null curves", continuous({ curves: null })], ["array curves", continuous({ curves: [] })],
    ["empty curves", continuous({ curves: {} })],
    ["unknown parameter", continuous({ curves: { amplitude: [{ timeMs: 0, value: 1 }] } })],
    ["empty points", continuous({ curves: { intensity: [] } })],
    ["non-array points", continuous({ curves: { intensity: {} } })],
    ["too many points", continuous({ curves: { intensity: Array.from({ length: 33 }, (_, i) => ({ timeMs: i, value: 1 })) } })],
    ["sparse points", continuous({ curves: { intensity: new Array(1) } })],
    ["null point", continuous({ curves: { intensity: [null] } })],
    ["unknown point field", continuous({ curves: { intensity: [{ timeMs: 0, value: 1, easing: "linear" }] } })],
    ["negative time", continuous({ curves: { intensity: [{ timeMs: -1, value: 1 }] } })],
    ["fractional time", continuous({ curves: { intensity: [{ timeMs: 1.5, value: 1 }] } })],
    ["absolute time beyond event duration", continuous({ timeMs: 1000, curves: { intensity: [{ timeMs: 1000, value: 1 }] } })],
    ["duplicate times", continuous({ curves: { intensity: [{ timeMs: 0, value: 0 }, { timeMs: 0, value: 1 }] } })],
    ["descending times", continuous({ curves: { intensity: [{ timeMs: 100, value: 0 }, { timeMs: 50, value: 1 }] } })],
    ["value above one", continuous({ curves: { intensity: [{ timeMs: 0, value: 1.1 }] } })],
    ["missing value", continuous({ curves: { sharpness: [{ timeMs: 0 }] } })],
    ["nonfinite value", continuous({ curves: { sharpness: [{ timeMs: 0, value: NaN }] } })]
  ];
  for (const [label, event] of cases) await t.test(label, () => invalid(pattern(event)));
});

test("the nine named presets retain semantic identity and return independent values", () => {
  const expected = {
    "selection-tick": { kind: "selection" },
    "light-impact": { kind: "impact", style: "light" },
    "medium-impact": { kind: "impact", style: "medium" },
    "strong-impact": { kind: "impact", style: "heavy" },
    "soft-impact": { kind: "impact", style: "soft" },
    "crisp-impact": { kind: "impact", style: "rigid" },
    success: { kind: "notification", notification: "success" },
    warning: { kind: "notification", notification: "warning" },
    error: { kind: "notification", notification: "error" }
  };
  assert.deepEqual(Object.keys(core.presets).sort(), Object.keys(expected).sort());
  for (const [name, preset] of Object.entries(expected)) assert.deepEqual(core.getPreset(name), preset);
  const copy = core.getPreset("light-impact");
  copy.style = "heavy";
  assert.equal(core.getPreset("light-impact").style, "light");
  for (const name of ["", "unknown", "__proto__", "constructor", "toString"])
    assert.throws(() => core.getPreset(name), error => error.code === "UNKNOWN_PRESET");
});

test("shared core loads without Node globals in a browser/worker and matches CommonJS normalization", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../lib/core.js"), "utf8"), context);
  const input = JSON.stringify(pattern(continuous({ durationMs: 10 })));
  assert.deepEqual(JSON.parse(JSON.stringify(context.SupereoHapticsCore.validatePattern(input))), core.validatePattern(input));
  assert.match(core.describeRequest({ kind: "pattern", pattern: core.validatePattern(input) }), /1 events.*10 ms/);
  assert.match(core.describeRequest(core.getPreset("warning")), /warning notification/);
});
