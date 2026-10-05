"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createCordovaFixture } = require("./helpers/cordova-fixture.cjs");
const entry = "native/cordova-plugin-supereo-haptics/www/SupereoHaptics.js";
const plain = value => JSON.parse(JSON.stringify(value));

test("Cordova API uses the SupereoHaptics service and preserves structured success replies", async () => {
  const fixture = createCordovaFixture(entry);
  const caps = { backend: "ios-core-haptics", bridgeAvailable: true, hardwareAvailable: true, advancedPatterns: true };
  const operations = [
    ["getCapabilities", [], [], caps],
    ["play", [{ kind: "impact", style: "soft" }], [{ kind: "impact", style: "soft", strength: 1, overlap: "replace" }], { accepted: true, backend: caps.backend, completion: "not-observable" }],
    ["stop", [], [], { stopped: true }],
    ["setState", [{ enabled: false, strength: 0.5 }], [{ enabled: false, strength: 0.5 }], { enabled: false, strength: 0.5 }]
  ];
  for (const [name, input, nativeArgs, reply] of operations) {
    const promise = fixture.api[name](...input);
    assert.equal(typeof promise.then, "function");
    const call = fixture.calls.at(-1);
    assert.equal(call.service, "SupereoHaptics");
    assert.equal(call.action, name);
    assert.deepEqual(plain(call.args), nativeArgs);
    call.success(reply);
    assert.deepEqual(await promise, reply);
    assert.equal(fixture.timers.size, 0, "settlement clears the watchdog timer");
  }
});

test("custom patterns are validated and normalized before crossing Cordova exec", async () => {
  const fixture = createCordovaFixture(entry);
  const input = { kind: "pattern", pattern: JSON.stringify({ version: 1, events: [{ timeMs: 20, type: "transient", intensity: 0.5 }, { timeMs: 0, type: "continuous", durationMs: 10, intensity: 1 }] }), requestId: "test", strength: 0.75, overlap: "ignore" };
  const promise = fixture.api.play(input);
  const sent = plain(fixture.calls[0].args[0]);
  assert.equal(typeof input.pattern, "string", "the caller's request is not modified");
  assert.deepEqual(sent.pattern.events.map(event => event.timeMs), [0, 20]);
  assert.deepEqual(sent.pattern.events.map(event => event.sharpness), [0.5, 0.5]);
  assert.equal(sent.requestId, "test");
  assert.equal(sent.strength, 0.75);
  fixture.calls[0].success({ accepted: true });
  await promise;
});

test("malformed requests reject as Promises without invoking the native transport", async t => {
  const cases = [
    ["null", null, "INVALID_REQUEST"], ["array", [], "INVALID_REQUEST"],
    ["unknown kind", { kind: "buzz" }, "INVALID_REQUEST"],
    ["unknown impact", { kind: "impact", style: "hardest" }, "INVALID_REQUEST"],
    ["unknown notification", { kind: "notification", notification: "fatal" }, "INVALID_REQUEST"],
    ["invalid pattern", { kind: "pattern", pattern: { version: 1, events: [] } }, "INVALID_PATTERN"],
    ["negative strength", { kind: "selection", strength: -0.1 }, "INVALID_REQUEST"],
    ["too large strength", { kind: "selection", strength: 1.1 }, "INVALID_REQUEST"],
    ["nonfinite strength", { kind: "selection", strength: NaN }, "INVALID_REQUEST"],
    ["string strength", { kind: "selection", strength: "1" }, "INVALID_REQUEST"],
    ["unknown overlap", { kind: "selection", overlap: "queue" }, "INVALID_REQUEST"],
    ["number request id", { kind: "selection", requestId: 42 }, "INVALID_REQUEST"],
    ["oversized request id", { kind: "selection", requestId: "x".repeat(129) }, "INVALID_REQUEST"]
  ];
  for (const [label, request, code] of cases) await t.test(label, async () => {
    const fixture = createCordovaFixture(entry);
    await assert.rejects(fixture.api.play(request), error => error.code === code);
    assert.equal(fixture.calls.length, 0);
    assert.equal(fixture.timers.size, 0);
  });
});

test("state validation rejects coercion and invalid ranges before exec", async t => {
  for (const state of [null, [], { enabled: 1 }, { enabled: "false" }, { strength: -1 }, { strength: Infinity }, { strength: "0.5" }])
    await t.test(JSON.stringify(state), async () => {
      const fixture = createCordovaFixture(entry);
      await assert.rejects(fixture.api.setState(state), error => error.code === "INVALID_REQUEST");
      assert.equal(fixture.calls.length, 0);
    });
});

test("native failure objects and legacy strings become stable Error rejections", async t => {
  for (const [failure, code, message] of [
    [{ code: "HARDWARE_UNAVAILABLE", message: "No haptics engine", platform: "ios" }, "HARDWARE_UNAVAILABLE", "No haptics engine"],
    ["legacy native error", "NATIVE_ERROR", "legacy native error"],
    [undefined, "NATIVE_ERROR", "Native haptics request failed."]
  ]) await t.test(code + ": " + message, async () => {
    const fixture = createCordovaFixture(entry);
    const promise = fixture.api.play({ kind: "selection" });
    fixture.calls[0].failure(failure);
    await assert.rejects(promise, error => {
      assert.equal(error.name, "Error");
      assert.equal(error.code, code);
      assert.equal(error.message, message);
      if (failure?.platform) assert.equal(error.nativeDetails.platform, "ios");
      return true;
    });
    assert.equal(fixture.timers.size, 0);
  });
});

test("an exec exception rejects promptly and clears its watchdog", async () => {
  const fixture = createCordovaFixture(entry, { throwExec: "transport missing" });
  await assert.rejects(fixture.api.getCapabilities(), error => error.code === "BRIDGE_EXCEPTION" && error.message === "transport missing");
  assert.equal(fixture.timers.size, 0);
});

test("a play watchdog timeout requests native cancellation and ignores late callbacks", async () => {
  const fixture = createCordovaFixture(entry);
  const promise = fixture.api.play({ kind: "selection" });
  const rejection = assert.rejects(promise, error => error.code === "BRIDGE_TIMEOUT" && /5000/.test(error.message));
  assert.equal([...fixture.timers.values()][0].milliseconds, 5000);
  const originalCall = fixture.calls[0];
  fixture.expireTimers();
  await rejection;
  assert.deepEqual(fixture.calls.map(call => call.action), ["play", "stop"]);
  originalCall.success({ accepted: true });
  originalCall.failure({ code: "TOO_LATE" });
  assert.equal(fixture.timers.size, 0);
});

test("capability timeout fails without claiming a native backend or starting feedback", async () => {
  const fixture = createCordovaFixture(entry);
  const promise = fixture.api.getCapabilities();
  const rejection = assert.rejects(promise, error => error.code === "BRIDGE_TIMEOUT");
  fixture.expireTimers();
  await rejection;
  assert.deepEqual(fixture.calls.map(call => call.action), ["getCapabilities"]);
});

test("duplicate native callbacks settle a request exactly once", async () => {
  const fixture = createCordovaFixture(entry);
  const promise = fixture.api.stop();
  fixture.calls[0].success({ stopped: true });
  fixture.calls[0].failure({ code: "DUPLICATE_CALLBACK" });
  fixture.calls[0].success({ stopped: false });
  assert.deepEqual(await promise, { stopped: true });
  assert.equal(fixture.timers.size, 0);
});
