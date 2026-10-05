# Supereo Haptics 1.0.2 — actual test report

Release check date: **6 October 2026 (Europe/Paris)**. Original native compilation
and syntax checks: 5 October 2026. Source addon ID: `Supereo_Haptics`, Construct metadata
version `1.0.2.0`, unchanged native bridge version `1.0.0`. Requested editor: Construct 3
**r495.2 stable**, Worker Auto and Off, export minification Simple.

The release is packaged and schema-checked. JavaScript and available agent-side
native build checks passed. A later supplied Build Service iOS export was
inspected statically and a separate project copy received native installation.
The user's first Xcode link of that copy failed because its GameAnalytics SDK
linkage omitted `libc++.tbd`. The corrected dependency is statically verified;
the revised Xcode build/link has not run here.
**It is not device-validated. Agent-side editor installation/export execution,
Apple compilation and correct future Build Service native inclusion remain
unverified.**
No simulated test is classified as a native-device test.

## Reported import failure, bundled addon and correction

The user reported an actual Construct build failure resolving
`scripts/plugins/Supereo_Haptics/c3runtime/haptics-core.js` in addon 1.0.0.
The original archive reproduces that missing-module error under the restricted
esbuild-wasm file-map fixture. Earlier tests preloaded the helper and bypassed
import resolution, so their passing results missed this defect.

The user subsequently reported the same failure after installing 1.0.1 and an
iOS QuickChess splash-screen hang. The published 1.0.1 archive was inspected:
metadata `1.0.1.0`, SHA-256
`0d9b704879e14fb2d8f384c8a8aee830dc4bada589e712cffa5849d42df216e9`,
no helper file and no `haptics-core.js` import. It embeds the core in both runtime
plugin and DOM handler. The error therefore identifies code different from
that archive. A later supplied latest export was inspected and does not reproduce
the missing static-module defect. The original source project is unavailable;
the user reports project-bundled Haptics 1.0.1 while the editor has 1.0.2. Official
Construct documentation requires **Tools → View used addons → Update to editor
version** for bundled addons after updating the installed addon.

Addon 1.0.2 takes the documented additional-module route: `haptics-core.js` is
included in `file-list`, registered through `AddC3RuntimeScript`, and imported
first by `main.js`. The DOM validator stays embedded in `domSide.js`; that
runtime helper is never declared as a DOM script. Tests execute the real editor
registration, bundle its registered graph through esbuild-wasm 0.28.2, and load
only declared DOM scripts. They do not preload a validator or strip imports.
**Actual Construct editor export/retesting of 1.0.2 remains NOT RUN.**

The original Mac source folder remains unavailable in this cloud workspace.
An uploaded copy of the latest Xcode export is now available and was inspected.
The user identifies that archive as the latest build despite an older-looking
filename and reports working gameplay. No gameplay, analytics, backend or
purchase event sheets were edited. The latest diagnosis is missing native
bridges, distinct from the earlier missing import; static tests do not establish
physical haptics or analytics delivery.

## Actual supplied latest export inspection

The actual supplied Build Service Xcode export was inspected separately from the
synthetic export fixtures. Its runtime is Simple-minified and configured for
main-thread operation (`useWorker: false`). The JavaScript parses and the local
static-import audit passes across **15 JavaScript files**, with zero local
import references. This does not
execute the bundled game or test Worker Auto.

Both Supereo Haptics and the game's separate SupereoGameAnalytics native bridges
are missing from the original export's registration. Taptic Engine 2.2.0 is
present, but exposes a different service and cannot supply either Supereo
interface. The inspected output therefore does not establish native inclusion
through Build Service. A passing build or working gameplay can coexist with
these native omissions.

Native installation was performed through Cordova iOS 8.1.1's supported platform
API into a separate copy of the supplied standalone Xcode project. The original
export is preserved. Both matching bridges were included: Haptics **1.0.0** and
SupereoGameAnalytics **1.0.0-rc.1**. The repaired copy passes static import
inspection across **18 JavaScript files**, with both Supereo JavaScript/native
registrations and native source/resource membership checked.

