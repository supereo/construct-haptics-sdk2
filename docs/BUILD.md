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

The lockfile fixes tooling versions. `npm run verify` regenerates both copies of
`lib/core.js`, builds packages, validates all three official SDK schemas and
source identities, runs shipping JavaScript tests, then extracts the real
minified `.c3addon` for Worker/main-thread contract tests. The editor/native
environment in those tests is a controlled fixture: no actual Construct editor,
Cordova device, Core Haptics engine or Android vibrator is exercised.

## Outputs

| Artifact | Contents |
| --- | --- |
| `Supereo_Haptics-1.0.0.c3addon` | ZIP-based SDK v2 package, minified JavaScript and editor metadata at archive root. |
| `cordova-plugin-supereo-haptics-1.0.0.zip` | Versioned local Cordova bridge directory, including Java/Swift source and schema module. |
| `cordova-plugin-supereo-haptics-1.0.0.tgz` | npm-format Cordova package; not published to a registry. |
| `supereo-haptics-source-1.0.0.zip` | Addon, bridge, validators, tests, documentation, demo, examples, schemas and locked build tools. |
| `SHA256SUMS` | SHA-256 of the four distributable archives. |

```sh
cd dist
sha256sum -c SHA256SUMS
unzip -t Supereo_Haptics-1.0.0.c3addon
```

ZIP timestamps are fixed. Identical source and dependency versions produce
identical addon/native ZIPs. Source ZIPs intentionally change when source,
documentation or evidence changes. Native app artifacts can contain build
metadata and temporary development signatures; their byte hashes are not
promised to match another machine's build. The archive itself is not a hardware
test, and schema validity is not a claim of editor installation.

`npm run build` is the packaging-only command. `npm run check` validates the
manifest, ACE/language schemas and consistency. If `lib/core.js` changes, rebuild
before running check so the generated copies are current. Public property names
are preserved during minification. The real Construct **Simple** export
minifier remains a separate manual editor check.

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
cordova plugin add /absolute/path/to/source/native/cordova-plugin-supereo-haptics
cordova prepare android
cordova build android --debug
```

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
tree-sitter parse is only a syntax check. Install the bridge through Cordova,
prepare the iOS workspace, and build with Xcode as in INSTALLATION.md. Do not
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
