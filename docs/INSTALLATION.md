# Installing Supereo Haptics 1.0.2

Install `dist/Supereo_Haptics-1.0.2.c3addon` in Construct (metadata version `1.0.2.0`). It now declares its separate native Cordova dependency automatically. A normal external Cordova preparation restores that dependency; manual `cordova plugin add` is a troubleshooting fallback, not the normal installation step.

The native bridge remains `cordova-plugin-supereo-haptics` **1.0.0**. Its immutable download is pinned to:

```text
https://raw.githubusercontent.com/supereo/construct-haptics-sdk2/d15c7d1b0ec1300b85a7970fa23a773ed7e1f1fd/dist/cordova-plugin-supereo-haptics-1.0.0.tgz
```

The native ZIP/source directory is also supplied for inspection and an offline/local fallback. The `.c3addon` itself does not contain compiled Java/Swift; Cordova must restore and compile the referenced bridge. No npm publication is required for the pinned HTTPS tarball route. The native package is downloaded at build time, not while a player uses the addon.

**Construct Build Service: NOT APPROVED / compatibility UNVERIFIED.** A dependency declaration does not grant the service permission to compile a new native plugin. The latest supplied Build Service Xcode export was inspected and contains neither the Supereo Haptics bridge nor the game's separate SupereoGameAnalytics bridge. Use the external Cordova route or a supported postprocessing step that includes each matching native package. A successful Build Service export alone is not evidence that these custom native dependencies were included.

## Updating from an earlier addon

Install `Supereo_Haptics-1.0.2.c3addon` through Addon Manager, confirm that Construct shows version `1.0.2.0`, and reload Construct before reopening the original project or previewing it. Version 1.0.1 addressed the original missing helper by embedding the runtime core. Version 1.0.2 uses the documented explicit registration of `c3runtime/haptics-core.js` with `AddC3RuntimeScript` and imports it first from the runtime entry. The DOM-side core stays embedded in `domSide.js`; it does not share the runtime module path. Version 1.0.2 also adds the automatic native reference and export auditor.

The native Cordova bridge remains **1.0.0**. If `cordova-plugin-supereo-haptics 1.0.0` is already installed in your mobile build project, this addon-only update does not require reinstalling it. Re-export your Construct project and rebuild the app to include the corrected addon scripts. A fresh mobile build project still needs the separate bridge installation below.

The update has source/package and loader-contract checks; an actual Construct editor retest of 1.0.2 remains **NOT RUN** unless separately recorded in [TEST-REPORT.md](TEST-REPORT.md).

The published 1.0.1 archive was checked and has no `haptics-core.js` runtime import. The latest supplied export also passes the local static-import audit and the user reports working gameplay. Its confirmed problem is missing native bridge registration, distinct from the earlier missing-module error. The user reports project-bundled Haptics 1.0.1 while the editor has 1.0.2; use the separate bundled-addon update below before the next export.

## Construct editor

The target is Construct 3 r495.2 stable. In Construct, open the Addon Manager, choose installation from a file, and select `Supereo_Haptics-1.0.2.c3addon`. Restart/reload as prompted. Add the single global **Supereo Haptics** object to a new project. When updating an existing game, retain its existing Supereo Haptics object and event-sheet actions. Its stable addon ID is `Supereo_Haptics`.

Use **Play feedback** for ordinary gameplay: Selection tick, Light impact, Medium impact, Strong impact, Soft impact, Crisp impact, Success sequence, Warning sequence or Error sequence. These request native semantics where available; “sequence” describes the intended cue, not a promise about a device's exact pulse count or timing.

For browser previews, explicitly enable simulation and allow operation without a native bridge in the object's properties. Simulation displays the requested cue and emits preview information; it exercises no physical haptic hardware. For mobile exports, set **Native required** to Yes. A missing bridge then produces a clear error. Do this before every production export; simulation is an explicit opt-in workflow, not automatic detection of Construct preview.

Keep the project Worker setting at **Auto** and export minification at **Simple**. The runtime communicates with a DOM handler, so the same design supports Worker Off. Actual editor preview/export verification for r495.2 is recorded separately in [TEST-REPORT.md](TEST-REPORT.md).

