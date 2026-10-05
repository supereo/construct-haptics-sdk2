"use strict";
{
    const DOM_COMPONENT_ID = "Supereo_Haptics";
    const MAX_REQUEST_AGE_MS = 1000;
    const emptyCapabilities = (backend, info) => ({
        backend, bridgeAvailable: false, hardwareAvailable: false, intensityControl: false,
        advancedPatterns: false, amplitudeControl: false, sharpnessControl: false,
        intensityCurves: false, sharpnessCurves: false, primitives: false, envelopes: false,
        fallbackInfo: info
    });
    const HANDLER_CLASS = class SupereoHapticsDOMHandler extends globalThis.DOMHandler
    {
        constructor(iRuntime)
        {
            super(iRuntime, DOM_COMPONENT_ID);
            this._bridge = null;
            this._bridgeReady = false;
            this._stateError = null;
            this._caps = emptyCapabilities("initializing", "Waiting for capabilities.");
            this._enabled = true;
            this._strength = 1;
            this._ready = false;
            this._released = false;
            this._suspended = false;
            this._epoch = 0;
            this._busyUntil = 0;
            this._duplicateWindowMs = 40;
            this._lastFingerprint = "";
            this._lastAcceptedAt = -Infinity;
            this._queue = Promise.resolve();
            this._stateBarrier = Promise.resolve();
            this._queuedCount = 0;
            this._initialization = null;
            this._panel = null;
            this._listeners = [];
            this.AddRuntimeMessageHandlers([
                ["haptics-init", e => this._onInit(e)],
                ["haptics-play", e => this._onPlay(e)],
                ["haptics-stop", () => this._onStop()],
                ["haptics-state", e => this._onState(e)],
                ["haptics-capabilities", () => this._onCapabilities()],
                ["haptics-release", () => this._onRelease()]
            ]);
        }

        _reply(result)
        {
            const reply = { capabilities: this._caps, enabled: this._enabled, strength: this._strength, ready: this._ready };
            if (result) reply.result = result;
            return reply;
        }

        _result(request, fields)
        {
            return Object.assign({
                operation: "play", accepted: false, requestId: request && request.requestId || "",
                backend: this._caps.backend, approximated: false, fallback: "", durationMs: 0,
                completion: "not-observable"
            }, fields);
        }

        _error(error, request, operation = "play")
        {
            return this._reply(this._result(request, {
                operation, code: error && error.code || "native-error",
                reason: error && (error.message || error.reason) || String(error)
            }));
        }

        async _bounded(promise, ms)
        {
            let timer;
            try
            {
                return await Promise.race([
                    promise,
                    new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("The native bridge did not respond within " + ms + " ms."), { code: "native-timeout" })), ms); })
                ]);
            }
            finally { clearTimeout(timer); }
        }

        _findBridge()
        {
            const cordova = globalThis["cordova"];
            return cordova && cordova["plugins"] && cordova["plugins"]["SupereoHaptics"] || null;
        }

        _waitForBridge(ms)
        {
            const bridge = this._findBridge();
            if (bridge) return Promise.resolve(bridge);
            if (!globalThis["cordova"]) return Promise.resolve(null);
            return new Promise(resolve => {
                let timer;
                const done = () => {
                    clearTimeout(timer);
                    document.removeEventListener("deviceready", done);
                    this._cancelBridgeWait = null;
                    resolve(this._findBridge());
                };
                this._cancelBridgeWait = done;
                document.addEventListener("deviceready", done);
                timer = setTimeout(done, ms);
            });
        }

        _listen(target, event, fn)
        {
            target.addEventListener(event, fn);
            this._listeners.push(() => target.removeEventListener(event, fn));
        }

        _installLifecycle()
        {
            this._listen(document, "visibilitychange", () => this._setSuspended(document.visibilityState === "hidden"));
            this._listen(document, "pause", () => this._setSuspended(true));
            this._listen(document, "resume", () => this._setSuspended(false));
            if (typeof globalThis.addEventListener === "function") this._listen(globalThis, "pagehide", () => this._setSuspended(true));
            this._suspended = document.visibilityState === "hidden";
        }

        _setSuspended(suspended)
        {
            this._suspended = suspended;
            // Both transitions invalidate work: an old callback must never replay on resume.
            this._epoch++;
            this._busyUntil = 0;
            this._lastFingerprint = "";
            if (this._bridge) this._bounded(Promise.resolve().then(() => this._bridge["stop"]()), 1500).catch(() => {});
            if (this._panel) this._panel.textContent = "Supereo Haptics preview simulation — " + (suspended ? "paused; pending feedback dropped" : "resumed; no feedback replayed");
        }

        _onInit(e)
        {
            if (this._initialization) return this._initialization;
            this._enabled = e.enabled !== false;
            this._strength = Math.max(0, Math.min(1, Number.isFinite(e.strength) ? e.strength : 1));
            this._nativeRequired = e.nativeRequired !== false;
            // Explicit opt-in: no undocumented preview flag is guessed. Native required always wins.
            this._previewAllowed = !this._nativeRequired && e.previewSimulation !== false;
            this._overlap = e.overlap === "ignore" ? "ignore" : "replace";
            this._duplicateWindowMs = Math.max(0, Math.min(1000, Number.isFinite(e.duplicateWindowMs) ? e.duplicateWindowMs : 40));
            this._bridgeWaitMs = Math.max(250, Math.min(10000, Number.isFinite(e.bridgeWaitMs) ? e.bridgeWaitMs : 2500));
            this._installLifecycle();
            this._initialization = this._initializeBridge();
            return this._initialization;
        }

        async _initializeBridge()
        {
            try
            {
                this._bridge = await this._waitForBridge(this._bridgeWaitMs);
                if (this._released) return this._reply();
                if (this._bridge)
                {
                    const capabilities = await this._bounded(this._bridge["getCapabilities"](), this._bridgeWaitMs);
                    if (this._released) return this._reply();
                    if (this._suspended) throw Object.assign(new Error("Initialization was backgrounded. Refresh capabilities after resuming."), { code: "backgrounded-during-initialization" });
                    await this._bounded(this._bridge["setState"]({ enabled: this._enabled, strength: this._strength }), this._bridgeWaitMs);
                    if (this._released) return this._reply();
                    if (this._suspended) throw Object.assign(new Error("Initialization was backgrounded. Refresh capabilities after resuming."), { code: "backgrounded-during-initialization" });
                    this._caps = capabilities;
                    this._bridgeReady = true;
                    this._ready = true;
                    return this._reply();
                }
                if (this._previewAllowed)
                {
                    this._caps = emptyCapabilities("preview-simulation", "Visual preview only. No native haptic hardware has been exercised.");
                    this._ready = true;
                    return this._reply();
                }
                this._caps = emptyCapabilities("unavailable", "The native Cordova bridge is missing. Install cordova-plugin-supereo-haptics in the mobile export.");
                this._ready = true;
                return this._nativeRequired ? this._error(Object.assign(new Error(this._caps.fallbackInfo), { code: "native-bridge-missing" }), null, "initialize") : this._reply();
            }
            catch (error)
            {
                if (this._released) return this._reply();
                this._caps = emptyCapabilities("unavailable", "Native bridge initialization failed: " + (error.message || error));
                this._caps.bridgeAvailable = !!this._bridge;
                this._ready = true;
                return this._error(error, null, "initialize");
            }
        }

        _onPlay(request)
        {
            const epoch = this._epoch;
            const queuedAt = performance.now();
            if (this._queuedCount >= 32) return Promise.resolve(this._error(Object.assign(new Error("Too many feedback requests are waiting for the native bridge."), { code: "request-queue-full" }), request));
            this._queuedCount++;
            const task = this._queue.then(() => this._playNow(request, epoch, queuedAt));
            this._queue = task.catch(() => {}).finally(() => { this._queuedCount--; });
            return task;
        }

        async _playNow(request, epoch, queuedAt)
        {
            try
            {
                if (this._initialization) await this._initialization;
                await this._stateBarrier;
                if (this._released || this._suspended || epoch !== this._epoch) return this._reply(this._result(request, { reason: "cancelled-or-backgrounded" }));
                if (performance.now() - queuedAt > MAX_REQUEST_AGE_MS) return this._reply(this._result(request, { reason: "stale-request-dropped" }));
                if (!this._enabled || this._strength === 0) return this._reply(this._result(request, { reason: "disabled-or-zero-strength" }));
                const kinds = ["selection", "impact", "notification", "pattern"];
                if (!kinds.includes(request.kind)) throw Object.assign(new Error("Unknown feedback kind."), { code: "invalid-feedback" });
                if (request.kind === "impact" && !["light", "medium", "heavy", "soft", "rigid"].includes(request.style)) throw Object.assign(new Error("Unknown impact style."), { code: "invalid-feedback" });
                if (request.kind === "notification" && !["success", "warning", "error"].includes(request.notification)) throw Object.assign(new Error("Unknown notification type."), { code: "invalid-feedback" });
                const nativeRequest = { kind: request.kind, requestId: request.requestId, strength: 1, overlap: request.overlap === "ignore" ? "ignore" : "replace" };
                if (request.style) nativeRequest.style = request.style;
                if (request.notification) nativeRequest.notification = request.notification;
                if (request.kind === "pattern") nativeRequest.pattern = globalThis.SupereoHapticsCore.validatePattern(request.pattern);
                const fingerprint = JSON.stringify({ kind: nativeRequest.kind, style: nativeRequest.style, notification: nativeRequest.notification, pattern: nativeRequest.pattern });
                const now = Date.now();
                if (fingerprint === this._lastFingerprint && now - this._lastAcceptedAt < this._duplicateWindowMs) return this._reply(this._result(request, { reason: "rapid-duplicate-suppressed" }));
                if (nativeRequest.overlap === "ignore" && now < this._busyUntil) return this._reply(this._result(request, { reason: "busy-ignore-policy" }));
                let result;
                if (this._caps.backend === "preview-simulation")
                {
                    const duration = nativeRequest.pattern ? globalThis.SupereoHapticsCore.durationMs(nativeRequest.pattern) : nativeRequest.kind === "notification" ? 250 : 35;
                    result = this._result(request, { accepted: true, reason: "preview-simulation-only", durationMs: duration, simulated: true, fallback: "visual-preview-only" });
                    this._showPreview(request, nativeRequest);
                }
                else if (!this._bridge)
                {
                    return this._error(Object.assign(new Error(this._caps.fallbackInfo), { code: "native-bridge-missing" }), request);
                }
                else
                {
                    if (!this._bridgeReady) throw Object.assign(new Error("The native bridge did not initialize successfully. Refresh capabilities to retry."), { code: "native-bridge-not-ready" });
                    if (this._stateError) throw this._stateError;
                    if (nativeRequest.overlap === "replace") await this._bounded(this._bridge["stop"](), 1500);
                    if (this._released || this._suspended || epoch !== this._epoch) return this._reply(this._result(request, { reason: "cancelled-or-backgrounded" }));
                    if (performance.now() - queuedAt > MAX_REQUEST_AGE_MS) return this._reply(this._result(request, { reason: "stale-request-dropped" }));
                    const nativeResult = await this._bounded(this._bridge["play"](nativeRequest), 4000);
                    result = this._result(request, nativeResult);
                    if (this._released || this._suspended || epoch !== this._epoch)
                    {
                        await this._bounded(this._bridge["stop"](), 1500);
                        return this._reply(this._result(request, { reason: "cancelled-or-backgrounded" }));
                    }
                }
                if (result.accepted)
                {
                    this._lastFingerprint = fingerprint;
                    this._lastAcceptedAt = Date.now();
                    // A scheduling window implements overlap policy. It is not a physical completion signal.
                    this._busyUntil = this._lastAcceptedAt + Math.max(1, Number.isFinite(result.durationMs) ? result.durationMs : 35);
                }
                return this._reply(result);
            }
            catch (error)
            {
                if (error.code === "native-timeout" && this._bridge) this._bounded(this._bridge["stop"](), 1500).catch(() => {});
                return this._error(error, request);
            }
        }

        async _onStop()
        {
            this._epoch++;
            this._busyUntil = 0;
            this._lastFingerprint = "";
            try
            {
                if (this._bridge) await this._bounded(this._bridge["stop"](), 1500);
                if (this._panel) this._panel.textContent = "Supereo Haptics preview simulation — stopped; no hardware exercised";
                return this._reply(this._result(null, { operation: "stop", accepted: true, reason: "addon-work-cancelled" }));
            }
            catch (error) { return this._error(error, null, "stop"); }
        }

        _onState(e)
        {
            if (typeof e.enabled === "boolean") this._enabled = e.enabled;
            if (Number.isFinite(e.strength) && e.strength >= 0 && e.strength <= 1) this._strength = e.strength;
            this._epoch++;
            this._busyUntil = 0;
            this._lastFingerprint = "";
            const state = { enabled: this._enabled, strength: this._strength };
            this._stateBarrier = this._stateBarrier.then(async () => {
                try
                {
                    if (this._initialization) await this._initialization;
                    if (this._released) return this._reply();
                    if (this._bridge)
                    {
                        await this._bounded(this._bridge["stop"](), 1500);
                        if (this._released) return this._reply();
                        await this._bounded(this._bridge["setState"](state), 2500);
                        if (this._released) return this._reply();
                    }
                    this._stateError = null;
                    return this._reply(this._result(null, { operation: "state", accepted: true, reason: "settings-updated-active-work-dropped" }));
                }
                catch (error) { this._stateError = error; return this._error(error, null, "state"); }
            });
            return this._stateBarrier;
        }

        async _onCapabilities()
        {
            try
            {
                if (this._initialization) await this._initialization;
                if (this._released) return this._reply();
                if (!this._bridge) this._bridge = this._findBridge();
                if (this._bridge)
                {
                    const capabilities = await this._bounded(this._bridge["getCapabilities"](), 2500);
                    if (this._released) return this._reply();
                    if (this._suspended) throw Object.assign(new Error("Capability refresh was backgrounded. Refresh again after resuming."), { code: "backgrounded-during-capability-refresh" });
                    if (!this._bridgeReady || this._stateError)
                    {
                        await this._bounded(this._bridge["setState"]({ enabled: this._enabled, strength: this._strength }), 2500);
                        if (this._released) return this._reply();
                        if (this._suspended) throw Object.assign(new Error("Capability refresh was backgrounded. Refresh again after resuming."), { code: "backgrounded-during-capability-refresh" });
                        this._bridgeReady = true;
                        this._stateError = null;
                    }
                    this._caps = capabilities;
                }
                return this._reply(this._result(null, { operation: "capabilities", accepted: !!this._bridge || this._caps.backend === "preview-simulation", reason: "capabilities-refreshed" }));
            }
            catch (error) { return this._error(error, null, "capabilities"); }
        }

        _showPreview(request, nativeRequest)
        {
            if (!document.body || typeof document.createElement !== "function") return;
            if (!this._panel)
            {
                this._panel = document.createElement("aside");
                this._panel.setAttribute("aria-live", "polite");
                this._panel.style.cssText = "position:fixed;right:12px;bottom:12px;max-width:360px;z-index:2147483646;padding:12px 16px;border:1px solid #5eead4;border-radius:12px;background:#111827;color:#e5e7eb;font:13px/1.5 system-ui;pointer-events:none;box-shadow:0 6px 24px #0006";
                document.body.appendChild(this._panel);
            }
            this._panel.textContent = "Supereo Haptics preview simulation · no hardware exercised\n" + (request.label || request.kind) + " · strength " + Math.round(this._strength * 100) + "%";
            if (!nativeRequest.pattern) return;
            const timeline = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            timeline.setAttribute("viewBox", "0 0 300 48");
            timeline.setAttribute("width", "300");
            timeline.setAttribute("height", "48");
            const duration = Math.max(1, globalThis.SupereoHapticsCore.durationMs(nativeRequest.pattern));
            for (const event of nativeRequest.pattern.events)
            {
                const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                bar.setAttribute("x", String(event.timeMs / duration * 292));
                bar.setAttribute("y", String(42 - event.intensity * this._strength * 36));
                bar.setAttribute("width", String(Math.max(4, (event.durationMs || 10) / duration * 292)));
                bar.setAttribute("height", String(Math.max(1, event.intensity * this._strength * 36)));
                bar.setAttribute("fill", "#5eead4");
                timeline.appendChild(bar);
            }
            this._panel.appendChild(timeline);
        }

        _onRelease()
        {
            this._released = true;
            this._epoch++;
            this._busyUntil = 0;
            if (this._cancelBridgeWait) this._cancelBridgeWait();
            for (const remove of this._listeners.splice(0)) remove();
            if (this._panel) { this._panel.remove(); this._panel = null; }
            if (this._bridge) this._bounded(Promise.resolve().then(() => this._bridge["stop"]()), 1500).catch(() => {});
            return this._reply();
        }
    };
    globalThis.RuntimeInterface.AddDOMHandlerClass(HANDLER_CLASS);
}
