"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const core = require("../lib/core.js");
const { createConstructFixture } = require("./helpers/construct-fixture.cjs");

const plain = value => JSON.parse(JSON.stringify(value));
const nativeProperties = [true, 1, true, true, 0, 0, 250];
const request = (id, fields = {}) => ({ kind: "selection", requestId: id, overlap: "replace", ...fields });
const samplePattern = { version: 1, events: [{ type: "continuous", timeMs: 0, durationMs: 100, intensity: 0.75, curves: { intensity: [{ timeMs: 0, value: 0 }, { timeMs: 100, value: 1 }] } }] };
const lastResult = fixture => JSON.parse(fixture.expression("LastResultJSON"));

function controlledTimers() {
  let nextId = 0;
  const pending = new Map();
  return {
    pending,
    setTimeout(callback, milliseconds) { const id = ++nextId; pending.set(id, { callback, milliseconds }); return id; },
    clearTimeout(id) { pending.delete(id); },
    expire(milliseconds) {
      for (const [id, timer] of [...pending]) if (timer.milliseconds === milliseconds) {
        pending.delete(id);
        timer.callback();
      }
    }
  };
}

function createNative(options = {}) {
  const calls = [];
  const capabilities = {
    backend: "android-vibrator", bridgeAvailable: true, hardwareAvailable: true,
    intensityControl: true, advancedPatterns: true, amplitudeControl: true,
    sharpnessControl: false, intensityCurves: true, sharpnessCurves: false,
    primitives: false, envelopes: false, fallbackInfo: "Basic vibrator approximation."
  };
  const api = {
    async getCapabilities() {
      calls.push({ action: "getCapabilities" });
      if (options.capabilityError) throw options.capabilityError;
      return structuredClone(options.capabilities || capabilities);
    },
    async setState(state) { calls.push({ action: "setState", state: structuredClone(state) }); return { ...state }; },
    async stop() { calls.push({ action: "stop" }); return { stopped: true }; },
    async play(value) {
      calls.push({ action: "play", request: structuredClone(value) });
      if (options.playError) throw options.playError;
      if (options.play) return options.play(value);
      return {
        accepted: true, requestId: value.requestId, backend: capabilities.backend,
        approximated: true, fallback: "android-waveform", reason: "scheduled",
        durationMs: value.pattern ? core.durationMs(value.pattern) : 1000,
        completion: "not-observable"
      };
    }
  };
  return { api, calls, capabilities };
}

