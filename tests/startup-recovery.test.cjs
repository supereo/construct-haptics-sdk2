"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createConstructFixture } = require("./helpers/construct-fixture.cjs");

const properties = [true, 1, true, true, 0, 0, 250];
const result = f => JSON.parse(f.expression("LastResultJSON"));
const turn = () => new Promise(resolve => setImmediate(resolve));

function timers() {
  let id = 0;
  const pending = new Map();
  return {
    pending,
    setTimeout(callback, milliseconds) { pending.set(++id, { callback, milliseconds }); return id; },
    clearTimeout(key) { pending.delete(key); },
    expire(milliseconds) {
      for (const [key, entry] of [...pending]) if (entry.milliseconds === milliseconds) {
        pending.delete(key); entry.callback();
      }
    }
  };
}

function nativeBridge() {
  const calls = [];
  const caps = { backend: "ios-uikit", bridgeAvailable: true, hardwareAvailable: true, intensityControl: true, advancedPatterns: false, fallbackInfo: "Native test host only." };
  const api = {
    async getCapabilities() { calls.push({ action: "capabilities" }); return { ...caps }; },
    async setState(state) { calls.push({ action: "state", state: structuredClone(state) }); return state; },
    async stop() { calls.push({ action: "stop" }); return {}; },
    async play(request) { calls.push({ action: "play", request: structuredClone(request) }); return { accepted: true, backend: caps.backend, durationMs: 35 }; }
  };
  return { api, calls, caps };
}

async function begin(options) {
  let created;
  const ready = new Promise(resolve => { created = resolve; });
  const initializing = createConstructFixture({ ...options, onInstanceCreated: created });
  const early = await ready;
  await turn();
  return { initializing, early };
}

