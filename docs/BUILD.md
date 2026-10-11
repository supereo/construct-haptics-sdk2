# Reproducible source build

Use Node 22.9+ (verified with 24.19.0). Download/extract the complete source ZIP
or use this checkout. Keep its layout, including `vendor/construct-sdk` and the
native package. No game service, account, app-store credential or secret is
required for package building.

```sh
cd /absolute/path/to/construct-haptics-sdk2
npm ci --ignore-scripts --cache /tmp/supereo-npm-cache
npm run verify
```

The lockfile fixes tooling versions. `npm run verify` prepares the shared core,
builds packages, validates all three official SDK schemas and
source identities, runs shipping JavaScript tests, then extracts the real
minified `.c3addon` for Worker/main-thread contract tests. The loader executes
the shipping editor registration and bundles the registered runtime entry with
esbuild-wasm 0.28.2 through a restricted file map. It loads only declared DOM
scripts and does not preload a validator or strip imports. The editor/native
environment in those tests is a controlled fixture: no actual Construct editor,
Cordova device, Core Haptics engine or Android vibrator is exercised.

Before packaging, the build takes `lib/core.js`, generates a browser-global copy
for Construct's runtime-only `addon/c3runtime/haptics-core.js`, and embeds an
independent browser-global copy before `addon/source/dom-handler.js` in
`addon/c3runtime/domSide.js`. It copies `addon/source/runtime-plugin.js` to the
generated `addon/c3runtime/plugin.js`; that file contains the plugin class only.
The same preparation copies the original shared validator to the native bridge's
`www/core.js` for Cordova's module loader. Edit the shared core or the templates,
then rebuild; do not edit the generated addon scripts directly.