for (const worker of [false, true]) {
  const mode = worker ? "worker messaging" : "main thread messaging";

  test(`${mode}: native initialization, semantic actions, metadata, and capability refresh`, async t => {
    const native = createNative();
    const f = await createConstructFixture({ worker, native: native.api, properties: nativeProperties });
    t.after(() => f.release());
    assert.equal(f.condition("IsReady"), true);
    assert.equal(f.condition("NativeBridgeAvailable"), true);
    assert.equal(f.condition("HapticHardwareAvailable"), true);
    assert.equal(f.condition("IntensityControlSupported"), true);
    assert.equal(f.condition("SharpnessControlSupported"), false);
    assert.equal(f.expression("Backend"), "android-vibrator");
    assert.deepEqual(JSON.parse(f.expression("CapabilitiesJSON")), native.capabilities);
    assert.deepEqual(native.calls.slice(0, 2).map(call => call.action), ["getCapabilities", "setState"]);
    assert.deepEqual(native.calls[1].state, { enabled: true, strength: 1 });
    for (let index = 0; index < 9; index++) {
      await f.action("PlayFeedback", index);
      const name = Object.keys(core.presets)[index];
      const played = native.calls.filter(call => call.action === "play").at(-1).request;
      assert.deepEqual({ ...played, requestId: undefined, overlap: undefined, strength: undefined }, { ...core.getPreset(name), requestId: undefined, overlap: undefined, strength: undefined });
      assert.equal(f.expression("LastFeedback"), name);
      assert.equal(f.expression("LastRequestId"), `supereo-${index + 1}`);
      assert.equal(lastResult(f).accepted, true);
      assert.equal(lastResult(f).fallback, "android-waveform");
      assert.equal(lastResult(f).completion, "not-observable");
      assert.equal(f.expression("LastWasApproximated"), 1);
    }
    assert.equal(f.triggers.filter(value => value === f.plugin.Cnds.OnAccepted).length, 9);
    await f.action("RefreshCapabilities");
    assert.equal(f.triggers.at(-1), f.plugin.Cnds.OnCapabilitiesRefreshed);
    assert.equal(f.vibrationCalls.length, 0);
    if (worker) assert.equal(vm.runInContext("typeof window + ':' + typeof document + ':' + typeof navigator", f.runtimeContext), "undefined:undefined:undefined");
  });

  test(`${mode}: native-required mode rejects missing bridges and never invokes browser vibration`, async t => {
    const f = await createConstructFixture({ worker, properties: nativeProperties });
    t.after(() => f.release());
    assert.equal(f.condition("IsReady"), true, "ready means the capability check completed");
    assert.equal(f.condition("NativeBridgeAvailable"), false);
    assert.equal(f.condition("HapticHardwareAvailable"), false);
    assert.equal(f.condition("IsPreviewSimulation"), false);
    assert.equal(f.expression("Backend"), "unavailable");
    assert.match(f.expression("LastError"), /native Cordova bridge is missing/i);
    assert.equal(f.triggers.length, 0, "initialization failure is queryable without an early event-sheet trigger");
    await f.action("PlayFeedback", 0);
    assert.equal(lastResult(f).accepted, false);
    assert.equal(lastResult(f).code, "native-bridge-missing");
    assert.deepEqual(f.triggers, [f.plugin.Cnds.OnError, f.plugin.Cnds.OnRejected]);
    assert.equal(f.vibrationCalls.length, 0);
  });

  test(`${mode}: explicit preview opt-in simulates feedback without hardware claims`, async t => {
    const f = await createConstructFixture({ worker, properties: [true, 0.5, false, true, 0, 0, 250] });
    t.after(() => f.release());
    assert.equal(f.condition("IsPreviewSimulation"), true);
    assert.equal(f.condition("HapticHardwareAvailable"), false);
    await f.action("RegisterPattern", "swell", JSON.stringify(samplePattern));
    await f.action("PlayPattern", "swell");
    const result = lastResult(f);
    assert.equal(result.accepted, true);
    assert.equal(result.simulated, true);
    assert.equal(result.backend, "preview-simulation");
    assert.equal(result.fallback, "visual-preview-only");
    assert.equal(result.durationMs, 100);
    assert.equal(result.completion, "not-observable");
    assert.equal(f.triggers.at(-1), f.plugin.Cnds.OnPreview);
    assert.equal(f.document.body.children.length, 1);
    assert.match(f.document.body.children[0].textContent, /no hardware exercised.*swell.*50%/s);
    assert.equal(f.document.body.children[0].children[0].children.length, 1, "the preview renders the actual custom event timeline");
    assert.equal(f.vibrationCalls.length, 0);
    await f.action("Stop");
    assert.match(f.document.body.children[0].textContent, /stopped/);
    await f.release();
    assert.equal(f.document.body.children.length, 0);
  });

  test(`${mode}: native errors propagate as rejected feedback rather than successful fallback`, async t => {
    const native = createNative({ playError: Object.assign(new Error("Engine unavailable"), { code: "HARDWARE_UNAVAILABLE" }) });
    const f = await createConstructFixture({ worker, native: native.api, properties: nativeProperties });
    t.after(() => f.release());
    await f.action("PlayFeedback", 2);
    assert.equal(lastResult(f).accepted, false);
    assert.equal(lastResult(f).code, "HARDWARE_UNAVAILABLE");
    assert.equal(lastResult(f).completion, "not-observable");
    assert.equal(f.expression("LastError"), "Engine unavailable");
    assert.deepEqual(f.triggers, [f.plugin.Cnds.OnError, f.plugin.Cnds.OnRejected]);
    assert.equal(f.condition("IsPreviewSimulation"), false);
    assert.equal(f.vibrationCalls.length, 0);
  });

  test(`${mode}: state actions stop active work, use global strength once, and suppress disabled feedback`, async t => {
    const native = createNative();
    const f = await createConstructFixture({ worker, native: native.api, properties: nativeProperties });
    t.after(() => f.release());
    await f.action("SetStrength", 0.25);
    assert.equal(f.expression("Strength"), 0.25);
    assert.deepEqual(native.calls.at(-1), { action: "setState", state: { enabled: true, strength: 0.25 } });
    await f.action("PlayFeedback", 0);
    assert.equal(native.calls.at(-1).request.strength, 1, "the per-request multiplier must not apply global strength twice");
    await f.action("SetEnabled", 0);
    assert.equal(f.condition("IsEnabled"), false);
    const count = native.calls.filter(call => call.action === "play").length;
    await f.action("PlayFeedback", 1);
    assert.equal(lastResult(f).reason, "disabled-or-zero-strength");
    assert.equal(native.calls.filter(call => call.action === "play").length, count);
    await f.action("SetEnabled", 1);
    await f.action("SetStrength", 0);
    await f.action("PlayFeedback", 1);
    assert.equal(lastResult(f).reason, "disabled-or-zero-strength");
    await f.action("SetStrength", 2);
    assert.equal(f.expression("Strength"), 0);
    assert.match(f.expression("LastError"), /number from 0 to 1/);
  });

  test(`${mode}: custom patterns validate before playback and do not serialize player settings`, async t => {
    const native = createNative();
    const f = await createConstructFixture({ worker, native: native.api, properties: nativeProperties });
    t.after(() => f.release());
    await f.action("RegisterPattern", "ramp", JSON.stringify(samplePattern));
    await f.action("PlayPattern", "ramp");
    assert.deepEqual(native.calls.at(-1).request.pattern, core.validatePattern(samplePattern));
    const count = native.calls.filter(call => call.action === "play").length;
    await f.action("RegisterPattern", "invalid", "{bad");
    assert.equal(lastResult(f).code, "INVALID_PATTERN");
    await f.action("PlayPattern", "invalid");
    assert.equal(lastResult(f).code, "pattern-not-registered");
    assert.equal(native.calls.filter(call => call.action === "play").length, count);
    assert.deepEqual(plain(f.instance._saveToJson()), {});
    f.instance._loadFromJson({ strength: 0, enabled: false });
    await f.flush();
    assert.equal(f.expression("Strength"), 1);
    assert.equal(f.condition("IsEnabled"), true);
    assert.equal(native.calls.at(-1).action, "stop");
  });
}

