const SDK = globalThis.SDK;
const PLUGIN_ID = "Supereo_Haptics";
const PLUGIN_CLASS = SDK.Plugins.Supereo_Haptics = class SupereoHapticsPlugin extends SDK.IPluginBase
{
    constructor()
    {
        super(PLUGIN_ID);
        SDK.Lang.PushContext("plugins." + PLUGIN_ID.toLowerCase());
        this._info.SetName(globalThis.lang(".name"));
        this._info.SetDescription(globalThis.lang(".description"));
        this._info.SetCategory("platform-specific");
        this._info.SetAuthor("Supereo");
        this._info.SetHelpUrl(globalThis.lang(".help-url"));
        this._info.SetIsSingleGlobal(true);
        this._info.SetRuntimeModuleMainScript("c3runtime/main.js");
        this._info.AddC3RuntimeScript("c3runtime/haptics-core.js");
        this._info.SetDOMSideScripts(["c3runtime/domSide.js"]);
        // Immutable native package restored automatically by external Cordova builds.
        // Construct Build Service must approve this dependency before it can build it.
        this._info.AddCordovaPluginReference({
            id: "cordova-plugin-supereo-haptics",
            version: "https://raw.githubusercontent.com/supereo/construct-haptics-sdk2/d15c7d1b0ec1300b85a7970fa23a773ed7e1f1fd/dist/cordova-plugin-supereo-haptics-1.0.0.tgz",
            platform: "all"
        });
        SDK.Lang.PushContext(".properties");
        this._info.SetProperties([
            new SDK.PluginProperty("check", "enabled", true),
            new SDK.PluginProperty("float", "strength", 1),
            new SDK.PluginProperty("check", "native-required", true),
            new SDK.PluginProperty("check", "preview-simulation", true),
            new SDK.PluginProperty("combo", "overlap", { initialValue: "replace", items: ["replace", "ignore"] }),
            new SDK.PluginProperty("integer", "duplicate-window-ms", 40),
            new SDK.PluginProperty("integer", "bridge-wait-ms", 2500)
        ]);
        SDK.Lang.PopContext();
        SDK.Lang.PopContext();
    }
};
PLUGIN_CLASS.Register(PLUGIN_ID, PLUGIN_CLASS);
