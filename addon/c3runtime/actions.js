const C3 = globalThis.C3;
const FEEDBACK_NAMES = ["selection-tick", "light-impact", "medium-impact", "strong-impact", "soft-impact", "crisp-impact", "success", "warning", "error"];
C3.Plugins.Supereo_Haptics.Acts = {
    PlayFeedback(index)
    {
        try
        {
            const name = FEEDBACK_NAMES[index];
            this._play(globalThis.SupereoHapticsCore.getPreset(name), name);
        }
        catch (error) { this._runtimeError(error); }
    },
    RegisterPattern(name, json) { this._registerPattern(name, json); },
    PlayPattern(name)
    {
        const pattern = this._patterns.get(name);
        if (!pattern) { this._runtimeError(Object.assign(new Error("Register the named custom pattern before playing it: " + name), { code: "pattern-not-registered" })); return; }
        this._play({ kind: "pattern", pattern }, name);
    },
    Stop() { this._send("haptics-stop", {}); },
    SetEnabled(index)
    {
        this._enabled = index === 1;
        this._send("haptics-state", { enabled: this._enabled, strength: this._strength });
    },
    SetStrength(strength)
    {
        if (!Number.isFinite(strength) || strength < 0 || strength > 1) { this._runtimeError(Object.assign(new Error("Overall strength must be a number from 0 to 1."), { code: "invalid-strength" })); return; }
        this._strength = strength;
        this._send("haptics-state", { enabled: this._enabled, strength: this._strength });
    },
    SetOverlapPolicy(index) { this._overlap = index === 1 ? "ignore" : "replace"; },
    RefreshCapabilities()
    {
        this._send("haptics-capabilities", {}, () => this._trigger(C3.Plugins.Supereo_Haptics.Cnds.OnCapabilitiesRefreshed));
    }
};
