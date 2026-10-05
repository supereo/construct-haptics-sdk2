
const SDK = globalThis.SDK;

const PLUGIN_CLASS = SDK.Plugins.Supereo_Haptics;

PLUGIN_CLASS.Type = class SupereoHapticsType extends SDK.ITypeBase
{
	constructor(sdkPlugin, iObjectType)
	{
		super(sdkPlugin, iObjectType);
	}
};
