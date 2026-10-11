"use strict";

const assert = require("node:assert/strict");
const { createConstructFixture } = require("./construct-fixture.cjs");

async function assertMissingSupereoBridge({ worker, sources, readySignal = "timeout", emptyPluginsNamespace = false }) {
  const timers = new Map();
  let timerId = 0;
  const foreignCalls = [];
  const TapticEngine = Object.fromEntries(["selection", "impact", "notification", "selectionStart", "selectionChanged", "selectionEnd"].map(method => [method, (...args) => {
    foreignCalls.push({ method, args });
    throw new Error("An unrelated TapticEngine plugin must not stand in for SupereoHaptics.");
  }]));
  // cordova-plugin-taptic-engine exposes TapticEngine. Its presence does not
  // provide cordova.plugins.SupereoHaptics or that bridge's protocol.
  const cordova = { platformId: "ios", require(id) {
    if (id === "cordova-plugin-taptic-engine.TapticEngine") return TapticEngine;
    throw new Error("Missing Cordova module: " + id);
  } };
  if (emptyPluginsNamespace) cordova.plugins = {};
  let earlyDocument;
  let started;
  const instanceCreated = new Promise(resolve => { started = resolve; });
  const unhandled = [];
  const recordUnhandled = reason => { unhandled.push(reason); };
  process.on("unhandledRejection", recordUnhandled);
  let f;
  try {
    const initialization = createConstructFixture({
      worker, sources, cordova, domGlobals: { TapticEngine },
      properties: [true, 1, true, true, 0, 0, 250],
      setTimeout(callback, milliseconds) {
        const id = ++timerId;
        timers.set(id, { callback, milliseconds });
        return id;
      },
      clearTimeout(id) { timers.delete(id); },
      onInstanceCreated({ document }) { earlyDocument = document; started(); }
    });
    await instanceCreated;
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual([...timers.values()].map(timer => timer.milliseconds).sort((a, b) => a - b), [250, 1000], "namespace wait and entire runtime initialization each have bounded windows");
    if (readySignal === "deviceready") earlyDocument.dispatch("deviceready");
    else {
      for (const [id, timer] of [...timers]) if (timer.milliseconds === 250) {
        timers.delete(id);
        timer.callback();
      }
    }
    f = await initialization;
    assert.equal(f.condition("IsReady"), true, "a missing plugin cannot prevent Construct's load promise settling");
    assert.equal(f.condition("NativeBridgeAvailable"), false);
    assert.equal(f.condition("HapticHardwareAvailable"), false);
    assert.equal(f.condition("IsPreviewSimulation"), false);
    assert.equal(f.expression("Backend"), "unavailable");
    const initialResult = JSON.parse(f.expression("LastResultJSON"));
    assert.equal(initialResult.accepted, false);
    assert.equal(initialResult.operation, "initialize");
    assert.equal(initialResult.code, "native-bridge-missing");
    assert.match(f.expression("LastError"), /Supereo native bridge is missing/i);
    assert.match(f.expression("FallbackInfo"), /cordova-plugin-supereo-haptics/);
    assert.equal(f.triggers.length, 0, "startup records its structured error without throwing or firing an early event");
    assert.equal(timers.size, 0);
    assert.equal(earlyDocument.listeners.get("deviceready").size, 1, "one retained readiness listener can discover a bridge appearing later");

    for (let index = 0; index < 9; index++) {
      await f.action("PlayFeedback", index);
      const result = JSON.parse(f.expression("LastResultJSON"));
      assert.equal(result.accepted, false);
      assert.equal(result.code, "native-bridge-missing");
      assert.equal(f.triggers.at(-1), f.plugin.Cnds.OnRejected);
    }
    const pattern = { version: 1, events: [{ type: "transient", timeMs: 0, intensity: 1 }] };
    await f.action("RegisterPattern", "missing-bridge-check", JSON.stringify(pattern));
    await f.action("PlayPattern", "missing-bridge-check");
    assert.equal(JSON.parse(f.expression("LastResultJSON")).code, "native-bridge-missing");
    assert.equal(f.expression("LastFeedback"), "missing-bridge-check");

    await f.action("SetEnabled", 0);
    await f.action("SetStrength", 0.4);
    assert.equal(f.condition("IsEnabled"), false);
    assert.equal(f.expression("Strength"), 0.4);
    await f.action("PlayFeedback", 0);
    assert.equal(JSON.parse(f.expression("LastResultJSON")).reason, "disabled-or-zero-strength");
    await f.action("SetEnabled", 1);
    await f.action("SetOverlapPolicy", 1);
    await f.action("PlayFeedback", 0);
    assert.equal(f.messages.filter(message => message.name === "haptics-play").at(-1).data.overlap, "ignore");
    assert.equal(JSON.parse(f.expression("LastResultJSON")).code, "native-bridge-missing");
    await f.action("RefreshCapabilities");
    assert.equal(f.condition("NativeBridgeAvailable"), false);
    assert.equal(f.triggers.at(-1), f.plugin.Cnds.OnCapabilitiesRefreshed);
    await f.action("Stop");
    assert.equal(JSON.parse(f.expression("LastResultJSON")).operation, "stop");
    assert.equal(JSON.parse(f.expression("LastResultJSON")).accepted, true, "local Stop and settings remain usable without a native bridge");
    assert.equal(f.domContext.TapticEngine, TapticEngine);
    assert.equal(f.domContext.cordova, cordova);
    assert.equal(foreignCalls.length, 0);
    assert.equal(f.vibrationCalls.length, 0);
    assert.equal(timers.size, 0);
    await f.flush();
    assert.equal(unhandled.length, 0);
  } finally {
    if (f) await f.release();
    process.removeListener("unhandledRejection", recordUnhandled);
  }
}

module.exports = { assertMissingSupereoBridge };
