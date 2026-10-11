# Release notes

**Known distribution blocker for 1.0.3:** the declared native tarball is hosted
in a private GitHub repository. The user's ordinary Mac preparation returned
npm E404 even though Construct emitted the plugin declaration. Prior cloud
restoration did not prove public access. Runtime fixes remain valid, but normal
installation needs an accessible native-package host; see [TEST-REPORT.md](TEST-REPORT.md).

## Addon 1.0.3 / native bridge 1.0.0

Bounds the complete runtime-to-DOM startup handshake and allows **Refresh
capabilities** to retry initialization using current settings. Late
`deviceready` and foreground transitions recheck capabilities and restore
enabled/strength state; stale pre-pause requests, obsolete initialization
dispatches and obsolete replies are
dropped. Failed recovery clears stale hardware capability flags and reports an
error after startup. Release clears the addon's pending watchdogs/listeners.
These changes handle an app that already contains the matching bridge.
The runtime-only helper remains registered
with `AddC3RuntimeScript`; the DOM validator remains independently embedded.
Event-sheet interfaces, portable pattern format and native bridge version remain
unchanged. A missing-native error directs users to update a stale project-bundled
addon once, produce a fresh export and verify native dependency preparation.

The complete startup wait is bounded by `3 × Bridge wait limit + 250 ms`
(default **7750 ms**). A failed initialization still completes the capability
check with an unavailable result; it does not report native success or leave
the runtime load promise waiting indefinitely. Initial startup does not fire a
gameplay error trigger before loading has completed.

The chosen workflow is **Construct Cordova project export → local Cordova
prepare/build**. It restores the automatically declared native 1.0.0 tarball and
needs no Scirra approval or native npm publication. The current public tarball
was fetched with TLS and its checksum verified. Version 1.0.3 cannot create an
absent native implementation from runtime JavaScript; normal Cordova preparation
performs the installation.

The [approval draft](BUILD-SERVICE-APPROVAL-REQUEST.md) identifies the exact native
1.0.0 source, tarball, checksum, platform requirements and verification limits.
It is review-only information for the separate hosted Build Service, whose
npm/approval prerequisites remain unmet. No npm upload or issue submission was
performed or required for the chosen local route. Fresh
Construct editor exports, Xcode compilation, physical-device behavior and
QuickChess editor wiring remain NOT RUN. See [TEST-REPORT.md](TEST-REPORT.md).
The sections below preserve earlier release history; prior copied-export repairs
are not the normal local Cordova export/build workflow.

## Addon 1.0.2 / native bridge 1.0.0

Registers the runtime-only `c3runtime/haptics-core.js` with
`AddC3RuntimeScript`, includes it in the addon manifest, and imports it first
from the runtime entry. The DOM-side validator remains independently embedded
in `domSide.js`, which is the only registered DOM script. The runtime plugin
script now contains its class only.

Adds automatic native dependency declaration using `AddCordovaPluginReference`
for `cordova-plugin-supereo-haptics` 1.0.0. Its version spec is an immutable public
HTTPS tarball at repository commit
`d15c7d1b0ec1300b85a7970fa23a773ed7e1f1fd`; normal external Cordova preparation
restores that package. The native package remains unchanged and needs no npm
publication. The declaration does **not** grant Build Service approval; actual
Construct export of the reference and service pass-through remain NOT RUN.

Fresh Cordova CLI 13.0.0 / iOS 8.1.1 restoration from a matching constructed
`config.xml` passed without a manual `plugin add` command, with the JavaScript
and native project registrations included. The configuration was not an actual
Construct export; Xcode compilation and iPhone execution remain NOT RUN. See
[automatic-install evidence](evidence/ios-auto-install-result.json).

Also adds a read-only exported-project auditor and documents rebuilding the
user's QuickChess export from the original Construct source. The command
`npm run audit:export -- '/Users/ben/Downloads/QuickChess Construct 3/'` accepts
the Cordova root, exported `www/`, or iOS export with a unique nested `www/`,
reports missing local static module
references with a nonzero exit code, and reports Supereo bridge registration.

Version **1.0.1** already addressed the original unregistered-helper defect by
embedding its runtime core; the published 1.0.1 archive has no helper import.
Version 1.0.2 chooses explicit runtime-module registration instead. Seeing an
old unresolved import after an attempted 1.0.1 update suggests a different
bundled/cached/exported copy. At the release check those files were unavailable,
so that explanation was not proven; see the later inspection note below.

