# Capabilities, settings and fallbacks

Supereo Haptics requests the best available native feedback. A phone's motor, operating-system implementation and player settings determine the actual sensation. A “crisp” tap on one device need not feel or sound like a “crisp” tap on another. This addon generates haptic-only effects and does not synthesize audio.

These native capabilities require the matching **Supereo Haptics bridge 1.0.0** to be installed in the app. Export a Cordova project and use ordinary local Cordova preparation/building to restore the declared bridge automatically; this needs no Scirra approval or native npm publication. Addon **1.0.3** cannot create native code from JavaScript. See [INSTALLATION.md](INSTALLATION.md). An absent bridge with Native required enabled reports `native-bridge-missing`, backend `unavailable` and false hardware capabilities. It does not switch to another plugin or claim native success.

## Platform matrix

| Feature | iOS 13+ | Android API 24–25 | Android API 26–28 | Android API 29–30 | Android API 31–35 | Android API 36+ |
| --- | --- | --- | --- | --- | --- | --- |
| Semantic selection/impact/notification | Cached UIKit generators; system chooses output | Settings-respecting view feedback where suitable; short vibration fallback | Same, plus waveform fallback | Confirm/reject semantics on API 30; predefined effects when suitable | Same, with segment tick on API 34+ | Same |
| Hardware query | Core Haptics `supportsHaptics`; UIKit semantic hardware status separately **unknown** | `hasVibrator` | `hasVibrator` | Same | Same | Same |
| Custom native scheduling | Core Haptics engine clock on supported hardware; native UIKit scheduling fallback | One native on/off vibration pattern | One amplitude waveform when supported | Waveforms; API 30 can use a supported single primitive, with an estimated duration | Supported primitive compositions for suitable taps; waveforms for other patterns | Also a supported bounded envelope for suitable continuous patterns |
| Intensity | Core Haptics; UIKit impact intensity request remains system-defined | Nonzero values become motor on/off | `hasAmplitudeControl` decides waveform intensity | Same | Amplitude control or supported primitive scaling | Same, or supported envelope intensity |
| Sharpness | Core Haptics; broad UIKit impact style in fallback | No continuous sharpness control | Ignored by waveforms | Ignored by waveforms | Broad primitive choice for taps; no general sharpness curve | Basic envelope sharpness only on hardware that advertises envelope support |
| Curves | Core Haptics intensity/sharpness curves for continuous events | Intensity sampled into on/off timing; sharpness ignored | Intensity sampled into waveform amplitudes where supported | Same | Same for waveform patterns | Suitable supported envelope preserves bounded intensity/sharpness changes with required ramps |
| Predefined support report | Not applicable | Not applicable | Not applicable | API 29 effects; API 30 YES/NO/UNKNOWN query | YES/NO/UNKNOWN query | YES/NO/UNKNOWN query |
| Stop scheduled addon work | Stops native players and future UIKit work; cannot recall a delivered semantic tap | Cancels active addon vibration | Same | Same | Same | Same |

Version support does not imply hardware support. The reference Android build route uses Cordova Android 15, whose minimum device API is 24. API 36 is required at compile time for newer envelope classes; guards keep those classes out of unsupported runtime paths. The iOS route uses Cordova iOS 8 and minimum iOS 13.

Android sharpness is not universally equivalent to Core Haptics sharpness. Primitive choice provides broad tap texture, while waveform fallback has no sharpness control. API 36's supported basic envelope maps sharpness through the device's frequency response. The native result explicitly reports that mapping and any hardware-required ramps as approximations.

## What the conditions mean

| Condition | Meaning |
| --- | --- |
| Capability check is ready | The DOM bridge initialization returned, including a clear unavailable/error state. Inspect the backend and error information as well. |
| Native bridge available | Cordova exposed this bridge's JavaScript namespace. Inspect the backend and Last error for a failed native handshake. Does not mean a motor is present. |
| Haptic hardware available | Positive native hardware evidence: Android `hasVibrator`, or iOS Core Haptics `supportsHaptics`. On iOS, a false result does not prove that UIKit semantic feedback is impossible. |
| Intensity control supported | At least one native path supports varying intensity. Fixed semantic feedback and some fallback paths can still ignore positive strength changes. |
| Advanced patterns supported | At least one native advanced route exists. Read individual curve/primitive/envelope fields before assuming all pattern features are available. |
| Sharpness control supported | Core Haptics on iOS or supported API 36 Android envelopes. Does not promise matching sensations between platforms. |
| Primitives supported | The Android device reports supported native primitives useful to this addon. Every composition checks the particular primitives it uses. |
| Envelopes supported | Android API 36+ and a positive native envelope-support query. Individual patterns must also fit hardware limits and the supported translation shape. |
| Preview simulation | The selected backend is an explicit simulator. No native motor has been exercised. |

