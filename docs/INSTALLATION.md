# Installing Supereo Haptics 1.0.1

Install **both** parts for a mobile build:

1. `dist/Supereo_Haptics-1.0.1.c3addon` adds the Construct event-sheet controls (Construct metadata version `1.0.1.0`).
2. `dist/cordova-plugin-supereo-haptics-1.0.0.zip` or the source directory `native/cordova-plugin-supereo-haptics/` supplies the Java/Swift implementations to Cordova.

The `.c3addon` alone cannot add native code to an Android or iOS app. The bridge package is versioned locally and has not been published to npm. **Construct Build Service compatibility is UNVERIFIED**; use the external Cordova route below until this exact native package/version has been reviewed and an actual Construct export has passed.

## Updating from addon 1.0.0

Install `Supereo_Haptics-1.0.1.c3addon` through Addon Manager, confirm that Construct shows version `1.0.1.0`, and reload Construct before reopening the project or previewing it. This update addresses the reported build loader error for `c3runtime/haptics-core.js` by embedding the shared pattern code in the addon's registered runtime plugin and DOM scripts. No additional helper module needs to be resolved by Construct.

The native Cordova bridge remains **1.0.0**. If `cordova-plugin-supereo-haptics 1.0.0` is already installed in your mobile build project, this addon-only update does not require reinstalling it. Re-export your Construct project and rebuild the app to include the corrected addon scripts. A fresh mobile build project still needs the separate bridge installation below.

The update has source/package and loader-contract checks; an actual Construct editor retest of 1.0.1 remains **NOT RUN** unless separately recorded in [TEST-REPORT.md](TEST-REPORT.md).

## Construct editor

The target is Construct 3 r495.2 stable. In Construct, open the Addon Manager, choose installation from a file, and select `Supereo_Haptics-1.0.1.c3addon`. Restart/reload as prompted. Add the single global **Supereo Haptics** object to the project. Its stable addon ID is `Supereo_Haptics`.

Use **Play feedback** for ordinary gameplay: Selection tick, Light impact, Medium impact, Strong impact, Soft impact, Crisp impact, Success sequence, Warning sequence or Error sequence. These request native semantics where available; “sequence” describes the intended cue, not a promise about a device's exact pulse count or timing.

For browser previews, explicitly enable simulation and allow operation without a native bridge in the object's properties. Simulation displays the requested cue and emits preview information; it exercises no physical haptic hardware. For mobile exports, set **Native required** to Yes. A missing bridge then produces a clear error. Do this before every production export; simulation is an explicit opt-in workflow, not automatic detection of Construct preview.

Keep the project Worker setting at **Auto** and export minification at **Simple**. The runtime communicates with a DOM handler, so the same design supports Worker Off. Actual editor preview/export verification for r495.2 is recorded separately in [TEST-REPORT.md](TEST-REPORT.md).

## Export a Cordova project

Choose Construct's Android or iOS mobile export and choose **Cordova project** output rather than asking the Build Service to compile the app. Extract the complete output to a fresh build directory. Work at the root containing `config.xml`, `package.json` and `www/`.

Retain Construct's Cordova export metadata, wrapper plugins, `cordova.js` reference and generated startup scripts. Add Supereo's bridge to this exported project. Do not copy only a web export's `index.html` into an unrelated wrapper or manually paste native source files into generated `platforms/` directories.

Use a separate build directory for every Construct re-export so that stale plugin files cannot conceal a missing dependency. Keep your native-install command and any supported configuration changes in a repeatable build script outside the generated `platforms/` tree. Cordova regenerates that tree.

The supplied plugin manifest requires Cordova Android 15+ and Cordova iOS 8+. The reference versions used below are Cordova CLI 13.0.0, Android 15.0.0 and iOS 8.1.1. Those are external-build choices; they do not assert which versions Construct's Build Service uses.

### Install the bridge locally

Extract the native ZIP and locate the directory containing its `plugin.xml` and `package.json`. Alternatively use that directory from the complete source ZIP. From the Construct Cordova project's root:

```sh
npx --yes cordova@13.0.0 plugin add /absolute/path/to/native/cordova-plugin-supereo-haptics
npx --yes cordova@13.0.0 plugin ls
```

Replace the example path with your local directory; quote it if it contains spaces. `plugin ls` should include `cordova-plugin-supereo-haptics 1.0.0`. The official Cordova plugin specification maps its JavaScript module to `cordova.plugins.SupereoHaptics`, its Android class to `com.supereo.haptics.SupereoHaptics`, and its iOS class to `SupereoHaptics`. Cordova performs this registration; adding a browser `<script>` pointing at native source does not replace installation.

If updating an earlier local copy, remove `cordova-plugin-supereo-haptics`, add the intended new package, then prepare again. Pin the exact local release and verify the checksums from `dist/SHA256SUMS`. If you use the `.tgz` package, extract it first and pass the extracted `package/` directory to the local-directory command above.

## Android AAB

