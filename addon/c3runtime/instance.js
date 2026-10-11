const C3 = globalThis.C3;
const DOM_COMPONENT_ID = "Supereo_Haptics";

C3.Plugins.Supereo_Haptics.Instance = class SupereoHapticsInstance extends globalThis.ISDKInstanceBase
{
    constructor()
    {
        super({ domComponentId: DOM_COMPONENT_ID });
        this._released = false;
        this._ready = false;
        this._enabled = true;
        this._strength = 1;
        this._overlap = "replace";
        this._patterns = new Map();
        this._requestCounter = 0;
        this._capabilities = { backend: "initializing", bridgeAvailable: false, hardwareAvailable: false, intensityControl: false, advancedPatterns: false, fallbackInfo: "Capabilities have not been checked yet." };
        this._lastResult = {};
        this._lastError = "";
        this._lastFeedback = "";
        this._initializationGeneration = 0;
        this._cancelInitialization = null;
        this._initTransportFailed = false;
        this._initializationPending = false;
        this._configurationVersion = 0;
        this._addDOMMessageHandlers([["haptics-status", reply => {
            if (this._released) return;
            this._applyReply(reply, !this._initializationPending);
        }]]);
        const p = this._getInitProperties() || [true, 1, true, true, 0, 40, 2500];
        this._enabled = p[0] !== false;
        this._strength = Math.min(1, Math.max(0, Number.isFinite(p[1]) ? p[1] : 1));
        this._overlap = p[4] === 1 || p[4] === "ignore" ? "ignore" : "replace";
        this._initialConfiguration = {
            enabled: this._enabled,
            strength: this._strength,
            nativeRequired: p[2] !== false,
            previewSimulation: p[3] !== false,
            overlap: this._overlap,
            duplicateWindowMs: p[5],
            bridgeWaitMs: p[6]
        };
        this._initialization = this._initializeDOM();
        this.runtime.sdk.addLoadPromise(this._initialization);
    }

    _initializeDOM()
    {
        if (this._cancelInitialization) this._cancelInitialization();
        const generation = ++this._initializationGeneration;
        this._initializationPending = true;
        const waitMs = Math.max(250, Math.min(10000, Number.isFinite(this._initialConfiguration.bridgeWaitMs) ? this._initialConfiguration.bridgeWaitMs : 2500));
        // DOM initialization can wait for namespace, capabilities, and state in
        // sequence. Bound the complete SDK message as well as those native calls.
        const timeoutMs = waitMs * 3 + 250;
        return new Promise(resolve => {
            let settled = false;
            let timer;
            const finish = (reply, error) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                if (generation === this._initializationGeneration) this._cancelInitialization = null;
                if (!this._released && generation === this._initializationGeneration)
                {
                    this._initTransportFailed = !!error;
                    this._initializationPending = false;
                    if (error)
                    {
                        this._applyReply({
                            ready: true,
                            capabilities: { backend: "unavailable", bridgeAvailable: false, hardwareAvailable: false, intensityControl: false, advancedPatterns: false, fallbackInfo: "Haptics initialization messaging failed: " + (error.message || error) },
                            result: { accepted: false, operation: "initialize", code: error.code || "runtime-message-error", reason: error.message || String(error), backend: "unavailable", completion: "not-observable" }
                        }, false);
                    }
                    else this._applyReply(reply, false);
                }
                resolve();
            };
            this._cancelInitialization = () => finish();
            timer = setTimeout(() => finish(null, Object.assign(new Error("Haptics initialization did not answer within " + timeoutMs + " ms."), { code: "runtime-initialization-timeout" })), timeoutMs);
            const configuration = Object.assign({}, this._initialConfiguration, { enabled: this._enabled, strength: this._strength, overlap: this._overlap, configurationVersion: this._configurationVersion, initializationGeneration: generation });
            Promise.resolve().then(() => {
                if (this._released || generation !== this._initializationGeneration) return null;
                return this._postToDOMAsync("haptics-init", configuration);
            }).then(reply => {
                if (this._released || generation !== this._initializationGeneration) return finish();
                if (!reply || typeof reply !== "object") throw Object.assign(new Error("Haptics initialization returned no status."), { code: "invalid-initialization-reply" });
                finish(reply);
            }).catch(error => finish(null, error));
        });
    }

    _applyReply(reply, notify = true)
    {
        if (this._released || !reply) return;
        if (reply.capabilities) this._capabilities = reply.capabilities;
        if (typeof reply.enabled === "boolean") this._enabled = reply.enabled;
        if (typeof reply.strength === "number") this._strength = reply.strength;
        if (typeof reply.ready === "boolean") this._ready = reply.ready;
        if (!reply.result) return;
        this._lastResult = reply.result;
        this._lastError = reply.result.code ? String(reply.result.reason || reply.result.code) : "";
        if (!notify) return;
        if (reply.result.code) this._trigger(C3.Plugins.Supereo_Haptics.Cnds.OnError);
        if (reply.result.operation === "play")
        {
            this._trigger(reply.result.accepted ? C3.Plugins.Supereo_Haptics.Cnds.OnAccepted : C3.Plugins.Supereo_Haptics.Cnds.OnRejected);
            if (reply.result.simulated) this._trigger(C3.Plugins.Supereo_Haptics.Cnds.OnPreview);
        }
    }

    _runtimeError(error, notify = true)
    {
        this._applyReply({ result: { accepted: false, operation: "play", code: error && error.code || "runtime-message-error", reason: error && error.message || String(error), backend: this._capabilities.backend, completion: "not-observable" } }, notify);
    }

    _send(message, data, after)
    {
        if (this._released) return;
        if (message === "haptics-state") data = Object.assign({}, data, { configurationVersion: ++this._configurationVersion });
        const send = async () => {
            if (this._released) return null;
            if (message === "haptics-capabilities")
            {
                if (this._initializationPending) await this._initialization;
                if (this._initTransportFailed)
                {
                    if (!this._initializationPending) this._initialization = this._initializeDOM();
                    await this._initialization;
                    if (this._released) return null;
                    if (this._initTransportFailed) return { ready: true, capabilities: this._capabilities, result: Object.assign({}, this._lastResult, { operation: "capabilities" }) };
                }
            }
            if (this._released) return null;
            return this._postToDOMAsync(message, data);
        };
        Promise.resolve().then(send).then(reply => {
            if (!reply) return;
            if (this._initTransportFailed && message !== "haptics-capabilities") reply = Object.assign({}, reply, { ready: this._ready, capabilities: this._capabilities });
            this._applyReply(reply);
            if (!this._released && after) after();
        }).catch(error => this._runtimeError(error));
    }

    _play(request, label)
    {
        this._lastFeedback = label;
        this._send("haptics-play", Object.assign({}, request, {
            requestId: "supereo-" + (++this._requestCounter),
            label,
            overlap: this._overlap
        }));
    }

    _registerPattern(name, json)
    {
        try
        {
            if (typeof name !== "string" || !name.trim() || name.length > 80) throw Object.assign(new Error("Use a pattern name with 1 to 80 characters."), { code: "invalid-pattern-name" });
            const pattern = globalThis.SupereoHapticsCore.validatePattern(json);
            if (!this._patterns.has(name) && this._patterns.size >= 64) throw Object.assign(new Error("At most 64 named custom patterns can be registered."), { code: "pattern-registry-full" });
            this._patterns.set(name, pattern);
        }
        catch (error) { this._runtimeError(error); }
    }

    _release()
    {
        this._released = true;
        this._initializationGeneration++;
        this._initializationPending = false;
        if (this._cancelInitialization) { this._cancelInitialization(); this._cancelInitialization = null; }
        this._patterns.clear();
        this._postToDOM("haptics-release", {});
        super._release();
    }

    // Pending feedback and player settings deliberately do not belong to gameplay save state.
    _saveToJson() { return {}; }
    _loadFromJson() { this._send("haptics-stop", {}); }
};
