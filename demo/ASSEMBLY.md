# Assemble the Construct demonstration

These are exact event-sheet assembly instructions for a new demonstration in Construct 3 r495.2. No `.c3p` is supplied as “verified”: this environment had no Construct editor session with which to open and validate one. The included `demo/index.html` is a separate browser simulator, not a Construct project or a native-device test.

## Create the layout

1. Install `dist/Supereo_Haptics-1.0.2.c3addon` through Addon Manager, confirm Construct metadata version `1.0.2.0`, and reload Construct. Create a blank project named `SupereoHapticsDemo`. If updating an existing demo with a bundled addon, use Project Bar → right-click project → Tools → View used addons → right-click the bold Supereo Haptics entry → Update to editor version, then save/reload. Native bridge 1.0.0 does not need reinstalling if already present.
2. Set the project's Worker setting to **Auto**. Keep export minification **Simple** when exporting. Create layout `Demo` and event sheet `DemoEvents`.
3. Add the single global **Supereo Haptics** object and name the project object `SupereoHaptics`. In its properties, set **Enabled** Yes, **Overall strength** `1`, **Native required** No, **Preview simulation** Yes, **Overlap policy** Replace active pattern, **Duplicate protection (ms)** `40`, and **Bridge wait limit (ms)** `2500`. These settings deliberately enable visible browser simulation when the native bridge is absent.
4. Add the standard **AJAX** object. Add four project files from `examples/`: `gentle-selection.json`, `rising-success.json`, `double-warning.json`, `soft-pulse.json`.
5. Add four Text objects named `Title`, `Status`, `Capabilities` and `Result`. Set Title to `Supereo Haptics — simulation until installed in a native app`. Give Capabilities and Result enough room for multiple lines.
6. Add the Button objects in the tables below. Use each listed object name exactly, put its label in the Button's Text property, and arrange them in a readable grid. Each name represents a separate Button object type, which avoids a need to filter shared button instances.

| Button object | Label | On clicked → Supereo Haptics action |
| --- | --- | --- |
| `BSelection` | Selection tick | Play feedback → Selection tick |
| `BLight` | Light impact | Play feedback → Light impact |
| `BMedium` | Medium impact | Play feedback → Medium impact |
| `BStrong` | Strong impact | Play feedback → Strong impact |
| `BSoft` | Soft impact | Play feedback → Soft impact |
| `BCrisp` | Crisp impact | Play feedback → Crisp impact |
| `BSuccess` | Success | Play feedback → Success sequence |
| `BWarning` | Warning | Play feedback → Warning sequence |
| `BError` | Error | Play feedback → Error sequence |
| `BGentlePattern` | Gentle custom selection | Play custom pattern → `gentle-selection` |
| `BRisingPattern` | Rising three-tap success | Play custom pattern → `rising-success` |
| `BDoublePattern` | Custom double warning | Play custom pattern → `double-warning` |
| `BPulsePattern` | Increase and fade | Play custom pattern → `soft-pulse` |
| `BStop` | Stop | Stop feedback |
| `BRefresh` | Refresh capabilities | Refresh capabilities |

Add these control buttons and events:

| Button object | Label | On clicked actions |
| --- | --- | --- |
| `BOff` | Haptics Off | Supereo Haptics: Set haptics enabled → Disabled |
| `BLightSetting` | Haptics Light | Supereo Haptics: Set haptics enabled → Enabled; Set overall strength → `0.35` |
| `BNormalSetting` | Haptics Normal | Supereo Haptics: Set haptics enabled → Enabled; Set overall strength → `1` |
| `BReplace` | Replace overlapping pattern | Supereo Haptics: Set overlap policy → Replace active pattern |
| `BIgnore` | Ignore while busy | Supereo Haptics: Set overlap policy → Ignore new request while busy |

## Register the example files

Create these System **On start of layout** actions:

```text
AJAX: Request project file gentle-selection.json, tag "gentle-selection"
AJAX: Request project file rising-success.json, tag "rising-success"
AJAX: Request project file double-warning.json, tag "double-warning"
AJAX: Request project file soft-pulse.json, tag "soft-pulse"
Status: Set text to "Loading patterns; no hardware has been exercised."
```

For each tag, add AJAX **On completed** with that exact tag and the corresponding registration action:

```text
AJAX On "gentle-selection" completed
  Supereo Haptics: Register custom pattern "gentle-selection", AJAX.LastData
AJAX On "rising-success" completed
  Supereo Haptics: Register custom pattern "rising-success", AJAX.LastData
AJAX On "double-warning" completed
  Supereo Haptics: Register custom pattern "double-warning", AJAX.LastData
AJAX On "soft-pulse" completed
  Supereo Haptics: Register custom pattern "soft-pulse", AJAX.LastData
```

