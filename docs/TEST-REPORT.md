# Supereo Haptics 1.0.1 — actual test report

Run date: **5 October 2026**. Source addon ID: `Supereo_Haptics`, Construct metadata
version `1.0.1.0`, unchanged native bridge version `1.0.0`. Requested editor: Construct 3
**r495.2 stable**, Worker Auto and Off, export minification Simple.

The release is packaged and schema-checked. JavaScript and available native
build checks passed. **It is not device-validated, and editor installation,
actual Construct exports, Apple compilation and Build Service are not verified.**
No simulated test is classified as a native-device test.

## Reported 1.0.0 failure and correction

The user reported an actual Construct build failure resolving
`scripts/plugins/Supereo_Haptics/c3runtime/haptics-core.js` in addon 1.0.0.
The original archive reproduces that missing-module error under the restricted
esbuild-wasm file-map fixture. Earlier tests preloaded the helper and bypassed
import resolution, so their passing results missed this defect.

Addon 1.0.1 embeds the validator in the registered runtime plugin and DOM handler
instead of importing an unregistered helper. Tests now execute the real editor
registration, bundle the registered entry through esbuild-wasm 0.28.2, and load
only declared DOM scripts. They do not preload a separate validator. The
corrected minified archive passes these checks in both messaging modes.
**Actual Construct editor retesting of 1.0.1 remains NOT RUN.**

## Executed checks

| Check | Actual outcome | Scope / evidence |
| --- | --- | --- |
| Official Construct addon manifest, ACE and language schemas | PASS, all three | Unmodified Scirra SDK JSON schemas; identity, SDK version, file list and shared-source consistency also checked. |
| Portable pattern validator | PASS, 67 tests | Malformed/oversized JSON, schema/version, bounds, sparse arrays, nonfinite values, normalized curves, preset identities, pure browser/worker loading. |
| Shipping Cordova JavaScript adapter | PASS, 32 tests | Real JS with mocked `cordova/exec`: service names, normalized requests, state, structured errors, 5-second watchdog, late callbacks and cancellation. No native/device execution. |
| Construct script registration and module resolution | PASS, 5 tests | Real editor registration and restricted esbuild-wasm runtime file map; original-style unregistered imports fail, while the corrected source bundle initializes the validator in Worker/main-thread contexts. |
| Construct runtime/DOM behavior | PASS, 33 tests | Shipping classes loaded with documented SDK-v2 host fixtures; main/worker transports, all presets, capabilities, explicit simulator/native-required, overlaps/duplicates, settings ordering, queue bounds/freshness, lifecycle/release races. |
| Complete JavaScript message chain | PASS, 2 tests | Runtime → DOM → shipping Cordova JS → strict mocked native transport in both modes, checking exact native request fields and packaged core module. |
| **Source suite total** | **139 passed; 0 failed/skipped** | [Captured output](evidence/javascript-tests.log). Fixtures do not run the Construct editor or physical hardware. |
| Actual minified `.c3addon` | **8 passed; 0 failed/skipped** | Extracted real archive, declared files/checksum, registered entry resolution through esbuild-wasm, Worker and main-thread simulator/native contracts, state ordering and stale-request suppression. Public property names preserved. Same log above. |
| Generic browser demonstration | PASS | Chromium 151.0.7922.173 / Playwright 1.62.1: all nine presets, four patterns, enable/strength, overlap/cancel, invalid JSON, desktop/mobile overflow; no browser JS errors. [Output](evidence/browser-demo.log). **Visual simulation only.** |
| Generic Cordova demo asset assembly | PASS | Existing assets protected; `cordova.js` precedes demo scripts and all local files copied. iOS host prepared with these assets; no demo execution on a device. |
| Actual Android Cordova bridge install and compile | PASS | Cordova CLI 13 / Android 15 / API 36 / JDK 17; debug/release Java compilation using genuine framework classes. [Native report](NATIVE-CHECKS.md). |
| Android APK and AAB packaging | PASS | Debug APK, debug AAB and unsigned release AAB. Debug signature checked; source identity recorded. These are generated reference-host artifacts, not Construct game exports. |
| Android lint | PASS with warnings | **0 native errors**, 13 warnings: five annotation-style suggestions, eight generated Cordova template/manifest warnings. Actual report parsed, not just Gradle's exit status. |
| Actual native Java validation/waveform algorithms | PASS, **26 assertions** | Executed from compiled Java class on host JVM with checksum-verified JSON library. No vibrator or Android device APIs exercised. |
| Cordova iOS installation/project generation | PASS | Actual iOS 8.1.1 host: Swift source, privacy bundle, native/JS registration, Swift 5 default and UIKit/Core Haptics build-phase membership checked. [Evidence](evidence/ios-project-result.json). **No Apple compilation.** |
| Swift syntax and privacy manifest | PASS | Pinned tree-sitter-language-pack 0.13.0 / tree-sitter 0.26.0, zero grammar/missing-node errors; XML plist/no-data declaration checked. [Evidence](evidence/ios-syntax-result.json). **Not typechecking.** |
| Release archive integrity | PASS | ZIP integrity and SHA-256 checks for addon/native/source; final release hashes in `dist/SHA256SUMS`. |
| Fresh source ZIP reproduction | PASS | Extracted into an empty isolated directory, `npm ci --ignore-scripts` from the lockfile and `npm run verify` passed; all four archive outputs were byte-identical. [Rebuild output](evidence/source-rebuild.log). |

