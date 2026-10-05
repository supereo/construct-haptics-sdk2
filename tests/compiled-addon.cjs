"use strict";

// Run after `npm run build`: this verifies the actual minified distributable,
// rather than minifying a separate copy with possibly different build options.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { unzipSync, strFromU8 } = require("fflate");
const { createConstructFixture } = require("./helpers/construct-fixture.cjs");
const root = path.resolve(__dirname, "..");
const { version } = require("../package.json");
const artifactName = `Supereo_Haptics-${version}.c3addon`;
const artifact = fs.readFileSync(path.join(root, "dist", artifactName));
const files = unzipSync(artifact);
const metadata = JSON.parse(strFromU8(files["addon.json"]));
const sources = { "lib/core.js": strFromU8(files["c3runtime/haptics-core.js"]) };
for (const [name, bytes] of Object.entries(files)) if (name.startsWith("c3runtime/") && name.endsWith(".js")) sources[`addon/${name}`] = strFromU8(bytes);

test("the generated addon contains exactly its declared files and matches its checksum", () => {
  assert.deepEqual(Object.keys(files).sort(), metadata["file-list"].sort());
  const checksum = crypto.createHash("sha256").update(artifact).digest("hex");
  const lines = fs.readFileSync(path.join(root, "dist/SHA256SUMS"), "utf8").trim().split("\n");
  assert.ok(lines.includes(`${checksum}  ${artifactName}`));
  assert.equal(metadata["sdk-version"], 2);
  assert.equal(metadata["supports-worker-mode"], true);
  assert.match(sources["addon/c3runtime/main.js"], /haptics-core\.js/);
  for (const file of ["instance", "actions", "conditions", "expressions", "domSide"]) {
    const original = fs.readFileSync(path.join(root, `addon/c3runtime/${file}.js`), "utf8");
    assert.ok(sources[`addon/c3runtime/${file}.js`].length < original.length, `${file} is packaged as minified JavaScript`);
  }
});

for (const worker of [false, true]) test(`minified addon preserves runtime/DOM contracts in ${worker ? "worker" : "main thread"} messaging`, async t => {
  const f = await createConstructFixture({ worker, sources, properties: [true, 0.5, false, true, 0, 0, 250] });
  t.after(() => f.release());
  assert.equal(f.condition("IsReady"), true);
  assert.equal(f.condition("IsPreviewSimulation"), true);
  for (let index = 0; index < 9; index++) {
    await f.action("PlayFeedback", index);
    const result = JSON.parse(f.expression("LastResultJSON"));
    assert.equal(result.accepted, true);
    assert.equal(result.simulated, true);
    assert.equal(result.backend, "preview-simulation");
    assert.equal(result.completion, "not-observable");
  }
  const pattern = { version: 1, events: [{ type: "continuous", timeMs: 0, durationMs: 400, intensity: 0.8, sharpness: 0.4, curves: { intensity: [{ timeMs: 0, value: 0 }, { timeMs: 400, value: 1 }] } }] };
  await f.action("RegisterPattern", "compiled-pattern", JSON.stringify(pattern));
  await f.action("PlayPattern", "compiled-pattern");
  assert.equal(JSON.parse(f.expression("LastResultJSON")).durationMs, 400);
  assert.equal(f.expression("LastRequestId"), "supereo-10");
  assert.equal(f.expression("LastFeedback"), "compiled-pattern");
  assert.equal(f.triggers.filter(condition => condition === f.plugin.Cnds.OnAccepted).length, 10);
  await f.action("SetEnabled", 0);
  await f.action("PlayFeedback", 0);
  assert.equal(JSON.parse(f.expression("LastResultJSON")).reason, "disabled-or-zero-strength");
  assert.equal(f.vibrationCalls.length, 0);
  await f.release();
  assert.equal(f.document.body.children.length, 0);
});

