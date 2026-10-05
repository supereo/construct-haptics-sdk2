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
        const p = this._getInitProperties() || [true, 1, true, true, 0, 40, 2500];
        this._enabled = p[0] !== false;
        this._strength = Math.min(1, Math.max(0, Number.isFinite(p[1]) ? p[1] : 1));
        this._overlap = p[4] === 1 || p[4] === "ignore" ? "ignore" : "replace";
        const initialization = this._postToDOMAsync("haptics-init", {
            enabled: this._enabled,
            strength: this._strength,
            nativeRequired: p[2] !== false,
            previewSimulation: p[3] !== false,
            overlap: this._overlap,
            duplicateWindowMs: p[5],
            bridgeWaitMs: p[6]
        }).then(reply => this._applyReply(reply, false)).catch(error => this._runtimeError(error, false));
        this.runtime.sdk.addLoadPromise(initialization);
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
        this._postToDOMAsync(message, data).then(reply => {
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
        this._patterns.clear();
        this._postToDOM("haptics-release", {});
        super._release();
    }

    // Pending feedback and player settings deliberately do not belong to gameplay save state.
    _saveToJson() { return {}; }
    _loadFromJson() { this._send("haptics-stop", {}); }
};