The pure Java assertion count is separate from the **147 JavaScript tests**.
There are no disabled assertions, expected failures or zero-test “passes”.
Native build tools retained TLS/signature/checksum verification; exact versions,
artifact/source hashes, warnings and command logs are in NATIVE-CHECKS.md.
The native compilation, syntax and project checks remain evidence for the
unchanged bridge 1.0.0; they were not rerun for this addon-only loading correction.

## Not run / unresolved

| Requested check | Status | Reason / next step |
| --- | --- | --- |
| Install/open corrected addon 1.0.1 in Construct r495.2 | **NOT RUN** | No authenticated editor session or editor automation is available. The user reported a loader failure with 1.0.0; install 1.0.1, reload Construct and follow demo/ASSEMBLY.md to retest. |
| Real Worker Auto and Worker Off preview/export | **NOT RUN** | Host fixtures exercise the documented messaging design, but the actual editor/runtime environment must still be tested. |
| Construct Simple export minifier | **NOT RUN** | Actual packaged scripts are minified and tested with Terser without property mangling; Construct's own exporter was unavailable. |
| Construct-generated Android AAB / iOS project end to end | **NOT RUN** | External standard Cordova hosts were checked. No Construct-generated project was supplied or exported here. |
| Xcode/Apple SDK Swift typechecking and compilation | **NOT RUN** | Linux host lacks macOS, Xcode, Apple SDK and `xcodebuild`. Project-file and syntax checks do not replace compilation. |
| Supported physical iPhone / UIKit/Core Haptics | **NOT RUN** | No iPhone attached. Simulator output would not establish haptic behavior either. |
| Advanced physical Android device | **NOT RUN** | No physical device/emulator attached. Verify primitives, amplitude and API 36 envelope hardware queries on appropriate devices. |
| Older/basic Android and unsupported hardware | **NOT RUN** | No such device attached. Validate settings, waveform/on-off fallbacks and truthful unsupported output. |
| Device interruptions, background/resume, overlap/rapid repeats/cancel, strength and disable | **NOT RUN** | JS/algorithm fixtures cover corresponding control logic; actual OS/hardware lifecycle behavior remains untested. |
| Construct Build Service | **UNVERIFIED / NOT RUN** | Exact new package/version unpublished and not approved. Approval/version allowlisting plus API 36/Swift compatibility and an actual export are still required. |
| Official documentation research | **PARTIAL** | Current Construct Runtime scripts and IPluginInfo pages were successfully read during the fix. Initial Android/Apple website fetches were blocked; official Apache/AOSP sources and identified Apple-header mirrors were read. See RESEARCH.md for exact sources and boundaries. |

These limitations prevent a production-ready or real-device-verified claim.
The shipped external installation route is backed by actual Cordova inclusion
and Android build evidence. No identical sensations or physical completion
callbacks are promised. The native package has not been published or submitted
for Build Service approval.

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
