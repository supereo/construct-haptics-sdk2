const C3 = globalThis.C3;
C3.Plugins.Supereo_Haptics.Exps = {
    Backend() { return this._capabilities.backend || "unavailable"; },
    FallbackInfo() { return this._capabilities.fallbackInfo || ""; },
    CapabilitiesJSON() { return JSON.stringify(this._capabilities); },
    LastResultJSON() { return JSON.stringify(this._lastResult); },
    LastError() { return this._lastError; },
    LastRequestId() { return this._lastResult.requestId || ""; },
    LastFeedback() { return this._lastFeedback; },
    Strength() { return this._strength; },
    LastWasApproximated() { return this._lastResult.approximated ? 1 : 0; }
};
