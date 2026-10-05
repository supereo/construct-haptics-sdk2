# Supereo Haptics native bridge 1.0.0

Install this local Cordova package in a generated Cordova project:

```sh
cordova plugin add /absolute/path/to/cordova-plugin-supereo-haptics
cordova prepare
```

Requires cordova-android 15+ (SDK 36, Android 7/API 24+) or cordova-ios 8+
(deployment target iOS 13+). Android requests the normal `VIBRATE` permission;
there is no runtime permission dialog. iOS uses UIKit/Core Haptics and requests
no haptics permission. No data is collected or transmitted and no audio is
synthesized. Platforms and hardware can decline feedback.

The namespace is `cordova.plugins.SupereoHaptics`; all methods return Promises.
`getCapabilities()`, `play(request)`, `stop()`, `setState({enabled,strength})`.
Requests are bounded and validated twice. Native acceptance is not physical
completion. See the full source package's docs/INSTALLATION.md, docs/PATTERNS.md
and docs/CAPABILITIES.md for installation, schema and limitations.

This package is not published to npm and has not been approved for Construct's
Build Service. Install locally for external builds. See docs/TEST-REPORT.md for
actual verification, including unavailable Xcode/device/editor checks.
