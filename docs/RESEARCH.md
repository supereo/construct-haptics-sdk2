# Native route and API research

Initial research date: 5 October 2026, with a same-day follow-up for addon release 1.0.1. The requested target is Construct 3 r495.2, Addon SDK v2, Worker Auto or Off, Simple minification. The original development checks had no Construct editor session or signed mobile export. The user subsequently reported an actual Construct build loader failure with addon 1.0.0; the agent has not retested the corrected addon 1.0.1 in the editor. Source-level compatibility checks are not a substitute for those checks.

## Construct and native dependency inclusion

The official [Scirra Addon SDK repository](https://github.com/Scirra/Construct-Addon-SDK) was read at commit `a34e41a246fdbb03ac719597d528d7a5e5de0b02`. Its README says SDK v1 support was retired in r450 and the SDK now supports v2. Its [DOM messaging sample](https://github.com/Scirra/Construct-Addon-SDK/tree/a34e41a246fdbb03ac719597d528d7a5e5de0b02/plugin-sdk/domMessagingPlugin) supplies the supported architecture used here:

- `SetRuntimeModuleMainScript` loads the runtime module.
- `SetDOMSideScripts` registers scripts that run in the DOM context.
- `ISDKInstanceBase({ domComponentId })` and `_postToDOMAsync` send runtime requests to a DOM handler.
- `DOMHandler.AddRuntimeMessageHandlers` receives those requests, and `RuntimeInterface.AddDOMHandlerClass` registers the handler.

The same route works when the runtime is in a worker and when it runs on the main thread. Cordova access belongs in the DOM handler. The addon does not access `document`, `window`, or Cordova from its runtime module.

The official [Greenworks SDK v2 plugin](https://github.com/Scirra/Construct-Plugin-Greenworks/blob/04f8d7628481fa22b72adb96ea0536a93e15b698/construct-plugin/c3runtime/domSide.js#L16) demonstrates the DOM interface's `GetExportType()`, but its `nwjs` example does not establish a preview flag. This addon therefore uses explicit simulation settings rather than an undocumented preview-detection guess.

A `.c3addon` registers a Construct extension; it does not compile native Java or Swift into a mobile app. The separate Cordova plugin declares its JavaScript namespace, native classes, native sources, frameworks, and Android permission in `plugin.xml`. Installing that package in the exported Cordova project is essential.

### Runtime module registration and the 1.0.1 correction

During the initial 5 October research, direct Construct manual fetches were blocked by the environment's network policy, so official SDK samples were read through Scirra's GitHub repository. During the follow-up, the current official [Runtime scripts guide](https://www.construct.net/en/make-games/manuals/addon-sdk/guide/runtime-scripts#adding-a-module-script) and [IPluginInfo reference](https://www.construct.net/en/make-games/manuals/addon-sdk/reference/iplugininfo) were successfully fetched and read.

The guide explicitly requires an additional imported module to be registered by calling `this._info.AddC3RuntimeScript("c3runtime/mymodule.js")`, added to `addon.json`'s `file-list`, and imported from an existing runtime script. `SetRuntimeModuleMainScript` chooses the module entry; it does not register every arbitrary imported file. The IPluginInfo reference separately documents `AddC3RuntimeScript`, `SetRuntimeModuleMainScript`, and `SetDOMSideScripts`.

Addon 1.0.0 imported a separate `c3runtime/haptics-core.js` file that was packaged but not registered as a runtime script. The user's reported Construct file-map error exposed that gap in the earlier loader fixture. Addon **1.0.1** (Construct metadata **1.0.1.0**) embeds the shared validator in the registered runtime `plugin.js` and DOM `domSide.js` scripts. There is no extra helper module to import or resolve. The build derives both embedded copies from `lib/core.js` and the templates in `addon/source/` before packaging. The native Cordova bridge remains **1.0.0**.

This correction follows the documented loading model. Its package and loader-contract checks do not establish a successful actual Construct editor retest; that check remains **NOT RUN** until recorded separately. The official IPluginInfo reference also identifies the native dependency API as `AddCordovaPluginReference(opts)`; this release does not call it for its unpublished/unapproved native package.

### Build Service findings

The [official Scirra issue #6946](https://github.com/Scirra/Construct-bugs/issues/6946) distinguishes a Cordova project built externally from Android Studio/Debug APK output produced by the Build Service. The developer requested review of a native plugin; Scirra's response was: **“Added `cordova.plugin.yabbiads@1.0.6` to the build server allowlist.”**

More recent official examples show the same process:

- [#9153, July 2026](https://github.com/Scirra/Construct-bugs/issues/9153): exact package versions and public source repositories were supplied; Scirra replied “Added both to the build service.”
- [#9251, August 2026](https://github.com/Scirra/Construct-bugs/issues/9251): an updated package version was requested and added separately.
- [#6347](https://github.com/Scirra/Construct-bugs/issues/6347): Scirra recommends exporting a Cordova project and checking its file structure and `config.xml` externally when diagnosing native integration.

This establishes a package/version review boundary. It does **not** establish approval of `cordova-plugin-supereo-haptics@1.0.0`, a complete current submission checklist, or the Build Service's Android/iOS tool versions. This package has not been published to npm or submitted to Scirra. **Build Service compatibility is UNVERIFIED.** The addon intentionally does not insert an unpublished native dependency into Construct's Build Service configuration.

For a future approval request, prepare a public immutable package version, source and license, both platform declarations, compile/deployment requirements, permission rationale, reproducible builds and test results, and a minimal Construct reproduction. Ask Scirra for its current review requirements before submission. These are practical preparation steps, not a claim that Scirra publishes this exact checklist. Actual approval must name this package/version; a package with a similar name is insufficient.

## Cordova's supported external route

Official [Apache Cordova documentation source](https://github.com/apache/cordova-docs) was read at commit `9c4a8eb284fbc7e8e5e995cc6c6b348965d69375`:

| Official source | Finding used here |
| --- | --- |
| [CLI guide](https://github.com/apache/cordova-docs/blob/9c4a8eb284fbc7e8e5e995cc6c6b348965d69375/www/docs/en/latest/guide/cli/index.md) | Install plugins in the project, check `cordova requirements`, and build the chosen platform. |
| [Platform/plugin versioning](https://github.com/apache/cordova-docs/blob/9c4a8eb284fbc7e8e5e995cc6c6b348965d69375/www/docs/en/latest/platform_plugin_versioning_ref/index.md) | Plugins can be installed from a local directory; publishing to npm is unnecessary for this route. |
| [Plugin specification](https://github.com/apache/cordova-docs/blob/9c4a8eb284fbc7e8e5e995cc6c6b348965d69375/www/docs/en/latest/plugin_ref/spec.md) | `js-module`/`clobbers`, platform `feature` declarations, source files, system frameworks and manifest configuration include the actual bridge. |
| [Android guide](https://github.com/apache/cordova-docs/blob/9c4a8eb284fbc7e8e5e995cc6c6b348965d69375/www/docs/en/latest/guide/platforms/android/index.md) | Cordova Android 15 supports API 24–36, SDK/build tools 36, JDK 17, Gradle 8.14.2; `--packageType=bundle` produces an AAB. |
| [iOS guide](https://github.com/apache/cordova-docs/blob/9c4a8eb284fbc7e8e5e995cc6c6b348965d69375/www/docs/en/latest/guide/platforms/ios/index.md) | Cordova iOS 8 supports iOS 13+, requires macOS/Xcode to compile, and produces `platforms/ios/App.xcworkspace`. Hardware features need a real device. |
| [Cordova events](https://github.com/apache/cordova-docs/blob/9c4a8eb284fbc7e8e5e995cc6c6b348965d69375/www/docs/en/latest/cordova/events/events.md) | Native APIs become available after `deviceready`; `pause`/`resume` report app lifecycle. iOS can defer JavaScript-triggered native calls during pause, so native lifecycle cancellation is also necessary. |

The instructions in [INSTALLATION.md](INSTALLATION.md) use this route. They preserve the Construct Cordova export's startup scripts and wrapper integration. A generic web export copied into a newly invented wrapper would need separate verification.

## Android native APIs

Current official Android framework source and its public API documentation comments were inspected from AOSP's Android 16 release branch:

- [Vibrator.java](https://github.com/aosp-mirror/platform_frameworks_base/blob/android16-release/core/java/android/os/Vibrator.java): hardware/amplitude checks, predefined effect support's YES/NO/UNKNOWN states, primitive support and durations, API 36 envelope support and hardware limits.
- [VibrationEffect.java](https://github.com/aosp-mirror/platform_frameworks_base/blob/android16-release/core/java/android/os/VibrationEffect.java): predefined effects, amplitude waveforms, primitive composition and `BasicEnvelopeBuilder`.
- [HapticFeedbackConstants.java](https://github.com/aosp-mirror/platform_frameworks_base/blob/android16-release/core/java/android/view/HapticFeedbackConstants.java): supported semantic feedback constants and settings-respecting view feedback.
- [Public API surface](https://github.com/aosp-mirror/platform_frameworks_base/blob/android16-release/core/api/current.txt): public signatures and API availability.

Direct documentation references for a device/build follow-up are [haptics overview](https://developer.android.com/develop/ui/views/haptics/haptics-apis), [Vibrator](https://developer.android.com/reference/android/os/Vibrator), and [VibrationEffect](https://developer.android.com/reference/android/os/VibrationEffect). During the initial 5 October research, their website could not be fetched because of the environment's network allowlist; the official framework source above was available. This records the original research limitation, not a current connectivity test.

Runtime guards protect newer calls. Compilation still needs API 36 because the Java source references the public envelope classes. The installed app can run on API 24+, with reduced capabilities. Unsupported primitives are never composed, UNKNOWN predefined effect support is never advertised as confirmed support, and envelopes are selected only after a positive hardware check and limit validation.

## Apple native APIs

The implementation uses public UIKit selection, impact and notification generators, and Core Haptics events/players for custom haptic-only patterns. Official references required for final Apple toolchain/device review are:

- [Core Haptics](https://developer.apple.com/documentation/corehaptics).
- [Checking device support](https://developer.apple.com/documentation/corehaptics/chhapticengine/capabilitiesforhardware()).
- [CHHapticEngine](https://developer.apple.com/documentation/corehaptics/chhapticengine), including stopped/reset handlers and haptic-only operation.
- [CHHapticParameterCurve](https://developer.apple.com/documentation/corehaptics/chhapticparametercurve).
- [UISelectionFeedbackGenerator](https://developer.apple.com/documentation/uikit/uiselectionfeedbackgenerator).
- [UIImpactFeedbackGenerator](https://developer.apple.com/documentation/uikit/uiimpactfeedbackgenerator).
- [UINotificationFeedbackGenerator](https://developer.apple.com/documentation/uikit/uinotificationfeedbackgenerator).

During the initial 5 October research, direct Apple documentation fetches were blocked by the network allowlist. This records the original research limitation, not a current connectivity test or evidence of native API failure. Apple SDK typechecking, Xcode compilation and physical iPhone checks remain required before a production claim. The separate [test report](TEST-REPORT.md) records what actually ran.

Core Haptics reports `supportsHaptics` for custom effects. UIKit does not expose an equivalent reliable motor-support or completion probe. Consequently, “confirmed hardware available” may be false on an iOS device where UIKit semantic feedback is still permitted; the capability details label that semantic hardware status `unknown`.

### Secondary Apple SDK header evidence

Apple-authored public headers from the **iPhoneOS 18.5 SDK** were read through the third-party `xybp888/iOS-SDKs` mirror. These are an older SDK snapshot, **not a successful fetch of current official Apple documentation**. The exact inspected URLs were:

- [CHHapticEngine.h](https://raw.githubusercontent.com/xybp888/iOS-SDKs/master/iPhoneOS18.5.sdk/System/Library/Frameworks/CoreHaptics.framework/Headers/CHHapticEngine.h): hardware capabilities, haptic-only engine operation, native engine clock, stopped/reset handlers and engine start/stop declarations.
- [CHHapticParameter.h](https://raw.githubusercontent.com/xybp888/iOS-SDKs/master/iPhoneOS18.5.sdk/System/Library/Frameworks/CoreHaptics.framework/Headers/CHHapticParameter.h): event intensity/sharpness, intensity attenuation controls, sharpness offsets, and time/value curve control points.
- [CHHapticPattern.h](https://raw.githubusercontent.com/xybp888/iOS-SDKs/master/iPhoneOS18.5.sdk/System/Library/Frameworks/CoreHaptics.framework/Headers/CHHapticPattern.h): event/parameter-curve pattern initialization.
- [UIFeedbackGenerator.h](https://raw.githubusercontent.com/xybp888/iOS-SDKs/master/iPhoneOS18.5.sdk/System/Library/Frameworks/UIKit.framework/Headers/UIFeedbackGenerator.h): generator preparation and public initialization declarations.
- [UIImpactFeedbackGenerator.h](https://raw.githubusercontent.com/xybp888/iOS-SDKs/master/iPhoneOS18.5.sdk/System/Library/Frameworks/UIKit.framework/Headers/UIImpactFeedbackGenerator.h): light/medium/heavy styles, iOS 13 soft/rigid styles and intensity input.
- [UISelectionFeedbackGenerator.h](https://raw.githubusercontent.com/xybp888/iOS-SDKs/master/iPhoneOS18.5.sdk/System/Library/Frameworks/UIKit.framework/Headers/UISelectionFeedbackGenerator.h): selection feedback has no intensity parameter.
- [UINotificationFeedbackGenerator.h](https://raw.githubusercontent.com/xybp888/iOS-SDKs/master/iPhoneOS18.5.sdk/System/Library/Frameworks/UIKit.framework/Headers/UINotificationFeedbackGenerator.h): success/warning/error feedback has no intensity parameter.

This evidence supports source-level API review. It does not establish current SDK typechecking, native compilation, exact curve playback or physical output. The reproducible syntax/plist check is `tools/native-check/ios-syntax.py`; its source hashes and explicit check boundaries are recorded in [ios-syntax-result.json](evidence/ios-syntax-result.json).

## Evidence boundaries

Official source inspection, schema validation, mocked Construct/Cordova tests and native compilation are distinct forms of evidence. None proves that a player's motor produced a sensation. No part of the addon promises identical feedback across devices, and no accepted-dispatch trigger is presented as a hardware-completion event. See [CAPABILITIES.md](CAPABILITIES.md) and the actual test report for the remaining limits.