test("overlap-ignore drops a second busy request; replace cancels before the replacement", async t => {
  const native = createNative();
  const f = await createConstructFixture({ native: native.api, properties: nativeProperties, worker: true });
  t.after(() => f.release());
  await f.action("SetOverlapPolicy", 1);
  await f.action("PlayFeedback", 0);
  await f.action("PlayFeedback", 1);
  assert.equal(lastResult(f).accepted, false);
  assert.equal(lastResult(f).reason, "busy-ignore-policy");
  assert.equal(native.calls.filter(call => call.action === "play").length, 1);
  await f.action("SetOverlapPolicy", 0);
  await f.action("PlayFeedback", 2);
  assert.equal(lastResult(f).accepted, true);
  assert.deepEqual(native.calls.slice(-2).map(call => call.action), ["stop", "play"]);
});

test("rapid duplicates ignore request IDs and labels, while Stop resets suppression", async t => {
  const native = createNative();
  const f = await createConstructFixture({ native: native.api, properties: [true, 1, true, true, 0, 1000, 250] });
  t.after(() => f.release());
  await f.action("PlayFeedback", 0);
  await f.action("PlayFeedback", 0);
  assert.equal(lastResult(f).reason, "rapid-duplicate-suppressed");
  assert.equal(lastResult(f).requestId, "supereo-2");
  assert.equal(native.calls.filter(call => call.action === "play").length, 1);
  await f.action("Stop");
  await f.action("PlayFeedback", 0);
  assert.equal(lastResult(f).accepted, true);
  assert.equal(native.calls.filter(call => call.action === "play").length, 2);
});

