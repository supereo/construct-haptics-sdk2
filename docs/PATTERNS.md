# Patterns and feedback

The common gameplay action chooses one of nine presets: Selection tick, Light
impact, Medium impact, Strong impact, Soft impact, Crisp impact, Success, Warning,
and Error. These ask the platform for semantic feedback wherever possible. A
native preset has device-defined timing and texture: no addon can make every
phone feel identical. Overall strength is a player preference from 0 (silent) to
1 (normal). It scales supported intensity; some system feedback has no scalable
API and must be approximated. See CAPABILITIES.md.

Register a named pattern once with **Register custom pattern**, then call **Play custom pattern**
using its name during gameplay. Beginners need only the preset action. Custom
JSON belongs in startup configuration or a loaded text asset, not repeated
gameplay events. Names live in this runtime and should be registered again after
starting a new game session. Pending effects are never saved in gameplay saves.

## Version 1

```json
{"version":1,"events":[
  {"timeMs":0,"type":"transient","intensity":0.25,"sharpness":0.5},
  {"timeMs":120,"type":"continuous","durationMs":300,
   "intensity":0.4,"sharpness":0.2,
   "curves":{"intensity":[{"timeMs":0,"value":0.1},
                          {"timeMs":100,"value":0.6},
                          {"timeMs":300,"value":0}]}}
]}
```

| Field | Meaning |
| --- | --- |
| `version` | Must be the number `1`; incompatible future formats will use another version. |
| `events` | 1–64 finite events. No loops, repeats or infinite patterns. |
| `timeMs` | Whole milliseconds after the start of the pattern; events are sorted before dispatch. |
| `type` | `transient` is a tap; `continuous` is a sustained effect. |
| `durationMs` | Required for continuous effects, a positive whole number. Forbidden for transients. |
| `intensity` | Required finite number from 0 to 1. Relative strength, not calibrated force. |
| `sharpness` | Optional finite number from 0 to 1, default 0.5. Soft-to-crisp texture where supported. |
| `curves` | Optional continuous-only `intensity` and/or `sharpness` point arrays. |
| Curve `timeMs` | Event-relative whole milliseconds; strictly increasing and within event duration. |
| Curve `value` | Absolute normalized target from 0 to 1, linearly interpolated between points. |

Each curve has 1–32 points. If its first point is after time zero, interpolation
starts at the event's initial value at zero; after its last point it holds the
last value. The entire pattern must end
within 10,000 ms. A transient reserves 12 ms in the portable scheduling estimate;
Core Haptics treats it as an instantaneous event and Android fallback duration
may differ. JSON text is limited to 128 KiB. Invalid numbers, unknown fields,
empty arrays, unsupported versions and malformed JSON are rejected before
native dispatch. Native code validates again. Curves and event overlap are not
an excuse to bypass these bounds.

## Examples

- `examples/gentle-selection.json`: one subtle tap.
- `examples/rising-success.json`: three taps with increasing intensity.
- `examples/double-warning.json`: short double tap.
- `examples/soft-pulse.json`: a soft sustained pulse that grows and fades.

These are custom portable patterns, separate from native semantic presets.
Register the files with their matching names (without `.json`).

## Translation and approximation

iOS Core Haptics schedules haptic-only events on the engine clock. Independent
continuous players keep their parameter curves from changing unrelated events.
Intensity curves include overall strength. UIKit semantic generators are cached
and reused; their sensations remain controlled by the OS. Devices without Core
Haptics may support UIKit, whose hardware support cannot be reliably queried.

Android uses supported native primitives for suitable taps, an amplitude
waveform for general sequences, and guarded API 36 basic envelope effects when
hardware and pattern constraints permit. Sharpness is not a portable physical
quantity: an Android envelope's sharpness mapping is an approximation, and
waveform/basic-motor fallbacks discard it. Waveforms sample intensity curves
at 5 ms and combine overlapping events using maximum amplitude. Basic motors
cannot reproduce continuously changing amplitude; unsupported features appear
in the result's fallback information. The OS/driver may quantize time further.

Listen to **On feedback accepted** and examine approximation/fallback information.
Dispatch means the native API accepted the request locally. It does not prove
that a motor moved, that the user felt it, or that playback completed. There are
no physical-completion promises. Stop, disable, release and backgrounding cancel
the addon's work; stale effects are dropped rather than replayed after resume.

## Bridge API for native integration

The JavaScript module is `cordova.plugins.SupereoHaptics`, with Promise methods
`getCapabilities()`, `play(request)`, `stop()` and
`setState({enabled, strength})`. Calls time out after 5 seconds. A play timeout
requests best-effort cancellation; a native callback arriving later is ignored.

`play` takes `kind` (`selection`, `impact`, `notification`, `pattern`), the matching
`style`/`notification`/`pattern`, optional `requestId` (at most 128 characters),
optional per-request `strength` (default 1), and `overlap` (`replace` or `ignore`).
Effective strength is overall state strength × request strength. The Construct
addon normally sends request strength 1. Results include `accepted`, `backend`,
`requestId`, `approximated`, `fallback`, estimated `durationMs`, and
`completion: "not-observable"`. Errors have `code` and `message`.

Busy windows and timelines are estimates of scheduled work. They are not
measurements from the actuator. Android cancellation is app-scoped, so stopping
our active vibration can also cancel concurrent vibration from another plugin
in the same app. Integrate one haptics owner per game.