All **112 protected gameplay web assets/settings** are byte-identical to the
original. Six existing native configuration/project/registry files changed;
there were no removals. The GameAnalytics **5.1.0** official SDK archive's
checksum matched its official `Package.swift`; 32 vendored files and 31 installed
framework files were verified against that archive. These checks do not
initialize the analytics SDK or send an event.

The selected [sanitized repair summary](evidence/latest-export-repair-summary.json)
records those results. Project-file checks and byte comparisons are distinct from
Xcode compilation, device startup/output and analytics dashboard delivery. Only
sanitized observations belong in this public SDK report; private game files,
configuration values and analytics keys are not included.

### User-reported Xcode native link failure

The user's actual Xcode build of the first prepared project failed at linking.
Reported undefined symbols include `std::__1::chrono::steady_clock::now()`,
`std::terminate()`, `__cxa_begin_catch` and `__gxx_personality_v0`. The
GameAnalytics SDK requires Apple's C++ runtime, `libc++.tbd`, which the matching
bridge package 1.0.0-rc.1 did not declare. The original static integration checks
therefore did not cover every required native link dependency.

The user-reported link result is **FAIL**, distinct from the passing file and
registration checks. [INSTALLATION.md](INSTALLATION.md) gives the manual App
target → Build Phases → Link Binary With Libraries → `libc++.tbd` correction.
The addon remains 1.0.2 and both bridge versions are unchanged. Agent-side Xcode
compilation remains **NOT RUN** on this Linux host; a project-file correction
does not establish a successful native link or device/backend output.

The official GameAnalytics 5.1.0 device arm64 archive's symbol table confirms
all four reported unresolved C++ symbols. The revised project and separate
repair kit 1.0.1 add `libc++.tbd` through a framework-only Cordova declaration.
Static checks confirm exactly one SDKROOT `usr/lib/libc++.tbd` reference and
one strong frameworks-phase link, without resource or embed membership.
The original export, 112 protected gameplay assets/settings, native bridges,
privacy resources and SDK bytes are unchanged. This is a **PASS for static
dependency registration**, with the corrected Xcode build/link still **NOT RUN**.
See the [sanitized link-dependency summary](evidence/libcxx-link-summary.json).

## Executed checks

