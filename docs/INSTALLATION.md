# Install and export Supereo Haptics 1.0.3

Install **`dist/Supereo_Haptics-1.0.3.c3addon`**. Construct metadata version is **1.0.3.0**; addon ID remains **Supereo_Haptics**. The matching native bridge remains **cordova-plugin-supereo-haptics 1.0.0**.

**Current blocker:** the user confirmed that the native tarball's GitHub repository is private. Their actual Mac `cordova prepare ios` log discovers the Supereo dependency from `config.xml`, then npm returns **E404** for its raw GitHub URL. The same failed project dependency also blocks restoration of other plugins. Updating the addon alone cannot make that URL publicly accessible. A separate public native-package host, or an explicitly public repository, must be established before ordinary unauthenticated preparation can work. No visibility change or publication has been made. [Sanitized evidence](evidence/native-distribution-blocker-1.0.3.json).

The chosen workflow is **Construct Cordova project export → normal local Cordova prepare/build**. It uses the same Supereo native bridge and needs **no Scirra approval or native npm publication**. The addon declares its immutable native package automatically. No per-export plugin-add, native file copying, config patching or repair kit is part of this workflow.

A `.c3addon` contains the Construct extension, not compiled Java/Swift. Ordinary Cordova preparation restores the declared native package and generates the native project. Version 1.0.3 improves runtime startup/lifecycle handling; JavaScript cannot create an absent native implementation.

## Update the editor and project once

1. In Construct's **Addon Manager**, install `Supereo_Haptics-1.0.3.c3addon`, confirm version `1.0.3.0`, and reload Construct.
2. Open the original game project. If it bundles Supereo Haptics, use **Project Bar → right-click project → Tools → View used addons → right-click the bold Supereo Haptics entry → Update to editor version**. **Save, close and reopen** the project. Updating the editor's installed addon alone does not update a project-bundled copy.
3. Confirm that the project's Supereo Haptics version is `1.0.3.0`. For a folder project, its bundled archive is `addons/plugin/Supereo_Haptics.c3addon`. Keep the existing object and event-sheet actions; its stable ID and ordinary controls are unchanged.
4. Keep **Native required** enabled for mobile exports, Worker **Auto** or **Off**, and minification **Simple**. The requested editor target is Construct 3 **r495.2 stable**.

These are Construct's [official bundled-addon update steps](https://www.construct.net/en/make-games/manuals/construct-3/tips-and-guides/installing-third-party-addons#bundling-addons-to-projects). Perform the project update once for this release. Actual QuickChess editor wiring and this source-project update are **NOT RUN** here because the editor/source project is unavailable.

## Export the complete Cordova project

In Construct's Android/iOS mobile export, choose **Cordova project** output. Extract the complete project into a fresh build directory. Work in the directory containing `config.xml` and `www/`; retain all of Construct's generated startup files and other plugin metadata. Updating the addon does not rewrite an older export.

The shipping addon uses the documented `AddCordovaPluginReference` interface. Construct's dependency guide documents automatic inclusion in the Cordova export's `config.xml`. The expected Supereo reference is:

```xml
<plugin name="cordova-plugin-supereo-haptics" spec="https://raw.githubusercontent.com/supereo/construct-haptics-sdk2/d15c7d1b0ec1300b85a7970fa23a773ed7e1f1fd/dist/cordova-plugin-supereo-haptics-1.0.0.tgz" />
```

This is an inspection check, not a request to paste configuration into each export. If the reference is absent, verify the project-bundled addon update and produce a fresh complete export. Retain the error if it is still absent; this environment has not executed a fresh actual Construct 1.0.3 export and cannot label that emission verified.

The tarball was retrieved through the managed cloud environment with TLS verification on 11 October 2026. SHA-256 is **`e2662681fc0b2434a1af13beafd28739b9b68d078a05acc75fcb23201593e25d`**; all nine package files match the unchanged native source. That access did not prove anonymous public availability, and the user's Mac subsequently received E404. It is downloaded at build time, not during gameplay. Local URL restoration does not require npm publication, but its host must be accessible to the build machine.

## Local iOS build on the Mac

