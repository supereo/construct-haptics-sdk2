# Supereo Haptics

Construct 3 Addon SDK v2 mobile haptics plugin, addon ID **Supereo_Haptics**.
Addon release **1.0.3** (Construct metadata version **1.0.3.0**).
The compatible native Cordova bridge remains **1.0.0**.

**Installation blocker confirmed by the user's Mac log:** this repository is
private. The declared raw GitHub native-package URL returns npm **E404** during
ordinary Cordova preparation. The dependency was emitted by Construct, but its
download failed. Earlier managed-environment access did not establish anonymous
public availability. Native distribution needs a separately accessible host;
see the [corrected test report](docs/TEST-REPORT.md).

The packaged addon is `dist/Supereo_Haptics-1.0.3.c3addon`. Export a **Cordova
project** from Construct and use normal local Cordova preparation/building.
The addon declares its matching native bridge automatically; a `.c3addon` alone
does not supply Android/iOS implementations. See [installation](docs/INSTALLATION.md).

Nine beginner-friendly feedback presets, named custom patterns, Off/Light/Normal
player preferences, native scheduling, capability-aware fallbacks, cancellation,
duplicate protection and a visibly labeled browser simulation. No analytics,
network calls, private native APIs or synthesized audio. Feedback varies with
hardware and platform settings. An accepted dispatch is not physical completion.

**Local Cordova builds need no Scirra approval or native npm publication.** The
declared immutable native tarball is checksum-verified, but its private GitHub
host currently blocks installation on an unauthenticated user machine. Normal
preparation can restore an accessible package without per-export plugin-add or
repair steps.
Version 1.0.3 improves startup/lifecycle handling when the matching bridge is
installed; it cannot create native code from JavaScript. The hosted Construct
Build Service is a separate option with unmet npm/approval requirements.
The [review-only approval draft](docs/BUILD-SERVICE-APPROVAL-REQUEST.md) records
the exact package, source and checksum. Nothing was published or submitted.
Fresh Construct editor exports, Xcode and real-device checks remain NOT RUN;
see the [actual test report](docs/TEST-REPORT.md).

The addon explicitly registers the runtime-only `c3runtime/haptics-core.js`
module with `AddC3RuntimeScript`; the DOM handler embeds its own core. This keeps
the runtime helper available to the documented module exporter while retaining
the separate DOM dependency. Actions, conditions, expressions, properties and
native protocol are unchanged.

When a project bundles addons, updating Addon Manager alone does not update the
project's copy. Right-click the project in Project Bar → **Tools → View used
addons** → right-click the bold Supereo Haptics entry → **Update to editor
version**. Save, reload and export to a fresh folder. Perform this once for the
updated release; it does not rewrite an existing export. The published 1.0.1 archive
has no helper import; a build that still requests it must be inspected for a
different bundled or cached copy.

## Start here

- [Install and export](docs/INSTALLATION.md): one-time editor/project update, automatic native restoration and local iOS/Android builds.
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