test("pause, resume, visibility, and pagehide stop work without replaying it", async t => {
  const native = createNative();
  const f = await createConstructFixture({ native: native.api, properties: nativeProperties, worker: true });
  t.after(() => f.release());
  await f.action("PlayFeedback", 0);
  f.document.dispatch("pause");
  await f.action("PlayFeedback", 1);
  assert.equal(lastResult(f).reason, "cancelled-or-backgrounded");
  assert.equal(native.calls.filter(call => call.action === "play").length, 1);
  f.document.dispatch("resume");
  await f.flush();
  assert.equal(native.calls.filter(call => call.action === "play").length, 1, "resume does not replay a dropped request");
  await f.action("PlayFeedback", 1);
  assert.equal(lastResult(f).accepted, true);
  f.document.visibilityState = "hidden";
  f.document.dispatch("visibilitychange");
  await f.action("PlayFeedback", 2);
  assert.equal(lastResult(f).reason, "cancelled-or-backgrounded");
  f.document.visibilityState = "visible";
  f.document.dispatch("visibilitychange");
  f.window.dispatch("pagehide");
  await f.action("PlayFeedback", 2);
  assert.equal(lastResult(f).reason, "cancelled-or-backgrounded");
  assert.equal(native.calls.filter(call => call.action === "play").length, 2);
  const before = native.calls.length;
  await f.release();
  const afterRelease = native.calls.length;
  assert.ok(afterRelease > before);
  f.document.dispatch("pause");
  f.window.dispatch("pagehide");
  await f.flush();
  assert.equal(native.calls.length, afterRelease, "release removes lifecycle listeners");
});

test("queued native feedback is invalidated on Stop, including an in-flight late acceptance", async t => {
  let resolvePlay;
  const native = createNative({ play: () => new Promise(resolve => { resolvePlay = resolve; }) });
  const f = await createConstructFixture({ native: native.api, properties: nativeProperties });
  t.after(() => f.release());
  const first = f.message("haptics-play", request("first"));
  await f.flush();
  assert.equal(typeof resolvePlay, "function");
  const queued = f.message("haptics-play", request("queued", { kind: "impact", style: "light" }));
  await f.message("haptics-stop", {});
  resolvePlay({ accepted: true, durationMs: 1000 });
  const [firstReply, queuedReply] = await Promise.all([first, queued]);
  assert.equal(firstReply.result.accepted, false);
  assert.equal(queuedReply.result.accepted, false);
  assert.equal(firstReply.result.reason, "cancelled-or-backgrounded");
  assert.equal(queuedReply.result.reason, "cancelled-or-backgrounded");
  assert.equal(native.calls.filter(call => call.action === "play").length, 1);
  assert.equal(native.calls.at(-1).action, "stop");
});