Use a supported Node version (22.9+ recommended), macOS, Xcode and its command-line tools. The [current official Cordova iOS guide](https://cordova.apache.org/docs/en/latest/guide/platforms/ios/) lists Node 20.17+, Xcode 15+ and CocoaPods 1.16+ for iOS 8; submission requirements may require newer Xcode. The native bridge uses Swift 5, iOS 13+, UIKit and CoreHaptics. It requires no third-party haptics pod or permission dialog.

From the extracted Cordova project root:

```sh
npx --yes cordova@13.0.0 platform ls
```

For a fresh source export where iOS is not installed yet:

```sh
npx --yes cordova@13.0.0 platform add ios@8.1.1
npx --yes cordova@13.0.0 prepare ios
npx --yes cordova@13.0.0 plugin ls
npx --yes cordova@13.0.0 requirements ios
```

If iOS is already installed, inspect its version and run `prepare ios` rather than adding it twice. The reference platform is **8.1.1**; other game plugins have their own constraints. The pinned CLI can alternatively be installed once globally and invoked as `cordova`.

Cordova's normal restoration should include **`cordova-plugin-supereo-haptics 1.0.0`** in `plugin ls`. Open the generated **`.xcworkspace` under `platforms/ios/`** in Xcode, select the app target and your signing team/profile, choose the iPhone, then build/run. Use the workspace so native dependencies are included. A configured local project can also be compiled with:

```sh
npx --yes cordova@13.0.0 build ios --debug
```

Signing remains the application's normal Xcode/Cordova setup. This guide does not promise that an unconfigured signing identity will build successfully. No native source/library patch or Supereo plugin-add step should be needed after a working declaration restores.

**Verified restoration boundary:** a fresh genuine Cordova CLI 13/iOS 8.1.1 host initially lacked Haptics and restored this exact URL through ordinary `cordova prepare ios`. Only the matching native package was installed; no manual plugin-add, support plugin or project patch was used. JS namespace, Swift source, native feature, system frameworks and privacy resources were included. [Fresh evidence](evidence/ios-auto-prepare-1.0.3.json) states the provenance: **the config was built from the shipping declaration in an SDK host fixture, not an actual Construct export**. It did not run macOS/Xcode or a device. Fresh Construct 1.0.3 emission, actual Xcode compilation and physical output remain **NOT RUN** here.

## Local Android AAB

The [current official Cordova Android guide](https://cordova.apache.org/docs/en/latest/guide/platforms/android/) lists the reference Android 15 toolchain: JDK **17**, SDK/build tools **36 / 36.0.0**, Gradle **8.14.2** and supported Node. Minimum device API is **24**. Compile SDK 36 is required because the bridge references guarded API 36 envelope classes; runtime guards retain older supported-device fallbacks.

For a fresh Cordova source export where Android is not installed yet:

```sh
npx --yes cordova@13.0.0 platform add android@15.0.0
npx --yes cordova@13.0.0 prepare android
npx --yes cordova@13.0.0 plugin ls
npx --yes cordova@13.0.0 requirements android
npx --yes cordova@13.0.0 build android --debug
npx --yes cordova@13.0.0 build android --release -- --packageType=bundle
```

If Android is already installed, inspect its version instead of adding it twice. Keep the supported toolchain and the game's own plugins/configuration consistent. Configure the application's release signing for an uploadable AAB; unsigned reference artifacts prove packaging only. Supereo's only declared Android permission is normal **VIBRATE**, with no runtime permission dialog.

The unchanged bridge previously compiled and packaged APK/AABs in a real reference Cordova Android host. That check is separate from a fresh Construct export and physical-device behavior; see [NATIVE-CHECKS.md](NATIVE-CHECKS.md).

## Missing-bridge diagnostics and gameplay

With Native required enabled, a missing bridge reports **`native-bridge-missing`**, backend **`unavailable`** and false hardware capabilities. Read **LastError**, **LastResultJSON**, **Backend** and **FallbackInfo**. Update a stale project-bundled addon once, save/close/reopen, then inspect the fresh Cordova declaration and preparation logs. Refresh capabilities can retry a present bridge's handshake; it cannot install missing native code. Taptic Engine uses a different interface and does not supply `cordova.plugins.SupereoHaptics`.

Use **Play feedback** for Selection tick, Light/Medium/Strong/Soft/Crisp impact, Success, Warning and Error. Advanced users can register bounded custom JSON once, then play by name. **Stop feedback**, **Set haptics enabled** and **Set overall strength** support cancellation and player preferences. See [PATTERNS.md](PATTERNS.md), [CAPABILITIES.md](CAPABILITIES.md) and the independent [QuickChess examples](QUICKCHESS.md).

For browser preview only, set Native required **No** and Preview simulation **Yes**. The labeled visual timeline exercises no hardware. Restore Native required **Yes** before mobile export. No gameplay, analytics, backend or purchase changes are required to update this addon. Other addons remain responsible for their own matching native packages.

## Short iPhone check — NOT RUN here

Use the [isolated demo assembly](../demo/ASSEMBLY.md), which includes no ads or analytics addons. Set Native required **Yes**, export its Cordova project with Simple minification, prepare iOS and run from Xcode on a supported iPhone. Check the native bridge and hardware conditions, try all nine preset buttons, then Off/Light/Normal and strength zero. Test the four custom patterns separately and inspect approximation/error results. Start a pulse, background and resume: the old pulse must not replay, and the next button must work. Record physically felt output separately from an accepted dispatch. Editor assembly, Xcode compilation and this device procedure remain unverified here.

## Hosted Build Service is a separate option

The chosen local Cordova route has no Scirra allowlist restriction. If choosing the hosted Build Service instead, [official guidance](https://www.construct.net/en/make-games/manuals/addon-sdk/reference/specifying-dependencies) and [Scirra's npm requirement](https://github.com/Scirra/Construct-bugs/issues/6368#issuecomment-1369771034) require npm publication and package/version approval. The package's npm endpoint currently returns 404 and exact approval is unestablished. A public GitHub tarball does not satisfy those hosted-service gates. The [review-only approval draft](BUILD-SERVICE-APPROVAL-REQUEST.md) is optional information; no publication or request was made, and neither is needed for local builds.
