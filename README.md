# Supereo Haptics

Construct 3 Addon SDK v2 mobile haptics plugin, addon ID **Supereo_Haptics**.
Addon release **1.0.2** (Construct metadata version **1.0.2.0**).
The compatible native Cordova bridge remains **1.0.0**.

The packaged addon is `dist/Supereo_Haptics-1.0.2.c3addon`. It declares the native
`cordova-plugin-supereo-haptics` dependency automatically, using an immutable
HTTPS package. Standard Cordova builds restore it from `config.xml`; there is no
manual plugin-add step in that route. See [the installation/export guide](docs/INSTALLATION.md).

Nine beginner-friendly feedback presets, named custom patterns, Off/Light/Normal
player preferences, native scheduling, capability-aware fallbacks, cancellation,
duplicate protection and a visibly labeled browser simulation. No analytics,
network calls, private native APIs or synthesized audio. Feedback varies with
hardware and platform settings. An accepted dispatch is not physical completion.

**Construct Build Service approval is still required.** The package is hosted
on GitHub and has not been approved by Scirra. A real external Cordova Android host with this
bridge compiled debug/release and produced APK/AAB artifacts. Construct r495.2
editor import/export, iOS compilation and physical devices were unavailable;
see the [actual test report](docs/TEST-REPORT.md).

Version 1.0.2 explicitly registers the runtime-only `c3runtime/haptics-core.js`
module with `AddC3RuntimeScript`; the DOM handler embeds its own core. This keeps
the runtime helper available to the documented module exporter while retaining
the separate DOM dependency. Actions, conditions, expressions, properties and
native protocol are unchanged.

When a project bundles addons, updating Addon Manager alone does not update the
project's copy. Right-click the project in Project Bar → **Tools → View used
addons** → right-click the bold Supereo Haptics entry → **Update to editor
version**. Save, reload and export to a fresh folder. The published 1.0.1 archive
has no helper import; a build that still requests it must be inspected for a
different bundled or cached copy.

## Start here

- [Install and export](docs/INSTALLATION.md): `.c3addon` plus native bridge; Android AAB and iOS workspace route.
- [Patterns and presets](docs/PATTERNS.md): bounded version 1 JSON and four example patterns.
- [Capability/fallback matrix](docs/CAPABILITIES.md): what each platform can really expose.
- [Generic Construct demo assembly](demo/ASSEMBLY.md): exact event-sheet instructions; no unverified `.c3p`.
- [QuickChess examples](docs/QUICKCHESS.md): independent gameplay examples, no backend changes.
- [Build from source](docs/BUILD.md), [release notes](docs/RELEASE-NOTES.md), [research evidence](docs/RESEARCH.md), [native evidence](docs/NATIVE-CHECKS.md).

## Rebuild the release

```sh
npm ci --ignore-scripts --cache /tmp/supereo-npm-cache
npm run verify
```

This validates the official SDK schemas and registered runtime module graph, exercises the shipping JavaScript,
minifies without renaming public properties, and writes the addon, native ZIP,
native npm-format TGZ, complete source ZIP and SHA-256 checksums to `dist/`.
It does not run Xcode, a Construct editor, Build Service or devices.

For the browser demonstration, serve this source directory locally and open
`demo/index.html`. It is a visual simulator. The optional automated browser
check and separate native compilation checks are documented in BUILD.md.

MIT license. Package contents and build tools are provided in the source ZIP.