**Capabilities JSON** is the advanced inspection view. Common fields are `backend`, `bridgeAvailable`, `hardwareAvailable`, `intensityControl`, `advancedPatterns`, `amplitudeControl`, `sharpnessControl`, `intensityCurves`, `sharpnessCurves`, `primitives`, `envelopes`, `fallbackInfo` and `completion`.

Android adds `sdkInt`, `systemHapticsEnabled`, `effectSupport`, `primitiveSupport`, `primitiveDurationsMs` and, when supported, `envelopeLimits`. Effect support retains the native tri-state answer; **UNKNOWN is not YES**. iOS reports `semanticHardwareStatus` separately because UIKit provides no reliable corresponding hardware probe.

**Backend** identifies the route, normally `android-native`, `ios-native`, `preview-simulation`, or `unavailable`. **Fallback information** describes general limitations of the backend. **Last result JSON** describes the particular dispatch and its `approximated` flag, `fallback` reasons, route and scheduling duration. A feature being generally available does not guarantee that every pattern uses it.

## Presets and strength

| Preset | Intended use | Native preference |
| --- | --- | --- |
| Selection tick | Small, frequent changes of focus or selection | UIKit selection / suitable Android system tick |
| Light impact | Small contact | UIKit light impact / supported small tap primitive or effect |
| Medium impact | Ordinary placement or contact | UIKit medium impact / supported native tap |
| Strong impact | Major contact, used sparingly | UIKit heavy impact / stronger native tap |
| Soft impact | Gentle rounded contact | UIKit soft impact / broad Android tap texture or approximation |
| Crisp impact | Firm, sharply defined contact | UIKit rigid impact / broad Android tap texture or approximation |
| Success sequence | Positive confirmation | UIKit success notification / Android confirm where appropriate |
| Warning sequence | Short caution | UIKit warning notification / short portable double-tap fallback |
| Error sequence | Rejected action | UIKit error notification / Android reject where appropriate |

The common **Play feedback** action contains these choices; there is no need to compose JSON for ordinary cues. To require a specific portable pulse layout, use a named custom pattern. A semantic system notification deliberately lets the platform select its feedback instead of promising an exact pulse count.

**Overall strength** is a normalized request from 0 to 1. Zero suppresses all addon feedback. Smaller positive values reduce supported amplitudes and primitive/Core Haptics intensities; they do not turn a basic on/off motor into an amplitude motor. UIKit selection and notification APIs use fixed semantics, so positive reduced strength may leave their sensation unchanged and is reported as an approximation. Consider limiting frequent fixed-strength cues when a player chooses Light.

**Enabled** is a separate explicit switch. Disabling cancels current scheduled addon work and suppresses subsequent requests. Store the player's preference in your game's normal settings; pending haptic effects are not restored from Construct gameplay save/load.

Changing strength through the Construct action also drops the current scheduled pattern and applies the new value to future requests. It cannot recall UIKit feedback already delivered to the operating system.

## Object properties

| Property | Default | Plain-language meaning |
| --- | --- | --- |
| Enabled | Yes | Initial player preference. Choose No to start silently. The Set haptics enabled action changes it during play. |
| Overall strength | `1` | Initial strength between `0` and `1`; `0` is silent, `0.35` is a useful Light setting and `1` is Normal. Set overall strength changes it during play. |
| Native required | Yes | A missing native bridge produces an explicit error. Keep this on for Android/iOS exports. Turn it off only when deliberately allowing simulation; doing so cannot repair native installation or verify physical output. |
| Preview simulation | Yes | If Native required is off and no bridge is available, show the requested cue visually. No hardware is exercised. Native required always takes priority. |
| Overlap policy | Replace active pattern | Replace cancels scheduled previous work. Ignore new request while busy skips the new request during the estimated active interval. Set overlap policy changes it during play. |
| Duplicate protection (ms) | `40` | Suppress identical rapid cues for this many milliseconds, from `0` to `1000`. `0` disables duplicate suppression. Useful when one interaction accidentally fires two events. |
| Bridge wait limit (ms) | `2500` | Limit each bridge startup stage to this many milliseconds, from `250` to `10000`. The complete runtime/DOM initialization also has the separate bound described below. Increase only if a measured native startup needs it. |