| Check | Actual outcome | Scope / evidence |
| --- | --- | --- |
| Official Construct addon manifest, ACE and language schemas | PASS, all three | Unmodified Scirra SDK JSON schemas; identity, SDK version, file list and shared-source consistency also checked. |
| Portable pattern validator | PASS, 67 tests | Malformed/oversized JSON, schema/version, bounds, sparse arrays, nonfinite values, normalized curves, preset identities, pure browser/worker loading. |
| Shipping Cordova JavaScript adapter | PASS, 32 tests | Real JS with mocked `cordova/exec`: service names, normalized requests, state, structured errors, 5-second watchdog, late callbacks and cancellation. No native/device execution. |
| Construct script registration and module resolution | PASS, 7 tests | Real editor registration, additional-runtime registration, pinned Cordova dependency declaration and restricted esbuild-wasm runtime file map; original-style unregistered imports fail, while the corrected source bundle initializes the validator in Worker/main-thread contexts. |
| Construct runtime/DOM behavior | PASS, 33 tests | Shipping classes loaded with documented SDK-v2 host fixtures; main/worker transports, all presets, capabilities, explicit simulator/native-required, overlaps/duplicates, settings ordering, queue bounds/freshness, lifecycle/release races. |
| Complete JavaScript message chain | PASS, 2 tests | Runtime → DOM → shipping Cordova JS → strict mocked native transport in both modes, checking exact native request fields and packaged core module. |
| Cordova present, Taptic Engine present, Supereo bridge absent | PASS, 4 source tests | Both runtime modes, `deviceready` and bounded timeout, absent/empty plugin namespace: load promise settles, structured missing-bridge error, no unhandled rejection, all presets/patterns reject gracefully, settings/Stop remain usable. No foreign Taptic Engine or browser vibration calls. |
| Read-only exported-files audit | PASS, 8 tests | Filesystem fixtures shaped as main-thread/worker exports, shipping module graph, original missing-file reproduction, imports/re-exports, syntax errors, URL paths, separate native registration and CLI exit code. **These fixtures are not actual Construct exports.** |
| Actual supplied latest Build Service iOS export: JavaScript/static imports | PASS | **15 actual JavaScript files** parsed; Simple-minified main-thread output, `useWorker: false`; zero local import references and no missing local static imports. No game execution or Worker Auto check. |
| Actual supplied latest export: native bridge diagnosis | Confirmed missing | Original output lacks both Supereo Haptics and SupereoGameAnalytics registrations; Taptic Engine 2.2.0 remains present and provides a different interface. This is actual export inspection, not a simulated fixture. |
| Actual supplied-export copy: matching native bridges installed | PASS | Supported Cordova iOS 8.1.1 platform API installed Haptics **1.0.0** and matching SupereoGameAnalytics **1.0.0-rc.1**. Native/JS services, exact source/resources, compile/resource/framework phase membership and registration inspected. **No Xcode compile or device execution.** [Sanitized summary](evidence/latest-export-repair-summary.json). |
| Actual repaired-copy static imports and game-file preservation | PASS | **18 actual JavaScript files**, zero local import references, registrations present; original export unmodified; **112 protected web assets/settings unchanged byte for byte**, six integration metadata files changed and zero removals. |
| Matching GameAnalytics native SDK artifact inclusion | PASS | Official SDK **5.1.0** archive checksum matched official `Package.swift`; 32 vendored files and 31 installed framework files checked against the archive. Artifact/source inclusion checks only; no native initialization, live events or dashboard result. |
| User's first prepared-project Xcode native link | **FAIL — user reported** | Undefined C++ runtime symbols from the GameAnalytics SDK; required `libc++.tbd` was missing from the app's link declarations. Earlier static inclusion checks did not establish complete link dependencies. Agent-side Xcode compilation remains unavailable. |
| GameAnalytics C++ dependency diagnosis and revised project registration | **PASS — static only** | Official device arm64 archive contains all four reported undefined C++ symbols. Revised project has exactly one SDKROOT `usr/lib/libc++.tbd` reference and strong frameworks-phase link, without resource/embed membership; gameplay and existing bridge/SDK bytes unchanged. **Corrected Xcode link NOT RUN.** [Sanitized evidence](evidence/libcxx-link-summary.json). |
| Follow-up packaged-addon/export-auditor regression subset | PASS, **18 tests** | Re-ran `tests/compiled-addon.cjs` and `tests/export-audit.test.cjs` during the supplied-export repair. Minified Worker/main-thread fixtures, graceful missing-bridge behavior and removed-helper detection passed. A repeat of a subset, not 18 additional unique tests or an editor/device test. |
| Repaired-export Cordova JavaScript loader/runtime host fixtures | PASS, **8 cases** | Loader/module registration and Worker/main-thread contract fixtures passed with mocked native calls. **No native haptic or analytics SDK initialization, device execution or live delivery.** |
| **Source suite total** | **153 passed; 0 failed/skipped** | [Captured output](evidence/javascript-tests.log). Fixtures do not run the Construct editor or physical hardware. |
| Actual minified `.c3addon` | **10 passed; 0 failed/skipped** | Extracted real archive, registered helper/file graph, preserved complete Cordova dependency payload, Worker/main-thread messaging, absent-bridge startup, native contracts and stale requests. Public property names preserved. Same log above. |
| Event-sheet interfaces/properties and native protocol | PASS | Compared with published 1.0.1: ACE declarations, action/condition/expression scripts, instance behavior, initial properties, DOM template and native package sources unchanged. [Comparison](evidence/release-contract-result.json). |
| Generic browser demonstration | PASS | Chromium 151.0.7922.173 / Playwright 1.62.1: all nine presets, four patterns, enable/strength, overlap/cancel, invalid JSON, desktop/mobile overflow; no browser JS errors. [Output](evidence/browser-demo.log). **Visual simulation only.** |
| Generic Cordova demo asset assembly | PASS | Existing assets protected; `cordova.js` precedes demo scripts and all local files copied. iOS host prepared with these assets; no demo execution on a device. |
| Actual Android Cordova bridge install and compile | PASS | Cordova CLI 13 / Android 15 / API 36 / JDK 17; debug/release Java compilation using genuine framework classes. [Native report](NATIVE-CHECKS.md). |
| Android APK and AAB packaging | PASS | Debug APK, debug AAB and unsigned release AAB. Debug signature checked; source identity recorded. These are generated reference-host artifacts, not Construct game exports. |
| Android lint | PASS with warnings | **0 native errors**, 13 warnings: five annotation-style suggestions, eight generated Cordova template/manifest warnings. Actual report parsed, not just Gradle's exit status. |
| Actual native Java validation/waveform algorithms | PASS, **26 assertions** | Executed from compiled Java class on host JVM with checksum-verified JSON library. No vibrator or Android device APIs exercised. |
| Cordova iOS installation/project generation | PASS | Actual iOS 8.1.1 host: Swift source, privacy bundle, native/JS registration, Swift 5 default and UIKit/Core Haptics build-phase membership checked. [Evidence](evidence/ios-project-result.json). **No Apple compilation.** |
| Automatic Cordova native dependency restoration | PASS | Fresh actual Cordova CLI 13 / iOS 8.1.1 project restored the pinned public bridge from a `config.xml` plugin declaration without any manual plugin-add command. JS/native feature, Swift source, frameworks and privacy resource included. [Evidence](evidence/ios-auto-install-result.json). **The config was assembled from the addon declaration; no Construct export or Apple compilation.** |
| Swift syntax and privacy manifest | PASS | Pinned tree-sitter-language-pack 0.13.0 / tree-sitter 0.26.0, zero grammar/missing-node errors; XML plist/no-data declaration checked. [Evidence](evidence/ios-syntax-result.json). **Not typechecking.** |
| Release archive integrity | PASS | ZIP integrity and SHA-256 checks for addon/native/source; final release hashes in `dist/SHA256SUMS`. |
| Fresh source ZIP reproduction | PASS | Extracted into an empty isolated directory, `npm ci --ignore-scripts` from the lockfile and `npm run verify` passed; all four archive outputs were byte-identical. [Rebuild output](evidence/source-rebuild.log). |

