# Installing Supereo Haptics 1.0.2

Install `dist/Supereo_Haptics-1.0.2.c3addon` in Construct (metadata version `1.0.2.0`). It now declares its separate native Cordova dependency automatically. A normal external Cordova preparation restores that dependency; manual `cordova plugin add` is a troubleshooting fallback, not the normal installation step.

The native bridge remains `cordova-plugin-supereo-haptics` **1.0.0**. Its immutable download is pinned to:

```text
https://raw.githubusercontent.com/supereo/construct-haptics-sdk2/d15c7d1b0ec1300b85a7970fa23a773ed7e1f1fd/dist/cordova-plugin-supereo-haptics-1.0.0.tgz
```

The native ZIP/source directory is also supplied for inspection and an offline/local fallback. The `.c3addon` itself does not contain compiled Java/Swift; Cordova must restore and compile the referenced bridge. No npm publication is required for the pinned HTTPS tarball route. The native package is downloaded at build time, not while a player uses the addon.

**Construct Build Service: NOT APPROVED / compatibility UNVERIFIED.** A dependency declaration does not grant the service permission to compile a new native plugin. Use the external Cordova route below. Actual Construct r495.2 export of this reference and Build Service pass-through remain **NOT RUN** here.

## Updating from an earlier addon

Install `Supereo_Haptics-1.0.2.c3addon` through Addon Manager, confirm that Construct shows version `1.0.2.0`, and reload Construct before reopening the original project or previewing it. Version 1.0.1 addressed the original missing helper by embedding the runtime core. Version 1.0.2 uses the documented explicit registration of `c3runtime/haptics-core.js` with `AddC3RuntimeScript` and imports it first from the runtime entry. The DOM-side core stays embedded in `domSide.js`; it does not share the runtime module path. Version 1.0.2 also adds the automatic native reference and export auditor.

The native Cordova bridge remains **1.0.0**. If `cordova-plugin-supereo-haptics 1.0.0` is already installed in your mobile build project, this addon-only update does not require reinstalling it. Re-export your Construct project and rebuild the app to include the corrected addon scripts. A fresh mobile build project still needs the separate bridge installation below.

The update has source/package and loader-contract checks; an actual Construct editor retest of 1.0.2 remains **NOT RUN** unless separately recorded in [TEST-REPORT.md](TEST-REPORT.md).

The published 1.0.1 archive was checked and has no `haptics-core.js` runtime import. Seeing that old import after installing 1.0.1 therefore suggests another project-bundled/cached/exported copy; the actual QuickChess folders are absent here, so that explanation remains unproven. Use the project-bundled update steps below rather than assuming an editor-wide install updated the saved project.

## Construct editor

The target is Construct 3 r495.2 stable. In Construct, open the Addon Manager, choose installation from a file, and select `Supereo_Haptics-1.0.2.c3addon`. Restart/reload as prompted. Add the single global **Supereo Haptics** object to a new project. When updating an existing game, retain its existing Supereo Haptics object and event-sheet actions. Its stable addon ID is `Supereo_Haptics`.

Use **Play feedback** for ordinary gameplay: Selection tick, Light impact, Medium impact, Strong impact, Soft impact, Crisp impact, Success sequence, Warning sequence or Error sequence. These request native semantics where available; “sequence” describes the intended cue, not a promise about a device's exact pulse count or timing.

For browser previews, explicitly enable simulation and allow operation without a native bridge in the object's properties. Simulation displays the requested cue and emits preview information; it exercises no physical haptic hardware. For mobile exports, set **Native required** to Yes. A missing bridge then produces a clear error. Do this before every production export; simulation is an explicit opt-in workflow, not automatic detection of Construct preview.

Keep the project Worker setting at **Auto** and export minification at **Simple**. The runtime communicates with a DOM handler, so the same design supports Worker Off. Actual editor preview/export verification for r495.2 is recorded separately in [TEST-REPORT.md](TEST-REPORT.md).

## QuickChess: replace the stale exported addon

