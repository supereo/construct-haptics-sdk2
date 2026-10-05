# Supereo Haptics

Construct 3 Addon SDK v2 mobile haptics plugin, addon ID **Supereo_Haptics**.
Release **1.0.0** (Construct metadata version **1.0.0.0**).

The packaged addon is `dist/Supereo_Haptics-1.0.0.c3addon`. Native mobile output
also needs the separate `cordova-plugin-supereo-haptics` package. Install both
using [the installation/export guide](docs/INSTALLATION.md).

Nine beginner-friendly feedback presets, named custom patterns, Off/Light/Normal
player preferences, native scheduling, capability-aware fallbacks, cancellation,
duplicate protection and a visibly labeled browser simulation. No analytics,
network calls, private native APIs or synthesized audio. Feedback varies with
hardware and platform settings. An accepted dispatch is not physical completion.

**Build Service compatibility is unverified.** The native package is not
published or approved by Scirra. A real external Cordova Android host with this
bridge compiled debug/release and produced APK/AAB artifacts. Construct r495.2
editor import/export, iOS compilation and physical devices were unavailable;
see the [actual test report](docs/TEST-REPORT.md).

## Start here

- [Install and export](docs/INSTALLATION.md): `.c3addon` plus native bridge; Android AAB and iOS workspace route.
- [Patterns and presets](docs/PATTERNS.md): bounded version 1 JSON and four example patterns.
- [Capability/fallback matrix](docs/CAPABILITIES.md): what each platform can really expose.
- [Generic Construct demo assembly](demo/ASSEMBLY.md): exact event-sheet instructions; no unverified `.c3p`.
- [QuickChess examples](docs/QUICKCHESS.md): independent gameplay examples, no backend changes.
- [Build from source](docs/BUILD.md), [research evidence](docs/RESEARCH.md), [native evidence](docs/NATIVE-CHECKS.md).

## Rebuild the release

```sh
npm ci --ignore-scripts --cache /tmp/supereo-npm-cache
npm run verify
```

This validates the official SDK schemas, exercises the shipping JavaScript,
minifies without renaming public properties, and writes the addon, native ZIP,
native npm-format TGZ, complete source ZIP and SHA-256 checksums to `dist/`.
It does not run Xcode, a Construct editor, Build Service or devices.

For the browser demonstration, serve this source directory locally and open
`demo/index.html`. It is a visual simulator. The optional automated browser
check and separate native compilation checks are documented in BUILD.md.

MIT license. Package contents and build tools are provided in the source ZIP.