The pure Java assertion count is separate from the **163 JavaScript tests**.
There are no disabled assertions, expected failures or zero-test “passes”.
Native build tools retained TLS/signature/checksum verification; exact versions,
artifact/source hashes, warnings and command logs are in NATIVE-CHECKS.md.
The original native compilation, syntax and manual-install project checks remain
evidence for unchanged bridge 1.0.0. Automatic iOS dependency restoration was
checked separately for this release; Xcode compilation was not available.

## Not run / unresolved

| Requested check | Status | Reason / next step |
| --- | --- | --- |
| Install/open corrected addon 1.0.2 in Construct r495.2 | **NOT RUN** | Actual Chromium navigation failed before the editor loaded: proxy CONNECT 403 / `ERR_TUNNEL_CONNECTION_FAILED`. [Probe](evidence/editor-access-result.json). Install 1.0.2, update the project-bundled copy, save/reload and follow demo/ASSEMBLY.md. |
| Real Worker Auto and Worker Off preview/export execution | **NOT RUN** | The supplied export has main-thread `useWorker: false` configuration; host fixtures exercise both messaging modes. Actual editor/runtime execution in both settings remains untested. |
| Fresh agent-generated Construct Simple export/minification | **NOT RUN** | The supplied Simple-minified app was inspected statically and parses. Packaged scripts are also minified/tested with Terser without property mangling; a fresh addon 1.0.2 export from the actual Construct editor remains unavailable. |
| Construct-generated Android AAB / iOS app end to end | **NOT RUN** | A supplied Build Service iOS project was inspected and a separate copy repaired. No agent-side Construct export, Xcode compilation, signed app or physical-device execution occurred. |
| Actual QuickChess source bundled-addon update and re-export | **NOT RUN** | The original Construct source/editor remains unavailable. The user reports bundled Haptics 1.0.1 versus editor 1.0.2; use Tools → View used addons → Update to editor version, save/reload and export again. |
| Construct export of the pinned HTTPS Cordova version spec | **NOT RUN** | Documented `AddCordovaPluginReference` declares a version spec and config.xml inclusion; URL restoration passed in Cordova. Actual Construct URL-spec pass-through still needs an exported config.xml. |
| Agent-side Xcode/Apple SDK Swift typechecking and compilation | **NOT RUN** | Linux host lacks macOS, Xcode, Apple SDK and `xcodebuild`. Project-file and syntax checks do not replace compilation. |
| Revised supplied-project Xcode rebuild/link after libc++ correction | **NOT RUN** | User's preceding link failed; the missing SDK link declaration is now statically verified. This host cannot run Xcode, so corrected native link success remains unestablished. |
| Supplied/repaired game: native GameAnalytics startup and dashboard delivery | **NOT RUN** | Missing registration was diagnosed and native integration can be inspected statically; no iPhone execution, live analytics delivery or dashboard validation occurred. |
| Supported physical iPhone / UIKit/Core Haptics | **NOT RUN** | No iPhone attached. Simulator output would not establish haptic behavior either. |
| Advanced physical Android device | **NOT RUN** | No physical device/emulator attached. Verify primitives, amplitude and API 36 envelope hardware queries on appropriate devices. |
| Older/basic Android and unsupported hardware | **NOT RUN** | No such device attached. Validate settings, waveform/on-off fallbacks and truthful unsupported output. |
| Device interruptions, background/resume, overlap/rapid repeats/cancel, strength and disable | **NOT RUN** | JS/algorithm fixtures cover corresponding control logic; actual OS/hardware lifecycle behavior remains untested. |
| Construct Build Service custom-native inclusion | **NOT APPROVED / UNVERIFIED** | The actual supplied service export lacked both Supereo bridges. This Haptics dependency has not been submitted/approved; matching GameAnalytics inclusion is also unestablished. Service allowlisting and export/native validation remain required. Automatic metadata inclusion does not bypass approval. |
| Official documentation research | **PARTIAL** | Current Construct Runtime scripts and IPluginInfo pages were successfully read during the fix. Initial Android/Apple website fetches were blocked; official Apache/AOSP sources and identified Apple-header mirrors were read. See RESEARCH.md for exact sources and boundaries. |

