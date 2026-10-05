# Diagnose the exported app at the right layer

A Construct addon, its exported JavaScript and its native Cordova package are separate parts. Successful gameplay can coexist with missing native haptics or analytics. A generated Xcode workspace can also contain the correct files without having passed compilation or physical-device checks.

## Runtime scripts

Run the read-only audit from the Supereo source directory:

```sh
npm run audit:export -- '/absolute/path/to/export/'
```

The auditor parses the export's JavaScript and resolves local static import/re-export paths. A missing module is a loading error. A passing audit with zero local imports means that no such references were present; it is not an execution test or proof that every bundled runtime behavior is correct. Dynamic and external imports, actual editor execution and hardware remain separate checks.

Addon 1.0.0 had an unregistered runtime helper. Published addon 1.0.1 embedded its runtime core and has no helper import. Addon 1.0.2 explicitly registers its runtime-only helper with `AddC3RuntimeScript` and imports it first. Its DOM core remains independently embedded. Keep the complete exported graph rather than patching one generated runtime file.

## Project-bundled addons

An installed editor addon and a project-bundled addon can have different versions. After installing the intended release and reloading Construct, open the source project and use:

**Project Bar → right-click project → Tools → View used addons → right-click the bold bundled addon → Update to editor version.**

Save and reopen the source project, verify the bundled version, then export again. These are Construct's [official bundled-addon update steps](https://www.construct.net/en/make-games/manuals/construct-3/tips-and-guides/installing-third-party-addons#bundling-addons-to-projects). An already generated Xcode export does not change when the editor addon is updated.

## Native registration

For Supereo Haptics, the Cordova JavaScript loader must include the bridge module with `cordova.plugins.SupereoHaptics`. Native iOS configuration must register feature/class `SupereoHaptics`, and the Xcode project must include the Swift source, UIKit/CoreHaptics frameworks and privacy resource. Inspect those layers together; a JavaScript addon object alone is insufficient.

The latest supplied Build Service export had valid Simple-minified main-thread JavaScript but omitted both the Haptics bridge and the game's separate SupereoGameAnalytics bridge. Taptic Engine 2.2.0 was present, but its API is different. Installing an unrelated plugin with a similar purpose cannot supply either matching Supereo service.

Addon 1.0.2 declares the Haptics dependency automatically for external Cordova restoration. Build Service still requires approval of custom native packages. If a game also uses SupereoGameAnalytics, its matching native package must be included independently. Use an external Cordova build with both dependencies, or supported postprocessing of a copied Xcode export. Do not promise that another Build Service export will include them without approval and file-level verification.

## Native link dependencies

The user's first repaired-project build reached Xcode's native linker and failed with undefined `std::__1::chrono::steady_clock::now()`, `std::terminate()`, `__cxa_begin_catch` and `__gxx_personality_v0` symbols. These C++ runtime references from the GameAnalytics SDK require **`libc++.tbd`**. Its matching bridge package 1.0.0-rc.1 did not declare that system link dependency. The earlier source/framework-registration checks were static checks and did not establish a successful native link.

In the **App target**, open **Build Phases → Link Binary With Libraries → +**, search for `libc++.tbd`, select it and click **Add**. Clean the build folder and build again. `libc++.tbd` is an SDK link stub; iOS provides the runtime library. The addon and native bridge versions need no change for this project-level correction.

The user-reported native link is **FAIL**. Agent-side Xcode compilation remains **NOT RUN** because this host has no Xcode/Apple SDK. A correct project-file link reference, a successful Xcode link, haptic output and analytics dashboard delivery are separate results.

The revised prepared project and repair kit **1.0.1** include the dependency automatically. The SDKROOT `usr/lib/libc++.tbd` file reference and strong frameworks-phase link were verified statically; there is no resource or embed-phase membership. Gameplay assets and existing bridge/SDK bytes are unchanged. See the [sanitized link summary](evidence/libcxx-link-summary.json). The corrected Xcode build/link remains **NOT RUN** until rebuilt on macOS.

## Prepared repair and remaining checks

For the matching prepared repaired Xcode ZIP, extract it into a fresh folder, open `App.xcworkspace`, set signing, choose the device, clean the build folder and run. The native installation has already been performed in that artifact; routine Cordova installation/preparation commands are unnecessary and may regenerate its platform files.

For future standalone exports, follow the separately supplied repair kit's README. It performs local installation of both matching native packages using pinned Cordova iOS 8.1.1 into a new output copy. This handover artifact is separate from the SDK source release and does not change Build Service approval or replace Xcode/device/backend checks.

Keep project-file checks distinct from an Xcode compile, actual iPhone startup, haptic hardware output and analytics dashboard delivery. Static inspection proves only the inspected registrations and file references. The repair changes native integration, not the game's gameplay or analytics event-sheet logic. No private game files, configuration values or analytics keys are included in this SDK's public evidence.

See [INSTALLATION.md](INSTALLATION.md) for exact source-update/export instructions and [TEST-REPORT.md](TEST-REPORT.md) for actual inspection, repair verification and unavailable checks.
