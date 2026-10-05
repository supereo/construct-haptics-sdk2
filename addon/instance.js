
const SDK = globalThis.SDK;

const PLUGIN_CLASS = SDK.Plugins.Supereo_Haptics;

PLUGIN_CLASS.Instance = class SupereoHapticsInstance extends SDK.IInstanceBase
{
	constructor(sdkType, inst)
	{
		super(sdkType, inst);
	}
	
	Release()
	{
	}
	
	OnCreate()
	{
	}
	
	OnPropertyChanged(id, value)
	{
	}
};