These limitations prevent a production-ready or real-device-verified claim.
The external route is backed by actual Cordova automatic restoration/project
inclusion and earlier Android build evidence. No identical sensations or
physical completion callbacks are promised. The native package is hosted at an
immutable public GitHub URL, is not published to npm, and has not been submitted
for Build Service approval. Package fetching happens during builds, not gameplay.

## Physical-device checklist to record before shipping

Run each case on an advanced Android phone, a basic API 24+ Android phone, a
supported iPhone and unsupported hardware where available. Record OS/model,
reported capabilities, local dispatch results and observed output separately.

1. All nine presets at strength `1` and `0.35`; note fixed semantic feedback and approximations.
2. Four custom patterns; compare native timing and supported intensity/sharpness changes without assuming cross-platform equivalence.
3. Enabled off and strength zero suppress output and cancel a scheduled pattern.
4. Rapid identical requests, distinct rapid cues, duplicate protection `0`, Replace/Ignore, queue stalls and Stop halfway through `soft-pulse`.
5. Change strength mid-pattern; confirm old scheduled work is dropped and next feedback uses the new setting.
6. Background/resume while playing and while requests are queued; interruptions/Core Haptics engine reset; no stale replay.
7. Unsupported effect/primitive/envelope/hardware support; inspect every fallback and ensure no unsupported API crash.
8. Native required on with a deliberately missing bridge; explicit error, no mock success.
9. Export from actual Construct r495.2 with Worker Auto and Off and Simple minification; repeat the core cases on the installed builds.

Use the [generic event-sheet assembly](../demo/ASSEMBLY.md), [installation guide](INSTALLATION.md),
[patterns](PATTERNS.md) and [capability matrix](CAPABILITIES.md). A timeline is a
scheduled-work illustration; local acceptance is not evidence that a motor moved.