## Latest supplied export and prepared repair

The latest uploaded Xcode export uses Simple-minified, main-thread runtime output (`useWorker: false`). Its JavaScript parses and has no missing local static imports; the minified graph contains zero local import references for the auditor to resolve. Both `SupereoHaptics` and `SupereoGameAnalytics` native registrations are absent. Taptic Engine 2.2.0 is present, but it provides a different interface and cannot satisfy either Supereo dependency. This is an inspection of actual supplied files, not a simulated export or device test.

The prepared repaired Xcode ZIP supplied with this task is a complete project copy. For that artifact:

1. Extract it into a new folder, keeping the original export separately.
2. Open the extracted **`App.xcworkspace`** in Xcode. Use the workspace rather than opening only `App.xcodeproj`.
3. Select the app target and your signing team/profile, choose the connected iPhone, use **Product → Clean Build Folder**, then build and run the app.
4. Check native Haptics capability/dispatch results and the game's GameAnalytics startup/error output. Check actual haptic behavior and analytics delivery separately; static inclusion does not prove either one works on the device or reaches a dashboard.

No Cordova install, prepare or platform-add command is required to use that matching prepared artifact. Regenerating it with a different platform or package configuration could discard the prepared registrations. The bridge installation and project-file checks are recorded in [TEST-REPORT.md](TEST-REPORT.md); agent-side Xcode compilation, iPhone output and GameAnalytics dashboard delivery remain **NOT RUN** here.

### Reported GameAnalytics C++ linker failure

The user's Xcode build of the first prepared copy failed at native linking with undefined C++ symbols, including `std::__1::chrono::steady_clock::now()`, `std::terminate()`, `__cxa_begin_catch` and `__gxx_personality_v0`. The GameAnalytics native SDK requires Apple's C++ runtime, **`libc++.tbd`**. The matching GameAnalytics bridge package 1.0.0-rc.1 omitted that link declaration; correct native service registration alone did not cover this dependency.

To correct an already extracted copy in Xcode:

1. Open `App.xcworkspace` and select the **App target**.
2. Open **Build Phases → Link Binary With Libraries**, click **+**, search for **`libc++.tbd`**, select it and click **Add**.
3. Use **Product → Clean Build Folder**, then build again with your existing signing configuration.

This links the system C++ runtime; it does not require replacing either native bridge package or the Construct addon. A corrected project-file reference still needs an actual Xcode link and device test. The user's failed link is recorded as **FAIL**; agent-side Xcode compilation, physical haptics and analytics delivery remain **NOT RUN**.

The revised prepared Xcode project and repair kit **1.0.1** now include this dependency automatically. Static verification found the SDKROOT `usr/lib/libc++.tbd` reference linked once in the app's frameworks phase, without embedding or resource copying. All protected gameplay assets and existing native bridge/SDK bytes remain unchanged. The [sanitized link-dependency evidence](evidence/libcxx-link-summary.json) records the correction; a successful Xcode rebuild has not yet been established.

The prepared repair does not update the original Construct source project's bundled addon or make future Build Service exports include the custom bridges. For future builds, use the source update and export process below. See [EXPORT-TROUBLESHOOTING.md](EXPORT-TROUBLESHOOTING.md) for the distinction between a missing runtime file, missing native package and device/backend verification.

For future standalone Xcode exports, the separately supplied repair kit provides local postprocessing using Cordova iOS 8.1.1 and the matching Haptics 1.0.0 and SupereoGameAnalytics 1.0.0-rc.1 packages. Follow the kit's **README** to install its pinned tools and create a fresh repaired output copy; keep the input export intact. Individual manual plugin-install commands are not part of that workflow. Then open the output's `App.xcworkspace` and perform signing/build/device checks as above. The kit is delivered outside this SDK repository and is not evidence of Build Service approval, Xcode compilation or device/backend success.

## Update the QuickChess source before future exports