test("a blocked native transport has a bounded request queue", async t => {
  let resolvePlay;
  const native = createNative({ play: () => new Promise(resolve => { resolvePlay = resolve; }) });
  const f = await createConstructFixture({ native: native.api, properties: nativeProperties });
  t.after(() => f.release());
  const promises = Array.from({ length: 33 }, (_, index) => f.message("haptics-play", request(String(index))));
  await f.flush();
  const overflow = await promises[32];
  assert.equal(overflow.result.accepted, false);
  assert.equal(overflow.result.code, "request-queue-full");
  await f.message("haptics-stop", {});
  resolvePlay({ accepted: true, durationMs: 100 });
  const settled = await Promise.all(promises);
  assert.equal(settled.length, 33);
  assert.equal(native.calls.filter(call => call.action === "play").length, 1);
});

test("bridge initialization errors are queryable and do not claim working hardware", async t => {
  const native = createNative({ capabilityError: Object.assign(new Error("Capability query failed"), { code: "CAPABILITY_ERROR" }) });
  const f = await createConstructFixture({ native: native.api, properties: nativeProperties });
  t.after(() => f.release());
  assert.equal(f.condition("IsReady"), true);
  assert.equal(f.condition("NativeBridgeAvailable"), true);
  assert.equal(f.condition("HapticHardwareAvailable"), false);
  assert.equal(f.expression("Backend"), "unavailable");
  assert.equal(f.expression("LastError"), "Capability query failed");
  assert.equal(f.triggers.length, 0);
});

