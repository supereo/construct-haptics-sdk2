# Diagnose the exported app at the right layer

The chosen route is **Construct Cordova source export → ordinary local Cordova prepare/build** with the existing Supereo native bridge. Local builds need no Scirra approval. However, the current declared native URL is hosted in a private GitHub repository and the user's Mac receives npm E404. Construct did emit the declaration; package distribution must be fixed before ordinary preparation can restore it. See [INSTALLATION.md](INSTALLATION.md) for the standard commands. No copied-export repair kit or per-export plugin-add/config patch is required.

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

For this release confirm addon metadata **1.0.3.0**, then save, close and reopen the source project and export again. These are Construct's [official bundled-addon update steps](https://www.construct.net/en/make-games/manuals/construct-3/tips-and-guides/installing-third-party-addons#bundling-addons-to-projects). An already generated Xcode export does not change when the editor addon is updated.

## Native registration

For Supereo Haptics, the Cordova JavaScript loader must include the bridge module with `cordova.plugins.SupereoHaptics`. Native iOS configuration must register feature/class `SupereoHaptics`, and the Xcode project must include the Swift source, UIKit/CoreHaptics frameworks and privacy resource. Inspect those layers together; a JavaScript addon object alone is insufficient.

The latest supplied Build Service export had valid Simple-minified main-thread JavaScript but omitted both the Haptics bridge and the game's separate SupereoGameAnalytics bridge. Taptic Engine 2.2.0 was present, but its API is different. Installing an unrelated plugin with a similar purpose cannot supply either matching Supereo service.

Addon 1.0.3 retains the automatic Haptics dependency introduced in 1.0.2. On a fresh Cordova-source export, inspect the expected declaration and normal `prepare`/`plugin ls` output; do not manually paste it into each export. If it is absent, verify the one-time bundled-addon update and re-export. Other addons, including SupereoGameAnalytics, own their separate native dependencies. Hosted Build Service approval is relevant only if choosing that separate build system.

## Historical GameAnalytics native link diagnosis

The user's first repaired-project build reached Xcode's native linker and failed with undefined `std::__1::chrono::steady_clock::now()`, `std::terminate()`, `__cxa_begin_catch` and `__gxx_personality_v0` symbols. These C++ runtime references from the GameAnalytics SDK require **`libc++.tbd`**. Its matching bridge package 1.0.0-rc.1 did not declare that system link dependency. The earlier source/framework-registration checks were static checks and did not establish a successful native link.

In the **App target**, open **Build Phases → Link Binary With Libraries → +**, search for `libc++.tbd`, select it and click **Add**. Clean the build folder and build again. `libc++.tbd` is an SDK link stub; iOS provides the runtime library. The addon and native bridge versions need no change for this project-level correction.

The user-reported native link is **FAIL**. Agent-side Xcode compilation remains **NOT RUN** because this host has no Xcode/Apple SDK. A correct project-file link reference, a successful Xcode link, haptic output and analytics dashboard delivery are separate results.

The revised prepared project and repair kit **1.0.1** include the dependency automatically. The SDKROOT `usr/lib/libc++.tbd` file reference and strong frameworks-phase link were verified statically; there is no resource or embed-phase membership. Gameplay assets and existing bridge/SDK bytes are unchanged. See the [sanitized link summary](evidence/libcxx-link-summary.json). The corrected Xcode build/link remains **NOT RUN** until rebuilt on macOS.

## Historical prepared repairs and current remaining checks

The prepared Xcode copies and repair kit described in the earlier report belong to a historical handover. They do not replace the current fresh Cordova-source export and ordinary local preparation workflow.

The fresh normal Haptics restoration check installed only native bridge 1.0.0, with no support plugin or project patch. [Evidence](evidence/ios-auto-prepare-1.0.3.json) is explicit: its config originated in an SDK fixture, not an actual Construct export. Fresh editor emission and Xcode/device execution remain NOT RUN.

Keep project-file checks distinct from an Xcode compile, actual iPhone startup, haptic hardware output and analytics dashboard delivery. Static inspection proves only the inspected registrations and file references. The repair changes native integration, not the game's gameplay or analytics event-sheet logic. No private game files, configuration values or analytics keys are included in this SDK's public evidence.

See [INSTALLATION.md](INSTALLATION.md) for exact source-update/export instructions and [TEST-REPORT.md](TEST-REPORT.md) for actual inspection, repair verification and unavailable checks.
