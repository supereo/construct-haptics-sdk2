cordova.define('cordova/plugin_list', function(require, exports, module) {
  module.exports = [
    {
      "id": "cordova-plugin-supereo-haptics.core",
      "file": "plugins/cordova-plugin-supereo-haptics/www/core.js",
      "pluginId": "cordova-plugin-supereo-haptics"
    },
    {
      "id": "cordova-plugin-supereo-haptics.SupereoHaptics",
      "file": "plugins/cordova-plugin-supereo-haptics/www/SupereoHaptics.js",
      "pluginId": "cordova-plugin-supereo-haptics",
      "clobbers": [
        "cordova.plugins.SupereoHaptics"
      ]
    }
  ];
  module.exports.metadata = {
    "cordova-plugin-supereo-haptics": "1.0.0"
  };
});