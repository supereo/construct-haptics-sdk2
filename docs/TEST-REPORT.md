# Supereo Haptics 1.0.3 — actual test report

Check date: **11 October 2026 UTC**. Addon ID **Supereo_Haptics**, metadata **1.0.3.0**, unchanged native bridge **1.0.0**. Requested editor: Construct 3 **r495.2 stable**, Worker Auto/Off and Simple minification.

The chosen workflow is **Construct Cordova project export → local Cordova prepare/build**, using the unchanged Supereo native bridge and automatic URL restoration. It needs **no Scirra approval or native npm publication**. The exact public package is available and checksum-verified; earlier genuine Cordova restoration passed with the provenance described below. Version 1.0.3 addresses startup/lifecycle handling. Fresh actual Construct 1.0.3 emission, Xcode compilation and physical-device execution remain **NOT RUN**.

## Current package, SDK and host checks

| Check | Actual outcome | Scope / evidence |
| --- | --- | --- |
| Current official SDK dependency rules | READ | Official dependency manual fetched HTTP 200: automatic Cordova dependency metadata and hosted-service allowlist/security review. `plugin: this` is required when binding variables, not for this no-variable declaration. |
| Genuine SDK v2 unsolicited DOM status APIs | VERIFIED IN OFFICIAL SOURCES | Current [ISDKInstanceBase reference](https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/addon-sdk-interfaces/isdkinstancebase#internalH1Link0) explicitly documents `_addDOMMessageHandler(handler, callback)`. Official Scirra [Greenworks DOM handler](https://github.com/Scirra/Construct-Plugin-Greenworks/blob/04f8d7628481fa22b72adb96ea0536a93e15b698/construct-plugin/c3runtime/domSide.js#L41) calls `PostToRuntime(name, data)` and its SDK v2 instance listens through the documented plural helper. This verifies API use, not an editor execution. |
| Native npm publication | **NOT REQUIRED for local builds** | `https://registry.npmjs.org/cordova-plugin-supereo-haptics` returned HTTP **404** on this check. Official Scirra staff requires publication for the separate hosted Build Service; local URL restoration has no such prerequisite. |
| Hosted native package/version approval | **NOT ESTABLISHED; not required locally** | Current official published list (last updated 7 July 2026) omits Supereo; public issue searches located no approval. The list can lag the service, so this is not proof of a rejection or a complete current internal inventory. |
| Pinned public native tarball availability/integrity | **PASS** | HTTPS HTTP 200, normal TLS verification; SHA-256 `e2662681fc0b2434a1af13beafd28739b9b68d078a05acc75fcb23201593e25d`. All nine package files match current native 1.0.0 source. |
| Hosted-service acceptance of the current HTTPS version spec | **NOT ESTABLISHED; separate workflow** | The SDK documents a version spec; ordinary Cordova URL restoration passed historically. Neither establishes direct hosted acceptance, particularly with the npm prerequisite unmet. |
| Fresh 1.0.3 schemas, identity and source consistency | **PASS** | All three official addon/ACE/language schemas, versions, declared files and shared-core copies checked by shipping `npm run verify`. |
| Complete source JavaScript suite | **181 passed; 0 failed/skipped** | Real source loaded in controlled SDK/native fixtures. Includes 28 new startup/lifecycle tests, 14 scenarios in Worker/main-thread modes. [Captured verify output](evidence/javascript-tests-1.0.3.log). **Not editor/device tests.** |
| Actual extracted minified 1.0.3 addon | **14 passed; 0 failed/skipped** | Registered helper graph, shipping runtime/DOM and native message contracts, missing bridge, queued freshness and four startup/lifecycle regressions. Public property names preserved. Same captured output. **Not Construct's own minifier or native hardware.** |
| Generic browser demo | **PASS — simulation only** | All nine presets, four patterns, enable/strength, cancellation, overlap, invalid JSON and responsive layout. [Browser output](evidence/browser-demo-1.0.3.log). No Construct editor or physical haptics. |
| Event-sheet/property/native compatibility | **PASS** | ACE declarations, action/condition/expression scripts, editor registration/property ordering and native source/manifest bytes match published 1.0.2/source snapshot. Only internal runtime/DOM lifecycle handling changes; native protocol unchanged. [Comparison](evidence/release-contract-1.0.3.json). |
| Fresh normal `cordova prepare ios` URL restoration | **PASS — project inclusion only** | Genuine CLI 13/iOS 8.1.1 platform initially lacked Haptics; ordinary preparation restored only native package 1.0.0 from the shipping declaration. No manual plugin-add, support plugin or project patch. Namespace, native feature, Swift/framework/privacy phase membership and package integrity checked. **Config came from an SDK fixture, not actual Construct; no Xcode/device execution.** [Fresh result](evidence/ios-auto-prepare-1.0.3.json). |

**195 JavaScript tests passed in total**, with no failed, skipped or cancelled tests. These do not count as native/device tests. The fresh preparation result above reproduces the unchanged URL dependency through ordinary `cordova prepare ios`; it does not execute Construct's exporter. Older [automatic-restoration evidence](evidence/ios-auto-install-result.json) remains available with its original provenance.

The [selected hosted-service research](evidence/build-service-gate-1.0.3.json) records current public sources and retrieval results. Its npm/approval constraints concern that optional hosted route, not local Cordova acceptance. The [approval draft](BUILD-SERVICE-APPROVAL-REQUEST.md) is review-only; no publication, issue submission or external approval occurred.

## Not run / unresolved

| Requested check | Status | Reason / next step |
| --- | --- | --- |
| Fresh addon 1.0.3 installation and export in Construct r495.2 | **NOT RUN** | Actual navigation to `editor.construct.net/r495-2` failed with `net::ERR_TUNNEL_CONNECTION_FAILED`; [probe](evidence/editor-access-1.0.3.json). No editor/export executed. Install/update the project-bundled addon and save/close/reopen; host fixtures do not establish this check. |
| Actual Worker Auto and Off execution with Construct Simple export | **NOT RUN** | Host fixtures are separate. A prior supplied Simple-minified main-thread export was inspected statically; it is not a fresh 1.0.3 export in both settings. |
| Fresh Construct Cordova-source export and local Mac Xcode build | **NOT RUN** | The standard restoration route is supported by host evidence, but no fresh actual 1.0.3 editor emission or Mac/Xcode execution was performed. Normal Cordova preparation is distinct from earlier copied-export repairs. |
| Optional hosted Build Service native export | **BLOCKED / NOT RUN** | Its npm publication, exact security approval and compatible server toolchains remain unestablished; they are not needed for the chosen local workflow. |
| QuickChess editor event-sheet wiring/source update | **NOT RUN** | The game's Construct source/editor is unavailable. No gameplay, analytics, backend or purchase event-sheet changes were made. |
| Agent-side Xcode/Apple SDK compile/link | **NOT RUN** | This Linux environment has no Xcode, Apple SDK or `xcodebuild`. Earlier project-generation/syntax checks are not native compilation. |
| Supported physical iPhone / UIKit and Core Haptics | **NOT RUN** | No iPhone attached. |
| Advanced Android, older/basic Android and unsupported hardware | **NOT RUN** | No physical devices attached. Earlier SDK compilation does not establish motor behavior. |
| Device lifecycle, engine interruptions, rapid repeats/overlap/cancel and strength/disable | **NOT RUN** | Host control-flow fixtures do not exercise real OS/hardware behavior. |

## Preserved historical evidence

The unchanged bridge previously compiled in an isolated Android Cordova host with SDK 36, JDK 17 and Cordova Android 15; APK/AAB packaging and 26 pure-Java algorithm assertions passed. iOS project generation, namespace/framework/privacy inclusion and Swift syntax checks passed without Apple compilation. These remain evidence for native bridge 1.0.0, not direct Build Service acceptance.

The [preserved 1.0.2 report](TEST-REPORT-1.0.2.md) records **153 source + 10 extracted-addon JavaScript tests**, prior export inspection, the user-reported GameAnalytics linker failure and copied-project repairs. Its [release checksum record](evidence/release-1.0.2-SHA256SUMS) is retained. Those historical repairs are not the normal local Cordova export/build workflow. The original missing-runtime-import defect was fixed in 1.0.1; 1.0.2 explicitly registered its runtime helper. A prior bundled 1.0.1 export lacked the later native declaration, so its missing bridge does not prove service rejection of the newer declaration.

No simulated test is classified as a native/device test. Acceptance remains local dispatch acceptance, not physical completion, and no identical sensations across devices are promised.

## Device cases to record on the local builds

1. All nine presets and four custom patterns on an advanced Android phone, a basic API 24+ phone and a supported iPhone; record capabilities, approximations and observed output separately.
2. Off/Light/Normal, strength zero, changing strength during a pattern and disabled haptics.
3. Rapid identical/distinct cues, duplicate protection 0, Replace/Ignore, cancellation and queued request freshness.
4. Background/resume, OS interruptions and Core Haptics resets; no stale replay.
5. Unsupported hardware/effects/primitives/envelopes and missing native bridge with Native required enabled.
6. Real Construct Worker Auto/Off and Simple-minified builds; do not infer these checks from mocked transports.

Use [INSTALLATION.md](INSTALLATION.md), [CAPABILITIES.md](CAPABILITIES.md), [PATTERNS.md](PATTERNS.md) and the [generic demo assembly](../demo/ASSEMBLY.md).