for (const worker of [false, true]) {
  const mode = worker ? "worker" : "main thread";

  test(`${mode}: unanswered SDK initialization settles, explicit refresh resends configuration, and a tardy reply cannot overwrite recovery`, async t => {
    const clock = timers(), native = nativeBridge();
    let dropped = true, answerOld;
    const { initializing } = await begin({ worker, native: native.api, properties,
      setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
      domTransport(name, _payload, dispatch) {
        if (name === "haptics-init" && dropped) return new Promise(resolve => { answerOld = resolve; });
        return dispatch();
      }
    });
    assert.deepEqual([...clock.pending.values()].map(job => job.milliseconds), [1000]);
    clock.expire(1000);
    const f = await initializing; t.after(() => f.release());
    assert.equal(f.condition("IsReady"), true);
    assert.equal(f.expression("Backend"), "unavailable");
    assert.equal(result(f).operation, "initialize");
    assert.equal(result(f).code, "runtime-initialization-timeout");
    assert.equal(f.triggers.length, 0);
    assert.equal(clock.pending.size, 0);
    await f.action("SetStrength", 0.6);
    await f.action("SetEnabled", 0);
    assert.equal(f.condition("IsReady"), true, "settings cannot restore the unanswered handler's initializing status");
    dropped = false;
    await f.action("RefreshCapabilities");
    assert.equal(f.messages.filter(message => message.name === "haptics-init").length, 2);
    assert.equal(f.expression("Backend"), "ios-uikit");
    assert.equal(f.condition("IsReady"), true);
    assert.equal(f.expression("LastError"), "");
    assert.equal(result(f).operation, "capabilities");
    answerOld({ ready: false, enabled: true, strength: 0, capabilities: { backend: "obsolete", hardwareAvailable: false } });
    await f.flush();
    assert.equal(f.expression("Backend"), "ios-uikit");
    assert.equal(f.condition("IsReady"), true);
    assert.equal(f.condition("IsEnabled"), false);
    assert.equal(f.expression("Strength"), 0.6);
    assert.equal(f.messages.filter(message => message.name === "haptics-init").at(-1).data.strength, 0.6);
    assert.equal(f.messages.filter(message => message.name === "haptics-init").at(-1).data.enabled, false);
    await f.action("PlayFeedback", 1);
    assert.equal(result(f).reason, "disabled-or-zero-strength");
    assert.equal(native.calls.filter(call => call.action === "play").length, 0);
    await f.action("SetEnabled", 1);
    await f.action("PlayFeedback", 1);
    assert.equal(result(f).accepted, true);
    assert.equal(native.calls.filter(call => call.action === "play").length, 1);
    assert.equal(clock.pending.size, 0);
  });

  test(`${mode}: rejected initialization transport records a settled initialize error`, async t => {
    const clock = timers();
    const f = await createConstructFixture({ worker, properties,
      setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
      domTransport(name, _payload, dispatch) {
        if (name === "haptics-init") throw Object.assign(new Error("DOM transport unavailable"), { code: "TRANSPORT_UNAVAILABLE" });
        return dispatch();
      }
    }); t.after(() => f.release());
    assert.equal(f.condition("IsReady"), true);
    assert.equal(f.expression("Backend"), "unavailable");
    assert.equal(f.condition("HapticHardwareAvailable"), false);
    assert.equal(result(f).operation, "initialize");
    assert.equal(result(f).code, "TRANSPORT_UNAVAILABLE");
    assert.equal(f.triggers.length, 0);
    assert.equal(clock.pending.size, 0);
  });

  test(`${mode}: releasing an unanswered initialization clears its watchdog and global load promise`, async () => {
    const clock = timers();
    const { initializing, early } = await begin({ worker, properties,
      setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
      domTransport(name, _payload, dispatch) { return name === "haptics-init" ? new Promise(() => {}) : dispatch(); }
    });
    assert.equal(clock.pending.size, 1);
    early.instance._release();
    const f = await initializing;
    assert.equal(f.instance.baseReleased, true);
    assert.equal(clock.pending.size, 0);
    assert.equal(f.triggers.length, 0);
  });

  test(`${mode}: retained deviceready recovers a late Supereo namespace using current settings`, async t => {
    const clock = timers(), native = nativeBridge(), cordova = { plugins: {} };
    const { initializing } = await begin({ worker, cordova, properties,
      setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout
    });
    clock.expire(250);
    const f = await initializing; t.after(() => f.release());
    assert.equal(result(f).code, "native-bridge-missing");
    await f.action("SetStrength", 0.35);
    cordova.plugins.SupereoHaptics = native.api;
    f.document.dispatch("deviceready"); await f.flush();
    assert.equal(f.expression("Backend"), "ios-uikit");
    assert.equal(f.expression("LastError"), "");
    assert.deepEqual(native.calls.find(call => call.action === "state").state, { enabled: true, strength: 0.35 });
    assert.equal(native.calls.filter(call => call.action === "play").length, 0, "late discovery never replays feedback");
    await f.action("PlayFeedback", 0);
    assert.equal(result(f).accepted, true);
    await f.release();
    const count = native.calls.length;
    f.document.dispatch("deviceready"); f.document.dispatch("resume"); await f.flush();
    assert.equal(native.calls.length, count);
    assert.equal([...f.document.listeners.values()].reduce((sum, set) => sum + set.size, 0), 0);
    assert.equal(clock.pending.size, 0);
  });

  test(`${mode}: foreground recovery retries failed initialization and drops background feedback`, async t => {
    const native = nativeBridge(); let fail = true;
    native.api.getCapabilities = async () => {
      native.calls.push({ action: "capabilities" });
      if (fail) throw Object.assign(new Error("Initial native query failed"), { code: "QUERY_FAILED" });
      return { ...native.caps };
    };
    const f = await createConstructFixture({ worker, native: native.api, properties }); t.after(() => f.release());
    assert.equal(f.expression("Backend"), "unavailable");
    f.document.dispatch("pause");
    await f.action("PlayFeedback", 0);
    assert.equal(result(f).reason, "cancelled-or-backgrounded");
    await f.action("SetStrength", 0.55);
    fail = false;
    f.document.dispatch("resume"); await f.flush();
    assert.equal(f.expression("Backend"), "ios-uikit");
    assert.equal(f.expression("LastError"), "");
    assert.deepEqual(native.calls.filter(call => call.action === "state").at(-1).state, { enabled: true, strength: 0.55 });
    assert.equal(native.calls.filter(call => call.action === "play").length, 0);
    await f.action("PlayFeedback", 1);
    assert.equal(result(f).accepted, true);
  });

  test(`${mode}: failed refresh clears stale hardware capabilities and blocks native playback until retry`, async t => {
    const native = nativeBridge();
    const f = await createConstructFixture({ worker, native: native.api, properties }); t.after(() => f.release());
    native.api.getCapabilities = async () => { throw Object.assign(new Error("Current capability query failed"), { code: "QUERY_FAILED" }); };
    await f.action("RefreshCapabilities");
    assert.equal(f.condition("IsReady"), true, "capability checking completed even when unavailable");
    assert.equal(f.condition("NativeBridgeAvailable"), true, "the namespace still exists");
    assert.equal(f.condition("HapticHardwareAvailable"), false);
    assert.equal(f.condition("IntensityControlSupported"), false);
    assert.equal(f.expression("Backend"), "unavailable");
    assert.equal(result(f).operation, "capabilities");
    assert.equal(result(f).code, "QUERY_FAILED");
    await f.action("PlayFeedback", 0);
    assert.equal(result(f).code, "native-bridge-not-ready");
    assert.equal(native.calls.filter(call => call.action === "play").length, 0);
    native.api.getCapabilities = async () => ({ ...native.caps });
    await f.action("RefreshCapabilities"); await f.action("PlayFeedback", 0);
    assert.equal(result(f).accepted, true);
  });

  test(`${mode}: an old refresh cannot clear a later settings failure`, async t => {
    const native = nativeBridge();
    const f = await createConstructFixture({ worker, native: native.api, properties }); t.after(() => f.release());
    let resolveOld;
    native.api.setState = state => {
      native.calls.push({ action: "state", state: structuredClone(state) });
      if (state.strength === 1) return new Promise(resolve => { resolveOld = resolve; });
      return Promise.reject(Object.assign(new Error("Latest strength update failed"), { code: "LATEST_STATE_FAILED" }));
    };
    const refreshing = f.message("haptics-capabilities", {}); await f.flush();
    const setting = f.message("haptics-state", { enabled: true, strength: 0.8 }); await f.flush();
    assert.equal(native.calls.filter(call => call.action === "state" && call.state.strength === 0.8).length, 0, "the newer setting must wait for refresh");
    resolveOld({ enabled: true, strength: 1 });
    await Promise.all([refreshing, setting]);
    const played = await f.message("haptics-play", { kind: "selection", requestId: "after-state-failure", overlap: "replace" });
    assert.equal(played.result.accepted, false);
    assert.equal(played.result.code, "LATEST_STATE_FAILED");
    assert.equal(native.calls.filter(call => call.action === "play").length, 0);
  });

  test(`${mode}: pre-pause capability replies cannot publish after foreground recovery`, async t => {
    const native = nativeBridge();
    const f = await createConstructFixture({ worker, native: native.api, properties }); t.after(() => f.release());
    let answerOld;
    native.api.getCapabilities = () => new Promise(resolve => { answerOld = resolve; });
    const oldRefresh = f.message("haptics-capabilities", {}); await f.flush();
    f.document.dispatch("pause"); f.document.dispatch("resume");
    native.api.getCapabilities = async () => ({ ...native.caps, fallbackInfo: "current foreground" });
    answerOld({ ...native.caps, backend: "obsolete-before-pause" });
    const stale = await oldRefresh;
    assert.equal(stale.result.accepted, false);
    assert.equal(stale.result.code, "backgrounded-during-capability-refresh");
    await f.flush();
    assert.equal(f.expression("Backend"), "ios-uikit");
    assert.equal(f.expression("FallbackInfo"), "current foreground");
    assert.equal(native.calls.filter(call => call.action === "play").length, 0);
  });

  test(`${mode}: fresh foreground feedback waits for lifecycle cancellation and handshake`, async t => {
    const native = nativeBridge();
    const f = await createConstructFixture({ worker, native: native.api, properties }); t.after(() => f.release());
    const stops = [];
    native.api.stop = () => new Promise(resolve => { native.calls.push({ action: "stop" }); stops.push(resolve); });
    f.document.dispatch("pause"); f.document.dispatch("resume");
    await f.action("SetOverlapPolicy", 1);
    await f.action("PlayFeedback", 0);
    assert.equal(stops.length, 2);
    assert.equal(native.calls.filter(call => call.action === "play").length, 0);
    stops[1]({}); await f.flush();
    assert.equal(native.calls.filter(call => call.action === "play").length, 0, "resume stop alone cannot outrun the preceding pause stop");
    stops[0]({}); await f.flush();
    assert.equal(native.calls.filter(call => call.action === "play").length, 1);
    assert.equal(result(f).accepted, true);
    native.api.stop = async () => ({});
  });

  test(`${mode}: concurrent refreshes run in order and release cancels pending watchdogs`, async t => {
    const native = nativeBridge(), clock = timers();
    const f = await createConstructFixture({ worker, native: native.api, properties,
      setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
    t.after(() => f.release());
    const answers = [];
    native.api.getCapabilities = () => new Promise(resolve => { answers.push(resolve); });
    const first = f.message("haptics-capabilities", {});
    const second = f.message("haptics-capabilities", {});
    await f.flush();
    assert.equal(answers.length, 1, "refresh queries cannot overlap");
    answers[0]({ ...native.caps, fallbackInfo: "first query" }); await first; await f.flush();
    assert.equal(answers.length, 2);
    answers[1]({ ...native.caps, fallbackInfo: "second query" }); await second;
    assert.equal(f.handler._caps.fallbackInfo, "second query");
    const pending = f.message("haptics-capabilities", {}); await f.flush();
    assert.equal(clock.pending.size, 1);
    const stateCount = native.calls.filter(call => call.action === "state").length;
    await f.release(); await pending;
    assert.equal(clock.pending.size, 0);
    answers[2]({ ...native.caps, fallbackInfo: "late after release" }); await f.flush();
    assert.equal(native.calls.filter(call => call.action === "state").length, stateCount);
    assert.equal(f.handler._caps.fallbackInfo, "second query");
  });

  test(`${mode}: foreground failures notify existing OnError after startup and remain queryable`, async t => {
    const native = nativeBridge();
    const f = await createConstructFixture({ worker, native: native.api, properties }); t.after(() => f.release());
    assert.equal(f.triggers.length, 0);
    native.api.getCapabilities = async () => { throw Object.assign(new Error("Foreground handshake failed"), { code: "FOREGROUND_FAILED" }); };
    f.document.dispatch("pause"); f.document.dispatch("resume"); await f.flush();
    assert.deepEqual(f.triggers, [f.plugin.Cnds.OnError]);
    assert.equal(result(f).operation, "capabilities");
    assert.equal(result(f).code, "FOREGROUND_FAILED");
    assert.equal(f.expression("Backend"), "unavailable");
    assert.equal(f.condition("HapticHardwareAvailable"), false);
  });

  test(`${mode}: release cancels native initialization and its outer SDK deadline without a late state update`, async () => {
    const native = nativeBridge(), clock = timers(); let lateCapabilities;
    native.api.getCapabilities = () => new Promise(resolve => { lateCapabilities = resolve; });
    const { initializing, early } = await begin({ worker, native: native.api, properties,
      setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
    assert.equal(clock.pending.size, 2);
    early.instance._release();
    const f = await initializing; await f.flush();
    assert.equal(clock.pending.size, 0);
    assert.equal([...f.document.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0), 0);
    lateCapabilities(native.caps); await f.flush();
    assert.equal(native.calls.filter(call => call.action === "state").length, 0);
    assert.equal(f.triggers.length, 0);
  });

  test(`${mode}: release before deferred initialization dispatch cannot reinstall listeners or timers`, async () => {
    const clock = timers();
    const f = await createConstructFixture({ worker, cordova: { plugins: {} }, properties,
      setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
      onInstanceCreated({ instance }) { instance._release(); }
    });
    await f.flush();
    assert.equal(f.messages.filter(message => message.name === "haptics-init").length, 0);
    assert.equal(f.handler._released, true);
    assert.equal(clock.pending.size, 0);
    assert.equal([...f.document.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0), 0);
    await f.message("haptics-init", { enabled: true, strength: 1, bridgeWaitMs: 250 });
    assert.equal(clock.pending.size, 0);
    assert.equal([...f.document.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0), 0);
  });

  test(`${mode}: delivering an obsolete initialization request after timeout cannot reset newer player settings`, async t => {
    const clock = timers(), native = nativeBridge(); let delayedDispatch;
    let first = true;
    const { initializing } = await begin({ worker, native: native.api, properties,
      setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
      domTransport(name, _payload, dispatch) {
        if (name === "haptics-init" && first) {
          first = false;
          return new Promise(resolve => { delayedDispatch = () => resolve(dispatch()); });
        }
        return dispatch();
      }
    });
    clock.expire(1000);
    const f = await initializing; t.after(() => f.release());
    await f.action("SetStrength", 0.6); await f.action("SetEnabled", 0);
    delayedDispatch(); await f.flush();
    assert.equal(f.handler._enabled, false);
    assert.equal(f.handler._strength, 0.6);
    await f.action("RefreshCapabilities");
    assert.equal(f.condition("IsEnabled"), false);
    assert.equal(f.expression("Strength"), 0.6);
    assert(native.calls.filter(call => call.action === "state").every(call => call.state.enabled === false && call.state.strength === 0.6));
    await f.action("PlayFeedback", 1);
    assert.equal(result(f).reason, "disabled-or-zero-strength");
    assert.equal(native.calls.filter(call => call.action === "play").length, 0);
  });
}