The user reports the missing `haptics-core.js` import and an iOS splash-screen hang, including after an attempted addon 1.0.1 update. The supplied Construct source folder is `/Users/ben/Downloads/QuickChess/`; its bundled addon is `addons/plugin/Supereo_Haptics.c3addon`, originally reported at metadata version `1.0.0.0`. Its current files have not been inspected here. The supplied Xcode export is `/Users/ben/Downloads/QuickChess Construct 3/`. An already generated export will not acquire corrected scripts merely because the editor addon was updated. Rebuild from the original Construct source:

1. Preserve the existing downloaded export at `/Users/ben/Downloads/QuickChess Construct 3/` so its files and logs remain available for diagnosis.
2. Install `Supereo_Haptics-1.0.2.c3addon` through Construct's Addon Manager, verify editor version `1.0.2.0`, and reload Construct. Open the original folder project at `/Users/ben/Downloads/QuickChess/`. In the **Project Bar**, right-click the project name → **Tools** → **View used addons**. Right-click the bold bundled **Supereo Haptics** entry → **Update to editor version**. Save the folder project and reload/reopen it. These are the official bundled-addon update steps in [Installing third-party addons](https://www.construct.net/en/make-games/manuals/construct-3/tips-and-guides/installing-third-party-addons#bundling-addons-to-projects).

   Keep the existing `Supereo_Haptics` object and game events. Confirm that the project-bundled archive at `/Users/ben/Downloads/QuickChess/addons/plugin/Supereo_Haptics.c3addon` now contains addon metadata version `1.0.2.0`; updating the editor's installed copy alone does not update a bundled addon. No `.c3p` filename was provided.

   To inspect that archive's metadata on the Mac:

   ```sh
   unzip -p '/Users/ben/Downloads/QuickChess/addons/plugin/Supereo_Haptics.c3addon' addon.json
   ```

   If it still reports an older version, repeat **View used addons → Update to editor version**, save and reopen before exporting.
3. Reopen the updated source folder, set **Native required** Yes for the mobile export, and export the complete iOS **Cordova project** again with Worker **Auto** and minification **Simple**. Extract it into a fresh directory. Do not overlay only a new `main.js` onto the previous export: its other plugin scripts, module map and bundled output also need to match the updated addon.
4. From the extracted Supereo source package or this repository, audit the existing export with the exact path provided:

   ```sh
   npm run audit:export -- '/Users/ben/Downloads/QuickChess Construct 3/'
   ```

   Then run the same command with the fresh export's directory. It accepts a Cordova root, its `www/`, or an iOS/Xcode export root with a unique nested `www/`. If more than one `www/` is present, point to the exact app web directory to avoid ambiguity. Missing local static modules produce a nonzero exit code. Version 1.0.2 can import `haptics-core.js`, but it is now registered and included, so the import must resolve. Review the native bridge registration report separately; before Cordova preparation the plugin's generated loader may not yet be present.
5. From the fresh Cordova project root, confirm the pinned Supereo dependency is present in `config.xml`, as shown below. Run the standard Cordova iOS 8.1.1 preparation route; it should restore native bridge 1.0.0 from that declaration. Then use `cordova plugin ls` to confirm installation. A plugin called `taptic-engine` is a different plugin: it does not provide `cordova.plugins.SupereoHaptics` or the native `SupereoHaptics` service.
6. Open the resulting `platforms/ios/App.xcworkspace`, build and install the complete new app with your signing configuration, then capture startup errors and the addon's capability results. If Construct's Build Service is generating the Xcode project, its approval boundary still applies; automatic native inclusion through that service is not established for this package.

This workflow needs no changes to QuickChess gameplay, analytics, backend or purchases. Both supplied Mac folders are absent from this cloud workspace, so checking the actual source project's bundled addon and auditing the actual export are **NOT RUN** until those files or local outputs are available. Passing a static import audit is useful loading evidence; it does not prove that the splash-screen symptom has only one cause, that Xcode compilation succeeds, or that haptics play on the device. Actual iOS startup and device checks remain **NOT RUN** here.

## Export a Cordova project

Choose Construct's Android or iOS mobile export and choose **Cordova project** output rather than asking the Build Service to compile the app. Extract the complete output to a fresh build directory. Work at the root containing `config.xml`, `package.json` and `www/`.

Retain Construct's Cordova export metadata, wrapper plugins, `cordova.js` reference and generated startup scripts. Supereo's addon declares the native dependency; Cordova restores it from the exported metadata. Do not copy only a web export's `index.html` into an unrelated wrapper or manually paste native source files into generated `platforms/` directories.

