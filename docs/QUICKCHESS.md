# QuickChess-style event examples

Supereo Haptics is a generic Construct addon. The examples below attach feedback to ordinary chess events; they do not require QuickChess code, analytics, a backend, or a purchase system. Keep your game's existing move validation and settings storage.

## Game events

| Game event | Supereo Haptics action | Reason |
| --- | --- | --- |
| A selectable piece becomes selected | Play feedback → Selection tick | A small acknowledgement suitable for frequent interactions. Fire when selection actually changes, not every frame while selected. |
| A legal move is committed to the board | Play feedback → Crisp impact | A clear placement cue after successful move validation. |
| A capture is committed | Play custom pattern → `capture` | Two short contrasting taps distinguish capture from an ordinary placement. Use this instead of also firing the placement cue. |
| The player's clock first crosses a warning threshold | Play feedback → Warning sequence, or Play custom pattern → `double-warning` | Short caution. Fire once at the threshold; do not trigger every timer tick. |
| A puzzle or challenge is completed successfully | Play feedback → Success sequence | Native positive confirmation where available. |
| A move is rejected by the game | Play feedback → Error sequence | Native rejected-action feedback where available. Avoid firing repeatedly while a finger remains down. |

Tie these actions to the game's authoritative local event for the interaction. For capture, use mutually exclusive capture/ordinary-move branches so Replace overlap does not discard one cue or produce an unintended combination. **On feedback accepted** is only local haptic dispatch acceptance; never use it to approve a chess move or advance the game clock.

### Optional capture pattern

At initialization, use **Register custom pattern** with name `capture` and this version 1 pattern. After registration, game events only need the name.

```json
{
  "version": 1,
  "events": [
    { "timeMs": 0, "type": "transient", "intensity": 0.75, "sharpness": 0.9 },
    { "timeMs": 65, "type": "transient", "intensity": 0.35, "sharpness": 0.35 }
  ]
}
```

The two requested start times are portable. Texture and intensity are device-dependent. Core Haptics can express both parameters, supported Android primitives can supply broad tap textures, and a basic motor uses a short on/off approximation. Inspect **LastWasApproximated** and **LastResultJSON** when testing devices.

Use the supplied `examples/double-warning.json` for a requested double-tap timing instead of a semantic notification when that layout matters. Do not assume a system Warning sequence contains exactly two pulses on every device.

## Player settings

Offer three simple choices in the game's existing settings screen:

| Player choice | Event actions |
| --- | --- |
| Off | Set haptics enabled → Disabled |
| Light | Set haptics enabled → Enabled; Set overall strength → `0.35` |
| Normal | Set haptics enabled → Enabled; Set overall strength → `1` |

Apply the stored choice at game initialization and whenever the player changes it. The addon is single global, so it applies across layouts. Strength changes and disabling drop current scheduled addon work; effects are not restored from gameplay save/load.

Light requests less intensity where the backend supports it. A basic motor may remain on/off, and UIKit selection/notification semantics do not accept arbitrary strength. These cases are reported as approximations. If Light should also reduce the number of cues, omit low-priority selection feedback under that setting while retaining important move or warning cues.

## Timing and interruptions

Keep **Replace active pattern** for responsive board interactions. If a longer custom celebratory cue should run undisturbed, temporarily use **Ignore new request while busy**, then restore Replace for normal play. Its busy window is an estimate, not reliable sensed completion; do not make gameplay wait for it.

Use **Stop feedback** when leaving the game screen if the game's flow requires it. The addon also clears scheduled work on backgrounding, engine reset/interruption and runtime release. Resume does not replay a stale clock warning or move cue. Android cancellation can affect another vibration plugin in the same app while Supereo is active, so avoid competing vibration providers.

For export/install requirements and honest capability behavior, see [INSTALLATION.md](INSTALLATION.md), [CAPABILITIES.md](CAPABILITIES.md) and [PATTERNS.md](PATTERNS.md).