Add AJAX **On error** events for the same tags to show an explanatory Status message. Wait for all four completions before trying custom-pattern buttons; a button pressed earlier should produce `pattern-not-registered`, which demonstrates a clear error rather than implicit native playback. If using an editor AJAX action that takes a URL rather than a project-file dropdown, use the exact project file name as the URL and the listed tag.

## Display diagnostics

Add these events using the addon's actual conditions and expression names:

| Condition | Text update |
| --- | --- |
| Supereo Haptics: On capabilities refreshed | `Capabilities`: `SupereoHaptics.CapabilitiesJSON` |
| Supereo Haptics: On feedback accepted | `Result`: `SupereoHaptics.LastResultJSON`; `Status`: `"Accepted locally: " & SupereoHaptics.LastFeedback` |
| Supereo Haptics: On feedback rejected | `Result`: `SupereoHaptics.LastResultJSON`; `Status`: `"Request skipped or rejected"` |
| Supereo Haptics: On error | `Status`: `SupereoHaptics.LastError`; `Result`: `SupereoHaptics.LastResultJSON` |
| Supereo Haptics: On preview feedback | `Status`: `"PREVIEW SIMULATION — no hardware exercised: " & SupereoHaptics.LastFeedback` |

`SupereoHaptics` above is the Construct object's project name. If Construct creates another name, rename the object to `SupereoHaptics` or select that object in the expression picker and use its generated expression name. The internal addon ID remains `Supereo_Haptics`.

For initial capabilities, add an event with **Capability check is ready** plus System **Trigger once while true**, and call **Refresh capabilities**. Also display `SupereoHaptics.Backend`, `SupereoHaptics.FallbackInfo` and `SupereoHaptics.Strength` in your diagnostic panel. Individual capability conditions can set Yes/No Text labels for Native bridge available, Haptic hardware available, Intensity control supported, Advanced patterns supported, Sharpness control supported, Native primitives supported and Android envelopes supported.

The DOM-side simulator already draws a visible labeled pattern timeline with event timing and relative intensity. The standalone browser demo also provides a more detailed timeline. Neither invokes native haptics. Do not show an accepted request as “hardware completed”; acceptance is a local dispatch result.

## Verify the demonstration

1. Preview with Worker Auto. Try every preset, all four registered patterns, Off/Light/Normal, Replace/Ignore and Stop. Confirm that the visible label says simulation.
2. Trigger an identical cue twice quickly and observe duplicate protection. With Ignore selected, start `soft-pulse` then click another cue while it is busy. With Replace selected, repeat and observe replacement. Stop a long pattern before its scheduled end.
3. Change strength while a pattern is active; the current scheduled work is dropped and the next cue uses the new strength. Disable, click a preset and confirm rejection. Re-enable and retry.
4. Test malformed JSON by temporarily adding a separate registration action with an invalid value; confirm On error and no dispatch. Remove that deliberate test action before exporting.
5. Change Worker to Off and repeat the core cases. Export with Simple minification and repeat in the exported app. These are manual checks to run; the included automated host simulations do not establish that this editor/export sequence passed.
6. Before mobile export, set **Native required** Yes. Export a complete **Cordova project** and verify the pinned native `<plugin>` reference described in [INSTALLATION.md](../docs/INSTALLATION.md). Run the standard external Cordova platform preparation/build commands; restoration should include the bridge without a routine manual `plugin add`. Actual Construct emission of that reference and Build Service inclusion are not established here. A missing native bridge must produce an error instead of a simulated success.
7. On physical devices, inspect actual capabilities, then check output and lifecycle interruption/background/resume behavior. Use an advanced Android device, a basic Android motor, a supported iPhone and unsupported hardware where available. Record these separately from preview and mocked tests.

After extracting a complete Cordova export, run `npm run audit:export -- '/absolute/path/to/export/'` from the Supereo source directory; the auditor also accepts the export's `www/` or an iOS export with a unique nested web directory. If several web directories exist, pass the exact intended `www/`. Treat missing local modules as a build/loading failure and review the native bridge report separately. Audit passing is not a native/device test. For the user's QuickChess source update and exact supplied source/export paths, follow [INSTALLATION.md](../docs/INSTALLATION.md).

Use [PATTERNS.md](../docs/PATTERNS.md) for pattern semantics and [TEST-REPORT.md](../docs/TEST-REPORT.md) for what actually ran during development. QuickChess-style examples are in [QUICKCHESS.md](../docs/QUICKCHESS.md).
