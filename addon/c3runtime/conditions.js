const C3 = globalThis.C3;
C3.Plugins.Supereo_Haptics.Cnds = {
    IsReady() { return this._ready; },
    IsEnabled() { return this._enabled; },
    NativeBridgeAvailable() { return this._capabilities.bridgeAvailable === true; },
    HapticHardwareAvailable() { return this._capabilities.hardwareAvailable === true; },
    IntensityControlSupported() { return this._capabilities.intensityControl === true; },
    AdvancedPatternsSupported() { return this._capabilities.advancedPatterns === true; },
    SharpnessControlSupported() { return this._capabilities.sharpnessControl === true; },
    PrimitivesSupported() { return this._capabilities.primitives === true; },
    EnvelopesSupported() { return this._capabilities.envelopes === true; },
    IsPreviewSimulation() { return this._capabilities.backend === "preview-simulation"; },
    OnAccepted() { return true; },
    OnRejected() { return true; },
    OnError() { return true; },
    OnPreview() { return true; },
    OnCapabilitiesRefreshed() { return true; }
};