test("the DOM play watchdog rejects a hung bridge and requests native cancellation", async t => {
  let resolvePlay;
  const native = createNative({ play: () => new Promise(resolve => { resolvePlay = resolve; }) });
  const clock = controlledTimers();
  const f = await createConstructFixture({ native: native.api, properties: nativeProperties, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  t.after(() => f.release());
  const response = f.message("haptics-play", request("hang"));
  await f.flush();
  assert.equal([...clock.pending.values()][0].milliseconds, 4000);
  clock.expire(4000);
  const reply = await response;
  assert.equal(reply.result.accepted, false);
  assert.equal(reply.result.code, "native-timeout");
  assert.equal(reply.result.completion, "not-observable");
  assert.equal(native.calls.at(-1).action, "stop");
  resolvePlay({ accepted: true, durationMs: 100 });
  await f.flush();
  assert.equal(clock.pending.size, 0);
});

test("the initialization watchdog settles readiness without claiming hardware after a hung capability query", async t => {
  const clock = controlledTimers();
  const native = createNative();
  let started;
  const instanceCreated = new Promise(resolve => { started = resolve; });
  native.api.getCapabilities = () => new Promise(() => {});
  const initialization = createConstructFixture({ native: native.api, properties: nativeProperties, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, onInstanceCreated: started });
  await instanceCreated;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal([...clock.pending.values()][0].milliseconds, 250);
  clock.expire(250);
  const f = await initialization;
  t.after(() => f.release());
  assert.equal(f.condition("IsReady"), true);
  assert.equal(f.condition("NativeBridgeAvailable"), true);
  assert.equal(f.condition("HapticHardwareAvailable"), false);
  assert.equal(f.expression("Backend"), "unavailable");
  assert.match(f.expression("LastError"), /within 250 ms/);
  assert.equal(clock.pending.size, 0);
});

test("release drops late native replies and subsequent runtime actions", async () => {
  let resolvePlay;
  const native = createNative({ play: () => new Promise(resolve => { resolvePlay = resolve; }) });
  const f = await createConstructFixture({ native: native.api, properties: nativeProperties, worker: true });
  await f.action("PlayFeedback", 0);
  assert.equal(typeof resolvePlay, "function");
  await f.release();
  resolvePlay({ accepted: true, durationMs: 100 });
  await f.flush();
  assert.equal(f.triggers.length, 0);
  assert.equal(f.instance.baseReleased, true);
  const count = native.calls.filter(call => call.action === "play").length;
  await f.action("PlayFeedback", 1);
  assert.equal(native.calls.filter(call => call.action === "play").length, count);
});

test("native accepted:false replies retain error metadata and trigger rejection", async t => {
  const native = createNative({ play: async () => ({ accepted: false, code: "UNSUPPORTED_PATTERN", reason: "Envelope support unavailable", fallback: "", durationMs: 0 }) });
  const f = await createConstructFixture({ native: native.api, properties: nativeProperties });
  t.after(() => f.release());
  await f.action("PlayFeedback", 0);
  assert.equal(lastResult(f).accepted, false);
  assert.equal(lastResult(f).code, "UNSUPPORTED_PATTERN");
  assert.equal(f.expression("LastError"), "Envelope support unavailable");
  assert.deepEqual(f.triggers, [f.plugin.Cnds.OnError, f.plugin.Cnds.OnRejected]);
  assert.equal(f.vibrationCalls.length, 0);
});

test("named pattern registration is bounded and existing names can be replaced", async t => {
  const f = await createConstructFixture({ properties: [true, 1, false, true, 0, 0, 250] });
  t.after(() => f.release());
  for (let index = 0; index < 64; index++) await f.action("RegisterPattern", `pattern-${index}`, JSON.stringify(samplePattern));
  await f.action("RegisterPattern", "overflow", JSON.stringify(samplePattern));
  assert.equal(lastResult(f).code, "pattern-registry-full");
  const replacement = { version: 1, events: [{ type: "transient", timeMs: 10, intensity: 1 }] };
  await f.action("RegisterPattern", "pattern-0", JSON.stringify(replacement));
  await f.action("PlayPattern", "pattern-0");
  assert.equal(lastResult(f).accepted, true);
  assert.equal(lastResult(f).durationMs, 22);
  await f.action("RegisterPattern", " ", JSON.stringify(samplePattern));
  assert.equal(lastResult(f).code, "invalid-pattern-name");
});

test("play waits for an asynchronous strength update before dispatching native feedback", async t => {
  const native = createNative();
  let resolveState;
  const f = await createConstructFixture({ native: native.api, properties: nativeProperties });
  t.after(() => f.release());
  native.api.setState = state => {
    native.calls.push({ action: "setState", state: structuredClone(state) });
    return new Promise(resolve => { resolveState = resolve; });
  };
  await f.action("SetStrength", 0.25);
  assert.equal(typeof resolveState, "function");
  await f.action("PlayFeedback", 0);
  assert.equal(native.calls.filter(call => call.action === "play").length, 0);
  resolveState({ enabled: true, strength: 0.25 });
  await f.flush();
  assert.equal(native.calls.filter(call => call.action === "play").length, 1);
  assert.equal(native.calls.at(-1).request.strength, 1);
  assert.equal(f.expression("Strength"), 0.25);
  assert.equal(lastResult(f).accepted, true);
});

test("rapid state changes preserve ordered snapshots and play uses the latest strength", async t => {
  const native = createNative();
  const pending = [];
  const f = await createConstructFixture({ native: native.api, properties: nativeProperties, worker: true });
  t.after(() => f.release());
  native.api.setState = state => {
    native.calls.push({ action: "setState", state: structuredClone(state) });
    return new Promise(resolve => pending.push(resolve));
  };
  await f.action("SetStrength", 0.25);
  await f.action("SetStrength", 0.75);
  await f.action("PlayFeedback", 0);
  assert.equal(pending.length, 1, "the second native update waits for the first");
  assert.equal(native.calls.at(-1).state.strength, 0.25);
  assert.equal(native.calls.filter(call => call.action === "play").length, 0);
  pending[0]({ enabled: true, strength: 0.25 });
  await f.flush();
  assert.equal(pending.length, 2);
  assert.equal(native.calls.at(-1).state.strength, 0.75);
  assert.equal(native.calls.filter(call => call.action === "play").length, 0);
  pending[1]({ enabled: true, strength: 0.75 });
  await f.flush();
  assert.equal(native.calls.filter(call => call.action === "play").length, 1);
  assert.equal(f.expression("Strength"), 0.75);
  assert.equal(lastResult(f).accepted, true);
});

test("an initialization state failure blocks playback until capability refresh successfully reinitializes", async t => {
  const native = createNative();
  let failState = true;
  native.api.setState = async state => {
    native.calls.push({ action: "setState", state: structuredClone(state) });
    if (failState) throw Object.assign(new Error("Initial settings failed"), { code: "STATE_ERROR" });
    return state;
  };
  const f = await createConstructFixture({ native: native.api, properties: nativeProperties, worker: true });
  t.after(() => f.release());
  assert.equal(f.condition("IsReady"), true);
  assert.equal(f.expression("Backend"), "unavailable");
  assert.equal(f.expression("LastError"), "Initial settings failed");
  await f.action("PlayFeedback", 0);
  assert.equal(lastResult(f).accepted, false);
  assert.equal(lastResult(f).code, "native-bridge-not-ready");
  assert.equal(native.calls.filter(call => call.action === "play").length, 0);
  failState = false;
  await f.action("RefreshCapabilities");
  assert.equal(f.expression("Backend"), "android-vibrator");
  assert.equal(f.expression("LastError"), "");
  assert.equal(native.calls.filter(call => call.action === "setState").length, 2);
  await f.action("PlayFeedback", 0);
  assert.equal(lastResult(f).accepted, true);
  assert.equal(native.calls.filter(call => call.action === "play").length, 1);
});

test("release during a delayed initial capability query prevents subsequent native state updates", async () => {
  const native = createNative();
  let resolveCapabilities;
  let earlyInstance;
  let started;
  const instanceCreated = new Promise(resolve => { started = resolve; });
  native.api.getCapabilities = () => new Promise(resolve => { resolveCapabilities = resolve; });
  const initialization = createConstructFixture({
    native: native.api, properties: nativeProperties,
    onInstanceCreated({ instance }) { earlyInstance = instance; started(); }
  });
  await instanceCreated;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof resolveCapabilities, "function");
  earlyInstance._release();
  await new Promise(resolve => setImmediate(resolve));
  resolveCapabilities(native.capabilities);
  const f = await initialization;
  assert.equal(native.calls.filter(call => call.action === "setState").length, 0);
  assert.equal(native.calls.filter(call => call.action === "play").length, 0);
  assert.equal(f.triggers.length, 0);
  assert.equal(earlyInstance.baseReleased, true);
});

test("failed asynchronous state updates block playback and refresh retries the settings", async t => {
  const native = createNative();
  const f = await createConstructFixture({ native: native.api, properties: nativeProperties });
  t.after(() => f.release());
  let failState = true;
  native.api.setState = async state => {
    native.calls.push({ action: "setState", state: structuredClone(state) });
    if (failState) throw Object.assign(new Error("Native state update failed"), { code: "STATE_ERROR" });
    return state;
  };
  await f.action("SetStrength", 0.5);
  assert.equal(f.expression("LastError"), "Native state update failed");
  await f.action("PlayFeedback", 0);
  assert.equal(lastResult(f).accepted, false);
  assert.equal(lastResult(f).code, "STATE_ERROR");
  assert.equal(native.calls.filter(call => call.action === "play").length, 0);
  failState = false;
  await f.action("RefreshCapabilities");
  assert.equal(f.expression("LastError"), "");
  assert.deepEqual(native.calls.at(-1), { action: "setState", state: { enabled: true, strength: 0.5 } });
  await f.action("PlayFeedback", 0);
  assert.equal(lastResult(f).accepted, true);
});

for (const [ageMs, accepted] of [[1000, true], [1001, false]]) test(`queued cue freshness ${accepted ? "accepts the 1000 ms boundary" : "drops cues older than 1000 ms after bridge recovery"}`, async t => {
  let now = 0;
  let resolveFirst;
  const native = createNative({ play: value => value.requestId === "blocking" ? new Promise(resolve => { resolveFirst = resolve; }) : Promise.resolve({ accepted: true, durationMs: 35 }) });
  const f = await createConstructFixture({ native: native.api, properties: nativeProperties, worker: true, performance: { now: () => now } });
  t.after(() => f.release());
  const first = f.message("haptics-play", request("blocking"));
  await f.flush();
  const queued = f.message("haptics-play", request("queued", { kind: "impact", style: "light" }));
  now = ageMs;
  resolveFirst({ accepted: true, durationMs: 35 });
  const [, reply] = await Promise.all([first, queued]);
  assert.equal(reply.result.accepted, accepted);
  if (!accepted) assert.equal(reply.result.reason, "stale-request-dropped");
  assert.equal(native.calls.filter(call => call.action === "play").length, accepted ? 2 : 1);
  assert.equal(f.vibrationCalls.length, 0);
});

test("cue freshness is checked after a delayed native settings barrier", async t => {
  let now = 0;
  let resolveState;
  const native = createNative();
  const f = await createConstructFixture({ native: native.api, properties: nativeProperties, performance: { now: () => now } });
  t.after(() => f.release());
  native.api.setState = () => new Promise(resolve => { resolveState = resolve; });
  await f.action("SetStrength", 0.5);
  const queued = f.message("haptics-play", request("waiting-for-state"));
  await f.flush();
  now = 1001;
  resolveState({ enabled: true, strength: 0.5 });
  const reply = await queued;
  assert.equal(reply.result.accepted, false);
  assert.equal(reply.result.reason, "stale-request-dropped");
  assert.equal(native.calls.filter(call => call.action === "play").length, 0);
  assert.equal(f.vibrationCalls.length, 0);
});

test("cue freshness is checked after delayed initial capabilities and settings", async t => {
  let now = 0;
  let resolveCapabilities;
  let queued;
  let started;
  const instanceCreated = new Promise(resolve => { started = resolve; });
  const native = createNative();
  native.api.getCapabilities = () => new Promise(resolve => { resolveCapabilities = resolve; });
  const initializing = createConstructFixture({
    native: native.api, properties: nativeProperties, performance: { now: () => now },
    onInstanceCreated({ instance }) { queued = instance._postToDOMAsync("haptics-play", request("waiting-for-init")); started(); }
  });
  await instanceCreated;
  await new Promise(resolve => setImmediate(resolve));
  now = 1001;
  resolveCapabilities(native.capabilities);
  const f = await initializing;
  t.after(() => f.release());
  const reply = await queued;
  assert.equal(reply.result.accepted, false);
  assert.equal(reply.result.reason, "stale-request-dropped");
  assert.equal(native.calls.filter(call => call.action === "setState").length, 1, "initialization itself finishes successfully");
  assert.equal(native.calls.filter(call => call.action === "play").length, 0);
  assert.equal(f.vibrationCalls.length, 0);
});

test("cue freshness is checked again after a slow replacement Stop and before native dispatch", async t => {
  let now = 0;
  let resolveStop;
  let blockStop = true;
  const native = createNative();
  const f = await createConstructFixture({ native: native.api, properties: nativeProperties, performance: { now: () => now } });
  t.after(() => f.release());
  native.api.stop = () => {
    native.calls.push({ action: "stop" });
    if (blockStop) { blockStop = false; return new Promise(resolve => { resolveStop = resolve; }); }
    return Promise.resolve({ stopped: true });
  };
  const response = f.message("haptics-play", request("waiting-for-stop"));
  await f.flush();
  assert.equal(typeof resolveStop, "function", "the request was fresh when replacement began");
  now = 1001;
  resolveStop({ stopped: true });
  const reply = await response;
  assert.equal(reply.result.accepted, false);
  assert.equal(reply.result.reason, "stale-request-dropped");
  assert.equal(native.calls.filter(call => call.action === "play").length, 0);
  assert.equal(f.vibrationCalls.length, 0);
});