The common actions have one simple input: Play feedback chooses a preset, Set haptics enabled chooses Disabled/Enabled, Set overall strength takes a number from 0 to 1, and Set overlap policy chooses Replace/Ignore. Stop feedback and Refresh capabilities have no parameters. Advanced Register custom pattern takes a 1–80-character name and version 1 JSON; Play custom pattern later takes just that name. At most 64 named patterns can be registered. See [PATTERNS.md](PATTERNS.md) for the separate advanced format.

## Startup and capability recovery

Addon 1.0.3 bounds the complete runtime-to-DOM initialization by **`3 × Bridge wait limit + 250 ms`**, default **7750 ms**. On transport/handshake failure, Capability check is ready becomes true with backend unavailable and an error; ready means the check completed, not that haptics work. Initial loading does not fire a gameplay error trigger before startup finishes.

**Refresh capabilities** can retry a dropped initialization using the current enabled, strength and overlap settings. A late `deviceready` or foreground transition rechecks an existing native bridge and reapplies player settings before playback resumes. Failed recovery clears stale hardware flags; errors after startup use the existing On error condition. Backgrounded and obsolete responses cannot restore stale capabilities or replay effects. Runtime release clears pending addon watchdogs/listeners. None of these paths installs a missing native package.

## Overlap, timing and cancellation

**Replace current** is the default overlap policy. A new accepted request stops the addon's scheduled previous pattern and becomes the current one. **Ignore while busy** rejects a new request while the addon regards an earlier cue as active. A semantic cue's busy interval is a scheduling estimate, not a hardware completion measurement.

The duplicate window suppresses rapid identical triggers that commonly arise from repeated collision or pointer events. It is bounded and configurable; distinct cues are not treated as duplicates merely because they occur close together. Native requests and runtime-to-DOM exchanges have bounded waits and structured error results.

The DOM dispatch queue holds at most 32 requests. A request is dropped if it has waited more than 1000 ms before dispatch, including waits for bridge initialization, strength updates or cancellation of the previous pattern. This fixed freshness limit prevents delayed gameplay feedback after a transport stall; the rejected result reports `stale-request-dropped` and sends no native play request.

Timing is translated into native schedules. Core Haptics uses a common engine clock, Android waveforms/compositions/envelopes are handed to the vibrator as a complete bounded effect, and UIKit fallback schedules future taps on the native main queue. The addon does not issue each pulse using gameplay JavaScript timers. Waveform translation samples continuous intensity at 5 ms intervals, so it is an approximation.

**Stop active pattern** cancels this addon's future scheduled work. Public native cancellation cannot undo a tap that already occurred. Android's public `Vibrator.cancel()` is scoped to the app's UID; if another plugin in the same app independently vibrates at the same time, a cancellation while Supereo is active may also cancel that vibration. Coordinate other vibration plugins or use only one haptic provider.

Backgrounding, engine interruption/reset and runtime release cancel pending addon work. Resume does not replay stale patterns. A new foreground request restarts native resources when appropriate. Core Haptics engines and UIKit generators are reused rather than created for every tick.

## Player and platform settings

The addon respects its Enabled and Overall strength settings and uses settings-respecting semantic APIs. It does not set Android “ignore user settings” flags, request notification-policy access, or try to override operating-system power/accessibility/haptic behavior. Custom effects use native haptic attributes where available; the operating system may suppress them under its own policy.

No analytics, player identifiers or network requests are part of the bridge. Android's sole declared permission is normal `VIBRATE`; iOS does not require a haptics permission dialog. Core Haptics runs in haptics-only mode.

## Acceptance is not physical completion

**On feedback accepted** means the addon accepted the local dispatch. **On feedback rejected** covers settings/overlap/duplicate or other non-playing results; **On error** covers failed validation or bridge/native errors. These are not reliable signals that a motor finished, nor proof that hardware actually produced feedback. Results set `completion: "not-observable"` where native physical output cannot be observed.

Simulated tests and preview demonstrations never count as native/device tests. Check [TEST-REPORT.md](TEST-REPORT.md) for the actual validation record and the real-device checklist.

For a missing bridge, update a stale project-bundled addon once through **Tools → View used addons → Update to editor version**, save/close/reopen, export a fresh Cordova project and inspect ordinary Cordova preparation for the declared package. Refresh can retry a present bridge; it cannot install absent native code. Hosted Build Service approval applies only if choosing that separate build route.
