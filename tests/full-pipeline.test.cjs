"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createConstructFixture } = require("./helpers/construct-fixture.cjs");
const { createCordovaFixture } = require("./helpers/cordova-fixture.cjs");
const core = require("../lib/core.js");

// Runtime -> real DOM handler -> real shipping Cordova www adapter -> mocked
// exec. Only the final native transport is substituted; no Java/Swift/device
// behavior is inferred from this JavaScript integration test.
for (const worker of [false, true]) test(`full JavaScript pipeline uses valid native fields and the packaged validator in ${worker ? "worker" : "main thread"} mode`, async t => {
  const nativeRequests = [];
  const nativeStates = [];
  let state = { enabled: true, strength: 1 };
  const caps = { backend: "native-test-transport", bridgeAvailable: true, hardwareAvailable: true, intensityControl: true, advancedPatterns: true, sharpnessControl: false, fallbackInfo: "JavaScript test transport" };
  const cordova = createCordovaFixture("native/cordova-plugin-supereo-haptics/www/SupereoHaptics.js", {
    execHandler(call) {
      assert.equal(call.service, "SupereoHaptics");
      if (call.action === "getCapabilities") { assert.deepEqual(Array.from(call.args), []); call.success(caps); return; }
      if (call.action === "stop") { assert.deepEqual(Array.from(call.args), []); call.success({ stopped: true }); return; }
      if (call.action === "setState") {
        const value = structuredClone(call.args[0]);
        assert.ok(Object.keys(value).every(key => ["enabled", "strength"].includes(key)), "only native state fields cross exec");
        state = { ...state, ...value };
        nativeStates.push(state);
        call.success(state);
        return;
      }
      assert.equal(call.action, "play");
      const value = structuredClone(call.args[0]);
      const allowed = ["kind", "requestId", "strength", "overlap"];
      if (value.kind === "impact") allowed.push("style");
      if (value.kind === "notification") allowed.push("notification");
      if (value.kind === "pattern") allowed.push("pattern");
      assert.ok(Object.keys(value).every(key => allowed.includes(key)), "runtime-only labels/state must not leak into strict native request schemas");
      assert.equal(value.strength, 1);
      assert.equal(typeof value.requestId, "string");
      assert.equal(value.overlap, "replace");
      if (value.kind === "pattern") assert.deepEqual(value.pattern, core.validatePattern(value.pattern));
      nativeRequests.push(value);
      if (value.notification === "error") { call.failure({ code: "DEVICE_REJECTED", message: "Test transport refused error notification" }); return; }
      call.success({ accepted: true, requestId: value.requestId, backend: caps.backend, approximated: false, fallback: "", durationMs: value.pattern ? core.durationMs(value.pattern) : 35, completion: "not-observable" });
    }
  });
  const f = await createConstructFixture({ worker, native: cordova.api, properties: [true, 0.4, true, true, 0, 0, 250] });
  t.after(() => f.release());
  assert.deepEqual(cordova.requiredModules, ["cordova/exec", "cordova-plugin-supereo-haptics.core"]);
  assert.deepEqual(nativeStates, [{ enabled: true, strength: 0.4 }]);
  assert.equal(f.condition("NativeBridgeAvailable"), true);
  assert.equal(f.expression("Backend"), caps.backend);
  for (let index = 0; index < 8; index++) {
    await f.action("PlayFeedback", index);
    assert.equal(JSON.parse(f.expression("LastResultJSON")).accepted, true);
  }
  await f.action("RegisterPattern", "native-curve", JSON.stringify({ version: 1, events: [{ type: "continuous", timeMs: 0, durationMs: 250, intensity: 0.5, curves: { intensity: [{ timeMs: 0, value: 0 }, { timeMs: 250, value: 1 }] } }] }));
  await f.action("PlayPattern", "native-curve");
  assert.equal(nativeRequests.at(-1).pattern.events[0].sharpness, 0.5);
  assert.equal(JSON.parse(f.expression("LastResultJSON")).durationMs, 250);
  await f.action("PlayFeedback", 8);
  assert.equal(JSON.parse(f.expression("LastResultJSON")).accepted, false);
  assert.equal(JSON.parse(f.expression("LastResultJSON")).code, "DEVICE_REJECTED");
  assert.equal(f.expression("LastError"), "Test transport refused error notification");
  await f.action("SetStrength", 0.7);
  assert.deepEqual(nativeStates.at(-1), { enabled: true, strength: 0.7 });
  await f.action("SetEnabled", 0);
  assert.deepEqual(nativeStates.at(-1), { enabled: false, strength: 0.7 });
  const playCount = nativeRequests.length;
  await f.action("PlayFeedback", 0);
  assert.equal(nativeRequests.length, playCount);
  assert.equal(JSON.parse(f.expression("LastResultJSON")).reason, "disabled-or-zero-strength");
  assert.equal(cordova.timers.size, 0);
  assert.equal(f.vibrationCalls.length, 0);
});