Addon 1.0.3 retains the registration introduced in 1.0.2: `c3runtime/haptics-core.js` with
`AddC3RuntimeScript`, lists it in `addon.json`, and imports it first from
`main.js`. `SetDOMSideScripts` lists only `domSide.js`; the DOM handler does not
load the runtime helper path. This follows the official
[runtime-scripts guide](https://www.construct.net/en/make-games/manuals/addon-sdk/guide/runtime-scripts#adding-a-module-script)
requirement to register additional runtime modules. The original 1.0.0 helper
was packaged without that registration. Release 1.0.1 addressed that gap by
embedding the runtime core; its published archive has no helper import.
Release 1.0.2 chooses explicit runtime registration and keeps the DOM copy
independent. Tests must resolve the shipping entry through Construct's runtime
script registry rather than making every archive file implicitly available.

The shipping editor plugin also declares `cordova-plugin-supereo-haptics` 1.0.0
through `AddCordovaPluginReference`, with platform `all` and its immutable
HTTPS tarball as the version spec. The repository is private, so the user's
ordinary Mac restoration currently fails with E404; managed-environment
retrieval did not establish anonymous access. Normal external Cordova restoration uses the
exported declaration. The URL and expected `config.xml` entry are in
[INSTALLATION.md](INSTALLATION.md). This is a build-time native dependency,
not a remote gameplay script; Build Service approval remains unestablished.

Actual automatic restoration from a matching constructed Cordova configuration
passed in a fresh Cordova CLI 13.0.0 / iOS 8.1.1 host without a manual
`plugin add` command. The reproducible check is
`tools/native-check/ios-auto-install.sh`; see
[ios-auto-install-result.json](evidence/ios-auto-install-result.json) and
[its log](evidence/ios-auto-install.log). This validates external URL restoration
and native project inclusion, not Construct's actual export of the declaration,
Xcode compilation, Build Service pass-through or device execution.

**11 October 2026 follow-up:** fresh ordinary `cordova prepare ios` restored
the unchanged native URL automatically, without a manual plugin-add command,
support plugin or project patch. [Current evidence](evidence/ios-auto-prepare-1.0.3.json)
records that its config came from the shipping declaration in an SDK fixture,
not an actual Construct export. The selected local route needs no Scirra approval
or native npm publication; fresh editor export and Xcode/device checks remain
NOT RUN. The current release passed **181 source + 14 extracted-addon tests**;
see [TEST-REPORT.md](TEST-REPORT.md).

## Outputs

| Artifact | Contents |
| --- | --- |
| `Supereo_Haptics-1.0.3.c3addon` | ZIP-based SDK v2 package, Construct metadata version `1.0.3.0`, minified JavaScript and editor metadata at archive root. |
| `cordova-plugin-supereo-haptics-1.0.0.zip` | Versioned local Cordova bridge directory, including Java/Swift source and schema module. |
| `cordova-plugin-supereo-haptics-1.0.0.tgz` | npm-format Cordova package; not published to a registry. |
| `supereo-haptics-source-1.0.3.zip` | Addon, bridge, shared core and source templates, validators, export audit, tests, documentation, demo, examples, schemas and locked build tools. |
| `SHA256SUMS` | SHA-256 of the four distributable archives. |

```sh
cd dist
sha256sum -c SHA256SUMS
unzip -t Supereo_Haptics-1.0.3.c3addon
```

ZIP timestamps are fixed. Identical source and dependency versions produce
identical addon/native ZIPs. Source ZIPs intentionally change when source,
documentation or evidence changes. Native app artifacts can contain build
metadata and temporary development signatures; their byte hashes are not
promised to match another machine's build. The archive itself is not a hardware
test, and schema validity is not a claim of editor installation.

Addon/source release 1.0.3 retains explicit runtime helper registration, automatic
native dependency declaration and export-audit support, and adds bounded startup
and capability/state recovery. The native
bridge stays at version 1.0.0, so its archive names and installation identity
retain that version. An existing native bridge 1.0.0 installation does not need
to be reinstalled for this addon update.

`npm run build` is the packaging-only command. `npm run check` validates the
manifest, ACE/language schemas and consistency. If `lib/core.js` changes, rebuild
before running check so the runtime module, DOM embedding and native copy are current. Public property names
are preserved during minification. The real Construct **Simple** export
minifier remains a separate manual editor check.

## Audit an exported game

Run this command from the extracted source release or repository:

```sh
npm run audit:export -- '/Users/ben/Downloads/QuickChess Construct 3/'
```

The argument is the user's supplied QuickChess export path. For a different or
fresh export, substitute its directory. The auditor accepts a Cordova project
root, the exported `www/` directory, or an iOS/Xcode export with a unique nested
`www/`. If there are multiple web directories, give the exact intended `www/`
path. It checks local static module references and
returns a nonzero exit code for missing local modules. It also reports evidence
of the separate Supereo Cordova bridge registration. A `taptic-engine` plugin is
not a replacement for `cordova-plugin-supereo-haptics`.

Audit both the existing output and the full fresh export after updating the
folder project at `/Users/ben/Downloads/QuickChess/` through Addon Manager,
then Project Bar → right-click project → Tools → View used addons → right-click
the bold bundled Supereo Haptics entry → Update to editor version. Save and
close and reopen the project. Its bundled archive
`addons/plugin/Supereo_Haptics.c3addon` must show metadata `1.0.3.0` before the
new export. Updating the editor addon does not rewrite a previous export.
Follow [INSTALLATION.md](INSTALLATION.md) for the full QuickChess source-update,
export and Cordova preparation sequence.

This is a read-only static audit, not JavaScript execution, Xcode compilation,
device playback or proof that a splash-screen hang has only one cause. At the
1.0.2 release check, the user's Mac source/export directories were absent and
the actual export audit had not run.

**Historical follow-up — 5 October 2026 (UTC):** an uploaded latest Build Service Xcode
export has now been inspected. Its 15 Simple-minified JavaScript files parse,
with zero local static imports and main-thread configuration. Both Supereo
native bridges were missing; supported Cordova iOS 8.1.1 installation added
Haptics 1.0.0 and the matching separate GameAnalytics 1.0.0-rc.1 bridge to a
project copy, preserving all 112 protected gameplay web assets/settings.
Source-project bundled-addon updating, Xcode compilation and device/backend
checks remain NOT RUN. This follow-up changes documentation and evidence only;
addon and native package versions and code remain unchanged. See
[TEST-REPORT.md](TEST-REPORT.md) and the
[sanitized summary](evidence/latest-export-repair-summary.json).

The copied-export repair kit belongs to that historical handover. The chosen
current workflow is a fresh **Construct Cordova project export followed by normal
local Cordova preparation/building**, with no repair kit or per-export plugin-add
step. See [INSTALLATION.md](INSTALLATION.md).

## Visual demo check

Serve the repository in one terminal:

```sh
python3 -m http.server 8847 --bind 127.0.0.1
```

Open `demo/index.html` from that local server to interact with every preset,
four patterns, the strength/enable controls, overlap policy and cancellation.
This is explicitly a visual preview; the timeline for semantic presets is an
illustration, not the platform's measured pulse shape.

For the automated browser check, install a Playwright Chromium browser with
`npx playwright install chromium`, or use an installed Chromium with
`SUPEREO_CHROMIUM=/absolute/path/to/chromium`. Then run:

```sh
npm run test:demo
```

The test checks all controls and desktop/mobile overflow, and writes screenshots
to ignored `test-results/`. The development run used Playwright 1.62.1 and the
host's installed Chromium. Browser downloads may require their own network
allowlist entries; this optional check is not part of `npm run verify`.

## Independent native demo host

The standalone demo can also be placed into a separate fresh Cordova demo host;
this does not replace or change a Construct export's bootstrap:

```sh
cordova create /absolute/path/to/haptics-demo com.supereo.haptics.demo SupereoHapticsDemo
mv /absolute/path/to/haptics-demo/www /absolute/path/to/haptics-demo/www-original
node tools/create-demo-host.cjs /absolute/path/to/haptics-demo/www
cd /absolute/path/to/haptics-demo
cordova platform add android@15.0.0
cordova prepare android
cordova plugin ls
cordova build android --debug
```

Before running `platform add`, declare the same pinned native `<plugin>` entry
from [INSTALLATION.md](INSTALLATION.md) in the fresh demo host's `config.xml`.
A generic host does not run Construct's editor registration, so that declaration
must be supplied by its assembly step. Cordova preparation then restores the
bridge without a manual `plugin add` command. Use the local package only as the
documented troubleshooting/offline fallback.

The helper refuses to overwrite an existing `index.html`. It installs the demo
assets and places `cordova.js` before the demo's scripts. Cordova still performs
native plugin installation. Inspect the demo's backend label: visual simulation
is never native success. Use the real Construct assembly in ASSEMBLY.md for
addon event-sheet tests. The generic demo-host recipe is an assembly aid; see
TEST-REPORT.md before assuming it was built or run on a device.

## Native compilation

See [NATIVE-CHECKS.md](NATIVE-CHECKS.md) for exact pinned toolchains, verified
downloads, environment variables and `tools/native-check` commands. That check
creates an isolated real Cordova host and builds the Java code against actual
API 36 and Cordova framework classes, including debug/release AABs and lint.
It is separate from addon packaging and from physical-device execution.

iOS needs macOS, Xcode/Apple SDK, and an iPhone for haptic behavior. A Swift
tree-sitter parse is only a syntax check. Restore the bridge through the exported
Cordova dependency, prepare the iOS workspace, and build with Xcode as in
INSTALLATION.md. Do not
disable trust, use private APIs, or replace unavailable native tests with
simulated passing results.

## Cloud development configuration

The current cloud instance contains the prepared Android toolchain outside the
checkout at `/workspace/.supereo-tools`. It is not embedded in the source ZIP.
Reusable `install_script` and `start_skill` instructions were saved in the
environment draft, along with the required official-documentation domains.
Saving those fields does not apply network changes or publish a snapshot.
Review/save the environment settings and publish through the product when you
want to retain this development environment. A fresh published cloud-task
restoration has not been tested; the fresh source-archive rebuild above is a
different check.
