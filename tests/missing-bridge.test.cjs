"use strict";

const test = require("node:test");
const { assertMissingSupereoBridge } = require("./helpers/missing-bridge-check.cjs");

for (const worker of [false, true]) for (const readySignal of ["timeout", "deviceready"])
  test(`Cordova with only TapticEngine completes missing-Supereo startup on ${readySignal} in ${worker ? "worker" : "main thread"} mode and keeps ACEs usable`, () => assertMissingSupereoBridge({ worker, readySignal, emptyPluginsNamespace: readySignal === "deviceready" }));