The reference route needs JDK 17, Android SDK platform 36 and build tools 36.0.0, Gradle 8.14.2, and a supported Node version (20.17+ or 22.9+). The Java bridge uses public API 36 envelope types at compile time but guards their use at runtime. The reference Cordova minimum device version is Android 7.0/API 24; older phones within that range use available waveform/on-off fallbacks.

If the exported project already declares Android, inspect `cordova platform ls` and its package metadata. Align a fresh external export with Android 15.0.0 using Cordova's platform commands; preserve other required Construct plugins. When Android is not yet installed:

```sh
npx --yes cordova@13.0.0 platform add android@15.0.0
npx --yes cordova@13.0.0 prepare android
npx --yes cordova@13.0.0 requirements android
npx --yes cordova@13.0.0 build android --debug
npx --yes cordova@13.0.0 build android --release -- --packageType=bundle
```

An unsigned AAB is useful for build validation but cannot be uploaded as a signed release. Configure your own app ID/version and release signing using Cordova's supported `build.json`/Android signing workflow; keep passwords and keys out of the addon and source repository. Cordova prints the output location, usually under `platforms/android/app/build/outputs/bundle/release/`.

If the project specifies a lower compile SDK, set the supported `android-compileSdkVersion` and `android-targetSdkVersion` preferences to `36` in the exported project's `config.xml` before preparation, and install the matching SDK. Keep minimum API at least `24` for the reference platform. Do not remove API guards or downgrade the compile SDK to suppress missing-class errors. Additional plugins may impose their own supported platform constraints.

Only `android.permission.VIBRATE` is declared by this bridge. It is a normal permission and does not require a runtime permission dialog. No analytics, Internet, location, microphone or tracking permission is added by Supereo Haptics. Other game plugins may add their own permissions.

Test on a real advanced Android device and a basic motor before shipping. `hasVibrator`, amplitude support and primitive/effect/envelope queries describe available APIs and hardware; user settings, power policy and system behavior can still suppress or alter output.

## iOS Xcode project

Use macOS and a supported Xcode/iOS SDK. Cordova iOS 8 requires Node 20.17+, Xcode 15+ and CocoaPods 1.16+ according to the current official Cordova guide; App Store submission may require a newer Xcode version. The bridge uses Swift 5 and targets iOS 13+ with UIKit and CoreHaptics system frameworks. No third-party haptic library or pod is required by the bridge itself.

From a fresh Construct iOS Cordova export, install the local bridge as above, then, if iOS is not yet installed:

```sh
npx --yes cordova@13.0.0 platform add ios@8.1.1
npx --yes cordova@13.0.0 prepare ios
npx --yes cordova@13.0.0 requirements ios
open platforms/ios/App.xcworkspace
```

If the export already pins another iOS platform, inspect the constraints of all its plugins before aligning the fresh export with iOS 8.1.1. Do not add the same platform twice. Set a valid bundle identifier and your development team in Xcode, then build/install on a supported iPhone. Open the `.xcworkspace` after preparation so Cordova's workspace dependencies are included. `cordova build ios` can also compile with your local signing configuration.

Generating an Xcode project and compiling/running it are separate checks. A Linux environment may generate project files but cannot provide an Apple SDK compile or an iPhone hardware test. Neither an iOS simulator nor a mocked test demonstrates haptic output.

No iOS haptics permission prompt is required. The included privacy manifest declares no collection or tracking by this bridge. The app's complete privacy disclosures still depend on its other components. Core Haptics is set to haptics-only mode; the addon does not synthesize audio.

## Build Service status and future approval

There is no confirmed approval for `cordova-plugin-supereo-haptics@1.0.0`. This release leaves automatic Build Service native dependency injection disabled. Uploading the `.c3addon` does not request or grant native package approval, and shipping the ZIP inside a Construct project does not make the service compile it.

Before using Build Service AAB, Android Studio or Xcode-project generation with this plugin, obtain Scirra approval for a published immutable native package/version, verify the service's compile SDK 36/Swift/iOS deployment support, and validate an export that contains the native class and JavaScript plugin module. The Construct editor dependency declaration can then be added in a separately tested release using the documented SDK API. Until those steps pass, use the external route.

Official source evidence and the boundary between approval evidence and a successful build are in [RESEARCH.md](RESEARCH.md). No package was published and no approval request was sent during this work.

## First-run checks

Wait for the addon's ready/capability result before displaying capability details. In a mobile build, **Native bridge available** should be true and **Backend** should identify `android-native` or `ios-native`. If it identifies `preview-simulation`, review Native required and the exported settings before release.

Use **Play feedback: Selection tick**, **Set overall strength**, **Set haptics enabled**, a short named custom pattern, and **Stop feedback**. Watch **On error**, **Last error**, **Last result JSON** and **Fallback information**. An accepted request means that the addon handed a request to the local backend; it does not prove that the device physically played the effect.

On iOS, confirmed Core Haptics hardware support can be false while UIKit semantic feedback remains permitted with unknown physical hardware status. Read the capability details rather than assuming this condition is a universal “every kind of feedback works” switch. The full behavior matrix is in [CAPABILITIES.md](CAPABILITIES.md).