Updating the editor addon does not update an old export. Install
`Supereo_Haptics-1.0.2.c3addon`, confirm Construct metadata version `1.0.2.0`,
reload Construct, update the project-bundled addon, and produce a full fresh
Cordova export before rebuilding the app.

For the reported folder project at `/Users/ben/Downloads/QuickChess/`, update
the editor's installed addon through Construct's Addon Manager. Then use
Project Bar → right-click project → Tools → View used addons → right-click
the bold Supereo Haptics entry → Update to editor version. Save/reload so its
bundled `addons/plugin/Supereo_Haptics.c3addon` carries metadata `1.0.2.0`. These
steps are documented in Construct's official
[Installing third-party addons guide](https://www.construct.net/en/make-games/manuals/construct-3/tips-and-guides/installing-third-party-addons#bundling-addons-to-projects).
Preserve the
old Xcode export at `/Users/ben/Downloads/QuickChess Construct 3/` and extract
the complete new export separately. A runtime-only patch to the old output
would leave the source project's bundled addon and generated files stale.

The separate native bridge remains **1.0.0**. An existing Supereo bridge 1.0.0
installation requires no reinstall for this addon update; a fresh export's
declared dependency is restored during Cordova preparation. Local `plugin add`
is a troubleshooting/offline fallback only. `taptic-engine` is
a different plugin and does not register `cordova.plugins.SupereoHaptics` or the
native `SupereoHaptics` service. The verified iOS project-generation route uses
Cordova iOS 8.1.1; Xcode compilation and device output are separate checks.

At the release check the user's Mac source and export folders were absent, so
the actual export audit had not run. The original source bundled-addon check and
iOS startup/device checks remain **NOT RUN**. Static audit results do not
establish that a splash-screen hang has only one cause. No QuickChess
gameplay, analytics, backend or purchase changes are included. See
[INSTALLATION.md](INSTALLATION.md) and [TEST-REPORT.md](TEST-REPORT.md) for the
rebuild workflow, actual validation and remaining limits.

### Export-inspection follow-up — 5 October 2026 (UTC)

The later supplied latest Build Service Xcode export passes static inspection
of 15 Simple-minified JavaScript files with zero local imports. Both Supereo
native bridges were missing, despite the presence of Taptic Engine 2.2.0.
Supported Cordova iOS 8.1.1 installation added Haptics 1.0.0 and matching
SupereoGameAnalytics 1.0.0-rc.1 to a separate project copy; 112 protected gameplay
web assets/settings are unchanged. Native registration, source/resource copies
and framework inclusion were checked. Xcode compilation, device output and
analytics initialization/dashboard delivery remain NOT RUN. The prepared
workspace and separate local repair kit are handover artifacts, not additions
to this SDK package. Follow the kit's README for future copied-export repairs.
Build Service approval and future automatic inclusion remain unestablished.

Addon 1.0.2 and native bridge 1.0.0 are unchanged. This follow-up updates only
documentation and sanitized evidence, with no gameplay or analytics event-sheet
changes. See [TEST-REPORT.md](TEST-REPORT.md) for the exact checks and limits.

## Addon 1.0.1 / native bridge 1.0.0

Fixes this Construct export/bundle failure reported for addon 1.0.0:

```text
[plugin: file-map-resolver] path 'scripts/plugins/Supereo_Haptics/c3runtime/haptics-core.js' not found
```

Listing a file in the addon archive does not register it as an additional runtime
script. The original helper was imported by `main.js` and listed as a DOM-side
script, without the required runtime registration. Earlier host tests preloaded
the helper and skipped import resolution, so they missed this build failure.

The 1.0.1 build embeds the browser-only validator in the default runtime
`plugin.js` and the single registered `domSide.js`, generated from one source.
There is no separate helper import. This also ensures that the runtime bundler
does not select a CommonJS-only branch that would leave the worker's validator
global unset. Node/Cordova continue using their existing module adapter.

Regression tests use esbuild-wasm and the documented Construct runtime script
registry. They reject the original missing import, resolve the new packaged
entry point, and execute the actual bundle in Worker/main-thread fixtures without
preloading the validator. These remain host tests, not an actual Construct editor
retest; see TEST-REPORT.md for results and remaining limitations.

Install `Supereo_Haptics-1.0.1.c3addon` through Construct's Addon Manager and reload
the editor so the older cached runtime script is replaced. Keep addon ID
`Supereo_Haptics`; existing event-sheet controls and pattern format are unchanged.
The native bridge remains 1.0.0 and does not need reinstalling for this addon fix.