The supplied source location is `/Users/ben/Downloads/QuickChess/`; its bundled archive is `addons/plugin/Supereo_Haptics.c3addon`. The user now reports bundled Haptics 1.0.1 while the editor has 1.0.2. The original Mac source folder is still unavailable here; an uploaded export copy can be inspected, but does not establish that the source was saved with the updated bundled addon. The export location is `/Users/ben/Downloads/QuickChess Construct 3/`. Rebuild from the original Construct source:

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
6. Include the game's matching custom **SupereoGameAnalytics** native bridge separately when the game uses that Construct addon. It is independent of Supereo Haptics. The latest Build Service export omitted that native bridge too; a Taptic Engine plugin or an unrelated public GameAnalytics plugin does not provide the matching interface. Use the matching native package with the external build, or postprocess a copied Xcode export using Cordova iOS's supported plugin installation API.
7. Open the resulting `platforms/ios/App.xcworkspace`, build and install the complete new app with your signing configuration, then capture startup errors and both addons' native results. If Construct's Build Service is generating the Xcode project, approval is required for each custom dependency; future automatic inclusion through that service remains unestablished.

This workflow needs no gameplay, analytics event-sheet, backend or purchase changes. The original Mac source folder and editor remain unavailable, so updating the actual project-bundled addon and re-exporting are **NOT RUN** here. The latest supplied export has now been inspected, and its native bridge omissions are confirmed. Passing a static import audit does not prove Xcode compilation, native device output or analytics dashboard delivery. Those checks remain **NOT RUN** here.

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

Actual Cordova iOS 8.1.1 plugin installation, preparation and these project-file inclusions passed in the independent native-check host; see [NATIVE-CHECKS.md](NATIVE-CHECKS.md) and [ios-project-result.json](evidence/ios-project-result.json). A later repair also installed the bridge into a separate copy of the supplied Xcode export through the supported Cordova iOS platform API; see [TEST-REPORT.md](TEST-REPORT.md). Neither check compiled with Xcode or exercised an iPhone. A separately installed `taptic-engine` does not satisfy these Supereo registrations. Do not hand-copy only the Swift file or add a similarly named global: include the complete package through Cordova's supported installation path.

Generating an Xcode project and compiling/running it are separate checks. A Linux environment may generate project files but cannot provide an Apple SDK compile or an iPhone hardware test. Neither an iOS simulator nor a mocked test demonstrates haptic output.

No iOS haptics permission prompt is required. The included privacy manifest declares no collection or tracking by this bridge. The app's complete privacy disclosures still depend on its other components. Core Haptics is set to haptics-only mode; the addon does not synthesize audio.

## Build Service status and future approval

There is no approval for this `cordova-plugin-supereo-haptics` 1.0.0 dependency. Addon 1.0.2 declares it automatically for Cordova exports, but **Build Service remains NOT APPROVED / compatibility UNVERIFIED**. Uploading the `.c3addon` does not request or grant native package approval. A public immutable URL also does not bypass the service's allowlist.

Before relying on Build Service AAB, Android Studio or Xcode-project generation, obtain Scirra approval for this exact dependency, verify the service's compile SDK 36/Swift/iOS deployment support, and validate an export containing the native class and JavaScript plugin module. Do the same for the matching SupereoGameAnalytics bridge when the game uses it. Until those steps pass, use the external route or supported postprocessing of both matching native packages. The inspected supplied Build Service export lacked both bridges; future inclusion and device success remain unverified.

Official source evidence and the boundary between approval evidence and a successful build are in [RESEARCH.md](RESEARCH.md). The package is available at the pinned public repository URL; no npm publication or Scirra approval request was made.

## First-run checks

Wait for the addon's ready/capability result before displaying capability details. In a mobile build, **Native bridge available** should be true and **Backend** should identify `android-native` or `ios-native`. If it identifies `preview-simulation`, review Native required and the exported settings before release.

Use **Play feedback: Selection tick**, **Set overall strength**, **Set haptics enabled**, a short named custom pattern, and **Stop feedback**. Watch **On error**, **Last error**, **Last result JSON** and **Fallback information**. An accepted request means that the addon handed a request to the local backend; it does not prove that the device physically played the effect.

On iOS, confirmed Core Haptics hardware support can be false while UIKit semantic feedback remains permitted with unknown physical hardware status. Read the capability details rather than assuming this condition is a universal “every kind of feedback works” switch. The full behavior matrix is in [CAPABILITIES.md](CAPABILITIES.md).