for (const worker of [false, true]) test(`minified addon preserves native calls and structured errors in ${worker ? "worker" : "main thread"} messaging`, async t => {
  const calls = [];
  const native = {
    async getCapabilities() { return { backend: "ios-core-haptics", bridgeAvailable: true, hardwareAvailable: true, intensityControl: true, advancedPatterns: true }; },
    async setState(state) { calls.push({ action: "setState", state: structuredClone(state) }); return state; },
    async stop() { calls.push({ action: "stop" }); return { stopped: true }; },
    async play(request) {
      calls.push({ action: "play", request: structuredClone(request) });
      if (request.notification === "error") throw Object.assign(new Error("Native test error"), { code: "NATIVE_TEST_ERROR" });
      return { accepted: true, requestId: request.requestId, backend: "ios-core-haptics", durationMs: 100, completion: "not-observable", approximated: false };
    }
  };
  const f = await createConstructFixture({ worker, sources, native, properties: [true, 0.7, true, true, 0, 0, 250] });
  t.after(() => f.release());
  assert.equal(f.condition("NativeBridgeAvailable"), true);
  assert.equal(f.expression("Backend"), "ios-core-haptics");
  assert.deepEqual(calls[0], { action: "setState", state: { enabled: true, strength: 0.7 } });
  await f.action("PlayFeedback", 5);
  assert.deepEqual(calls.at(-1).request, { kind: "impact", requestId: "supereo-1", strength: 1, overlap: "replace", style: "rigid" });
  assert.equal(JSON.parse(f.expression("LastResultJSON")).accepted, true);
  await f.action("PlayFeedback", 8);
  assert.equal(JSON.parse(f.expression("LastResultJSON")).code, "NATIVE_TEST_ERROR");
  assert.equal(f.expression("LastError"), "Native test error");
  assert.equal(f.triggers.at(-1), f.plugin.Cnds.OnRejected);
  let resolveState;
  native.setState = state => {
    calls.push({ action: "setState", state: structuredClone(state) });
    return new Promise(resolve => { resolveState = resolve; });
  };
  await f.action("SetStrength", 0.2);
  const playCount = calls.filter(call => call.action === "play").length;
  await f.action("PlayFeedback", 0);
  assert.equal(calls.filter(call => call.action === "play").length, playCount, "the minified addon also waits for asynchronous native settings");
  resolveState({ enabled: true, strength: 0.2 });
  await f.flush();
  assert.equal(calls.filter(call => call.action === "play").length, playCount + 1);
  assert.equal(f.vibrationCalls.length, 0);
});

for (const worker of [false, true]) test(`minified addon drops stale queued cues before native dispatch in ${worker ? "worker" : "main thread"} messaging`, async t => {
  let now = 0;
  let resolvePlay;
  const plays = [];
  const native = {
    async getCapabilities() { return { backend: "native-test-transport", bridgeAvailable: true, hardwareAvailable: true }; },
    async setState(state) { return state; },
    async stop() { return { stopped: true }; },
    play(value) {
      plays.push(value);
      if (value.requestId === "blocking") return new Promise(resolve => { resolvePlay = resolve; });
      return Promise.resolve({ accepted: true, durationMs: 35 });
    }
  };
  const f = await createConstructFixture({ worker, sources, native, properties: [true, 1, true, true, 0, 0, 250], performance: { now: () => now } });
  t.after(() => f.release());
  const request = requestId => ({ kind: "selection", requestId, overlap: "replace" });
  const blocking = f.message("haptics-play", request("blocking"));
  await f.flush();
  const queued = f.message("haptics-play", request("queued"));
  now = 1001;
  resolvePlay({ accepted: true, durationMs: 35 });
  const [, queuedReply] = await Promise.all([blocking, queued]);
  assert.equal(queuedReply.result.accepted, false);
  assert.equal(queuedReply.result.reason, "stale-request-dropped");
  assert.equal(plays.length, 1, "queue recovery must not dispatch an old cue");

  let resolveStop;
  let stopBlocked = false;
  native.stop = () => {
    if (!stopBlocked) { stopBlocked = true; return new Promise(resolve => { resolveStop = resolve; }); }
    return Promise.resolve({ stopped: true });
  };
  const replacement = f.message("haptics-play", request("slow-replacement"));
  await f.flush();
  now = 2002;
  resolveStop({ stopped: true });
  const replacementReply = await replacement;
  assert.equal(replacementReply.result.accepted, false);
  assert.equal(replacementReply.result.reason, "stale-request-dropped");
  assert.equal(plays.length, 1, "a cue must remain fresh after replacement Stop");

  let resolveState;
  native.setState = () => new Promise(resolve => { resolveState = resolve; });
  await f.action("SetStrength", 0.5);
  const stateWait = f.message("haptics-play", request("slow-state"));
  await f.flush();
  now = 3003;
  resolveState({ enabled: true, strength: 0.5 });
  const stateReply = await stateWait;
  assert.equal(stateReply.result.accepted, false);
  assert.equal(stateReply.result.reason, "stale-request-dropped");
  assert.equal(plays.length, 1, "a cue must remain fresh after pending settings");
  assert.equal(f.vibrationCalls.length, 0);
});