Use a separate build directory for every Construct re-export so that stale plugin files cannot conceal a missing dependency. Keep supported configuration/build commands in a repeatable script outside the generated `platforms/` tree. Cordova regenerates that tree.

The supplied plugin manifest requires Cordova Android 15+ and Cordova iOS 8+. The reference versions used below are Cordova CLI 13.0.0, Android 15.0.0 and iOS 8.1.1. Those are external-build choices; they do not assert which versions Construct's Build Service uses.

### Automatic native dependency

Addon 1.0.2 calls the documented `AddCordovaPluginReference` with the package ID, immutable HTTPS tarball as its version spec, and platform `all`. Construct's dependency guide documents generation of a Cordova `<plugin>` entry. Inspect the fresh export's `config.xml` for this expected reference:

```xml
<plugin name="cordova-plugin-supereo-haptics" spec="https://raw.githubusercontent.com/supereo/construct-haptics-sdk2/d15c7d1b0ec1300b85a7970fa23a773ed7e1f1fd/dist/cordova-plugin-supereo-haptics-1.0.0.tgz" />
```

Use the ordinary `platform add`/`prepare` commands below. Cordova's restoration reads the plugin declaration, fetches the package and installs its JavaScript/native registration. `plugin ls` should then include `cordova-plugin-supereo-haptics 1.0.0`. The package maps its JavaScript module to `cordova.plugins.SupereoHaptics`, Android class to `com.supereo.haptics.SupereoHaptics`, and iOS class to `SupereoHaptics`.

The public pinned tarball matches native bridge 1.0.0; SHA-256 is `e2662681fc0b2434a1af13beafd28739b9b68d078a05acc75fcb23201593e25d`. TLS and npm integrity checks remain enabled. This build step needs access to `raw.githubusercontent.com` and the normal platform/tool dependencies. The addon does not fetch remote haptic code during gameplay.

**Verified external restoration:** a fresh Cordova CLI 13.0.0 / iOS 8.1.1 host restored this URL from a constructed `config.xml` matching the addon declaration, without any manual `plugin add` command. Preparation included the JavaScript namespace, native feature, Swift source, frameworks and privacy resources. See [ios-auto-install-result.json](evidence/ios-auto-install-result.json) and [CLI output](evidence/ios-auto-install.log). That configuration was not produced by an actual Construct editor export, and the check did not compile with Xcode or run an iPhone.

The actual Construct editor export of this reference remains **NOT RUN**. If it is absent, first verify the project's bundled addon update and re-export. If preparation fails, retain the precise error, check supported Cordova versions and build-time access, and use the export audit; a missing reference is not evidence of a functioning automatic route.

### Troubleshooting/offline local fallback

If the exported reference cannot be restored, the supplied native ZIP/source directory provides a supported manual fallback. Locate the directory containing `plugin.xml` and `package.json`, then, from the Cordova project root:

```sh
npx --yes cordova@13.0.0 plugin add /absolute/path/to/native/cordova-plugin-supereo-haptics
```

Quote the path if it contains spaces. Prepare the chosen platform afterwards. This fallback is not required for a working automatic declaration and does not bypass Build Service approval. Do not disable TLS/checksum verification or replace the pinned package with an invented registry version.

## Android AAB

The reference route needs JDK 17, Android SDK platform 36 and build tools 36.0.0, Gradle 8.14.2, and a supported Node version (20.17+ or 22.9+). The Java bridge uses public API 36 envelope types at compile time but guards their use at runtime. The reference Cordova minimum device version is Android 7.0/API 24; older phones within that range use available waveform/on-off fallbacks.

If the exported project already declares Android, inspect `cordova platform ls` and its package metadata. Align a fresh external export with Android 15.0.0 using Cordova's platform commands; preserve other required Construct plugins. When Android is not yet installed:

```sh
npx --yes cordova@13.0.0 platform add android@15.0.0
npx --yes cordova@13.0.0 prepare android
npx --yes cordova@13.0.0 plugin ls
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

From a fresh Construct iOS Cordova export containing the pinned plugin declaration above, if iOS is not yet installed:

```sh
npx --yes cordova@13.0.0 platform add ios@8.1.1
npx --yes cordova@13.0.0 prepare ios
npx --yes cordova@13.0.0 plugin ls
npx --yes cordova@13.0.0 requirements ios
open platforms/ios/App.xcworkspace
```

If the export already pins another iOS platform, inspect the constraints of all its plugins before aligning the fresh export with iOS 8.1.1. Do not add the same platform twice. Set a valid bundle identifier and your development team in Xcode, then build/install on a supported iPhone. Open the `.xcworkspace` after preparation so Cordova's workspace dependencies are included. `cordova build ios` can also compile with your local signing configuration.

### Verify the Supereo bridge registration

The packaged `plugin.xml` requires Cordova iOS **8.0.0 or later**; this release's verified project-generation reference is **8.1.1**. Cordova must include all of the following after plugin installation and preparation:

| Layer | Expected registration |
| --- | --- |
| Installed package | `cordova-plugin-supereo-haptics 1.0.0` in `cordova plugin ls` |
| JavaScript plugin loader | The Supereo module listed in `cordova_plugins.js`, with clobber `cordova.plugins.SupereoHaptics` |
| iOS Cordova configuration | Feature `SupereoHaptics`, with `ios-package` value `SupereoHaptics` |
| Xcode source phase | `SupereoHaptics.swift` from the installed Supereo plugin |
| Xcode frameworks/resources | `UIKit.framework`, `CoreHaptics.framework` and `SupereoHaptics.bundle/PrivacyInfo.xcprivacy` |

Actual Cordova iOS 8.1.1 plugin installation, preparation and these project-file inclusions passed in the independent native-check host; see [NATIVE-CHECKS.md](NATIVE-CHECKS.md) and [ios-project-result.json](evidence/ios-project-result.json). Those checks did not inspect the user's QuickChess export or run Xcode. A separately installed `taptic-engine` does not satisfy these Supereo registrations. Do not hand-copy only the Swift file or add a similarly named global: install and prepare the complete package through Cordova.

Generating an Xcode project and compiling/running it are separate checks. A Linux environment may generate project files but cannot provide an Apple SDK compile or an iPhone hardware test. Neither an iOS simulator nor a mocked test demonstrates haptic output.

No iOS haptics permission prompt is required. The included privacy manifest declares no collection or tracking by this bridge. The app's complete privacy disclosures still depend on its other components. Core Haptics is set to haptics-only mode; the addon does not synthesize audio.

## Build Service status and future approval

There is no approval for this `cordova-plugin-supereo-haptics` 1.0.0 dependency. Addon 1.0.2 declares it automatically for Cordova exports, but **Build Service remains NOT APPROVED / compatibility UNVERIFIED**. Uploading the `.c3addon` does not request or grant native package approval. A public immutable URL also does not bypass the service's allowlist.

Before relying on Build Service AAB, Android Studio or Xcode-project generation, obtain Scirra approval for this exact dependency, verify the service's compile SDK 36/Swift/iOS deployment support, and validate an export containing the native class and JavaScript plugin module. Until those steps pass, use the external route. Actual service pass-through and export success are **NOT RUN** here.

Official source evidence and the boundary between approval evidence and a successful build are in [RESEARCH.md](RESEARCH.md). The package is available at the pinned public repository URL; no npm publication or Scirra approval request was made.

## First-run checks

Wait for the addon's ready/capability result before displaying capability details. In a mobile build, **Native bridge available** should be true and **Backend** should identify `android-native` or `ios-native`. If it identifies `preview-simulation`, review Native required and the exported settings before release.

Use **Play feedback: Selection tick**, **Set overall strength**, **Set haptics enabled**, a short named custom pattern, and **Stop feedback**. Watch **On error**, **Last error**, **Last result JSON** and **Fallback information**. An accepted request means that the addon handed a request to the local backend; it does not prove that the device physically played the effect.

On iOS, confirmed Core Haptics hardware support can be false while UIKit semantic feedback remains permitted with unknown physical hardware status. Read the capability details rather than assuming this condition is a universal “every kind of feedback works” switch. The full behavior matrix is in [CAPABILITIES.md](CAPABILITIES.md).
