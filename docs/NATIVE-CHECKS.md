# Native build evidence

This report covers a real, isolated Apache Cordova Android host containing `cordova-plugin-supereo-haptics` 1.0.0 and a separate iOS project generation check. Android was compiled and packaged; iOS was generated and inspected without compilation. Neither check establishes that Construct r495.2 exports, the Construct Build Service, or any physical device has been exercised.

## Actual results: 2026-10-05

| Check | Result | Evidence |
| --- | --- | --- |
| Cordova installation from the versioned local native package | PASS | Plugin 1.0.0 installed into a fresh generated Cordova host. |
| Actual Android native source, debug and release | PASS | Genuine SDK/Cordova classes; Gradle completed 168 tasks in 28 seconds, exit 0. [Build log](evidence/android-native-build.log). |
| Debug APK, debug AAB, unsigned release AAB | PASS | [Sizes, SHA-256 hashes and compiled source identity](evidence/android-native-result.json). |
| Android full lint report | PASS with warnings | Zero native Java errors; 13 warnings: five suggest `@RequiresApi` instead of scoped `@TargetApi`, eight concern the generated Cordova template/manifest. The annotated helpers have explicit guarded callers. [Full report](evidence/android-lint.txt), [XML](evidence/android-lint.xml). |
| Actual native validator/waveform host tests | PASS | 26 assertions, [output](evidence/android-java-patterns.log). No native device APIs were called. |
| APK manifest minimum/target SDK and plugin permission | PASS | API 24/36, `VIBRATE`; Cordova also contributes its own `INTERNET` and receiver permission. [Manifest inspection](evidence/android-apk-manifest.log). |
| Debug APK signature | PASS | APK Signature Scheme v2 verified. [Signature output](evidence/android-apk-signature.log). |
| Release AAB signing status | Confirmed unsigned | Deliberately no app signing identity; [jarsigner output](evidence/android-release-signing.log). |

The recorded build compiled Java source SHA-256 `a78ad7750eb4f759495f6ea7dffecc5a219a0e1b47cd8afb9f97b5e5120d7d75`. Native Build Service and Construct-export claims remain outside this check's scope.

## Actual iOS project generation: 2026-10-05

Cordova CLI 13.0.0 created a genuine Cordova iOS 8.1.1 project on this Linux host, installed the local native package, and ran `cordova prepare ios`. The generic demo was assembled into a fresh `www` directory while preserving Cordova's generated placeholder separately. Preparation copied the demo and generated Cordova's JavaScript plugin loader.

The check verified that the plugin's unchanged Swift source and privacy bundle were physically included, that the Xcode project's source/resource/framework build phases referenced them, that UIKit and Core Haptics were linked, and that both the native feature namespace and JavaScript clobber were registered. It parsed the copied privacy plist and confirmed no tracking and no collected-data declarations. Cordova iOS 8.1.1 supplies Swift language version 5.0 by default; the plugin does not require a SwiftVersion installation variable.

| Check | Result | Evidence |
| --- | --- | --- |
| Real iOS project generation, plugin install and preparation | PASS | [CLI output](evidence/ios-project-generation.log). |
| Swift source, privacy resource, linked frameworks and target build-phase inclusion | PASS | [Generated project](evidence/ios-project.pbxproj), [source/resource identities](evidence/ios-project-result.json). |
| Native `SupereoHaptics` and `cordova.plugins.SupereoHaptics` registration | PASS | [Generated config](evidence/ios-config.xml), [generated loader](evidence/ios-cordova-plugins.js). |
| Generic demo assembly and Cordova preparation | PASS | The prepared HTML references `cordova.js`; no iOS app execution occurred. |
| Swift/Xcode compilation and iPhone execution | NOT RUN | No Apple SDK, `xcodebuild` or iPhone is available. Project generation is not a native build. |

Reproduce this specific project generation check without claiming compilation:

```sh
export SUPEREO_CORDOVA_BIN=/absolute/path/to/cordova-tools/node_modules/.bin/cordova
export SUPEREO_IOS_CHECK_DIR=/tmp/supereo-ios-project-new
bash tools/native-check/ios-project.sh
```

The script uses the supported Cordova iOS 8.1.1 installation route and refuses to overwrite an existing generated app. Compiling the resulting project still requires macOS/Xcode and the game's own signing configuration. This generated generic Cordova host is separate from a Construct editor export.

## Automatic native restoration: 6 October 2026 (Europe/Paris)

Addon 1.0.2 declares the native bridge with `AddCordovaPluginReference`. A fresh
actual Cordova CLI 13 / iOS 8.1.1 host restored the public immutable HTTPS tarball
from `config.xml` during ordinary platform preparation, without a manual
plugin-add command. The native bridge remains version 1.0.0.

The reproducible check captures the shipping editor script's dependency through
the SDK host fixture and constructs the corresponding `<plugin>` reference in
the new host. **It does not run the Construct exporter.** It verifies the public
tarball's SHA-256 and npm lockfile SHA-512, matches native Swift/privacy/JS files
to the release, and checks native/JavaScript registration and Xcode source,
resource and framework phase membership. See the [raw CLI log](evidence/ios-auto-install.log)
and [structured result](evidence/ios-auto-install-result.json).

```sh
export SUPEREO_CORDOVA_BIN=/absolute/path/to/cordova-tools/node_modules/.bin/cordova
export SUPEREO_AUTO_IOS_CHECK_DIR=/tmp/supereo-ios-auto-new
bash tools/native-check/ios-auto-install.sh
```

Run `npm ci` for the locked checker dependencies first. The script refuses to
overwrite an existing generated app. Cordova's URL restoration also needs its
normal user npm cache to be writable; in this cloud instance that cache was
created with managed approval. No home-directory variable, installed library,
TLS trust or integrity verification was changed.

Xcode compilation and device startup/playback remain **NOT RUN**. Actual Construct
URL-spec export pass-through remains **NOT RUN**. The automatic metadata reference
does not establish Construct Build Service allowlist approval; that dependency
has not been approved.

## Reference toolchain

| Component | Actual version |
| --- | --- |
| Node | 24.19.0 |
| Cordova CLI | 13.0.0 |
| Cordova Android | 15.0.0 |
| JDK | Eclipse Temurin 17.0.16+8 |
| Android platform | API 36, SDK platform revision 2 |
| Android Build Tools | 36.0.0 |
| Gradle | 8.14.2 |
| Android Gradle Plugin | 8.10.1 |
| Host / ABI | Linux x86_64 |
| App minimum / target / compile SDK | 24 / 36 / 36 |
| Java source / target compatibility | 11 / 11 |

The minimum Android version for this documented external build route is Android 7.0 / API 24. The platform's own supported minimum is retained. Newer haptic features have additional API-level and hardware requirements.

All tooling was installed outside the source checkout in `/workspace/.supereo-tools`; generated hosts live under `/tmp`. The Google developer SDK license was accepted during this authorized development build. No signing keys for a production app, app-store credentials, or game-specific secrets were needed.

## Acquisition and integrity

HTTPS certificate verification and the configured cloud CA trust remained enabled. JDK and Gradle downloads matched their publishers' SHA-256 files. The Android command-line tools archive matched the checksum in Google's SDK repository metadata. `sdkmanager` installed platform/build-tools packages with its normal archive verification enabled. npm retained its normal package integrity checks.

| Download | Official source / checksum checked |
| --- | --- |
| JDK 17.0.16+8 | [Temurin release](https://github.com/adoptium/temurin17-binaries/releases/tag/jdk-17.0.16%2B8), `OpenJDK17U-jdk_x64_linux_hotspot_17.0.16_8.tar.gz.sha256.txt`: `166774efcf0f722f2ee18eba0039de2d685b350ee14d7b69e6f83437dafd2af1` |
| Gradle 8.14.2 | [Distribution SHA-256](https://services.gradle.org/distributions/gradle-8.14.2-bin.zip.sha256): `7197a12f450794931532469d4ff21a59ea2c1cd59a3ec3f89c035c3c420a6999` |
| Android command-line tools 19.0 | [Google SDK metadata](https://dl.google.com/android/repository/repository2-3.xml), archive `commandlinetools-linux-13114758_latest.zip`, published SHA-1: `5fdcc763663eefb86a5b8879697aa6088b041e70`; measured SHA-256: `7ec965280a073311c339e571cd5de778b9975026cfcbe79f2b1cdcb1e15317ee` |
| Platform API 36 r2 | [Google SDK metadata](https://dl.google.com/android/repository/repository2-3.xml), archive `platform-36_r02.zip`, published SHA-1: `2c1a80dd4d9f7d0e6dd336ec603d9b5c55a6f576` |
| Build Tools 36.0.0 | [Google SDK metadata](https://dl.google.com/android/repository/repository2-3.xml), archive `build-tools_r36_linux.zip`, published SHA-1: `b0b6376977657e8ad9b969bacf4093601da2c6fb` |

The installed, genuine `android-36/android.jar` SHA-256 was `d9eb9da824d9e247a352f570f01e1169e725b2954bca9e283a71786c59b59f9a`. `javap` against this jar confirmed the API 36 envelope method signatures used by the plugin; compilation then resolved those actual classes.

Current Android command-line tools 23.0 initially attempted to bootstrap a writable default home directory. Tools 19.0 and the documented `ANDROID_USER_HOME` override resolved this cloud filesystem constraint. Gradle's proxy properties and Java's existing `/etc/ssl/certs/java/cacerts` trust store were configured outside the repository. Trust verification was preserved.

## Reproduce the check

First build the source distribution as described in [BUILD.md](BUILD.md), which generates `native/cordova-plugin-supereo-haptics/www/core.js`. Install JDK 17, the Android platform/build tools listed above, Gradle 8.14.2 and Cordova CLI 13.0.0. For example, Cordova can be installed in a separate tool directory:

```sh
npm install --prefix /absolute/path/to/cordova-tools --no-audit --no-fund cordova@13.0.0
sdkmanager 'platforms;android-36' 'build-tools;36.0.0' 'platform-tools'
```

Review and accept the SDK license in your own development environment as needed. Set `ANDROID_USER_HOME` to a writable directory before using `sdkmanager` when the default home is restricted. Use the existing configured proxy and CA trust in managed environments.

From the source repository:

```sh
export JAVA_HOME=/absolute/path/to/jdk-17
export ANDROID_HOME=/absolute/path/to/android-sdk
export SUPEREO_CORDOVA_BIN=/absolute/path/to/cordova-tools/node_modules/.bin/cordova
export SUPEREO_GRADLE_BIN=/absolute/path/to/gradle-8.14.2/bin/gradle
export SUPEREO_NATIVE_CHECK_DIR=/tmp/supereo-native-check-new
bash tools/native-check/android.sh
bash tools/native-check/java-patterns.sh
```

The Android script refuses to overwrite an existing generated app. It installs the plugin through Cordova's supported local-directory route and invokes the real Gradle targets `:app:assembleDebug :app:bundleDebug :app:bundleRelease :app:lintDebug` with four workers. It checks that the installed Java source matches the source repository and parses lint's XML report for native Java errors. This matters because Cordova's template can report a successful lint Gradle task even when the report contains errors.

The Java algorithm script downloads checksum-verified `org.json:json:20240303`, compiles the supplied `PatternChecks.java`, and runs 26 assertions against the actual compiled native implementation. It checks malformed patterns, limits, amplitude mapping, zero strength, overlapping events, timeline duration and curve interpolation. The independent JSON implementation is first on the JVM classpath because Android's SDK JSON methods are compile-time platform stubs. These are host-side tests of pure algorithms; no vibrator, Activity, Android device or Android emulator is invoked.

APK/AAB checksums and the native source checksum are recorded in the generated `result.json`. A debug APK and debug AAB use a temporary development key; the release AAB is unsigned and needs the game's own release signing configuration before distribution. Temporary development artifact hashes can differ when rebuilt and are not promised to be reproducible byte for byte.

## Unavailable verification

| Requested check | Status | Reason |
| --- | --- | --- |
| Supported iPhone / UIKit and Core Haptics execution | NOT RUN | No iPhone or macOS/Xcode host is attached. |
| Swift / iOS native compilation and actual Construct Xcode-project export | NOT RUN | Linux host has no Swift compiler, Apple SDK or `xcodebuild`; Construct editor is unavailable. The separate Cordova project generation check above is not native compilation or a Construct export. |
| Advanced Android / basic Android / hardware without haptics | NOT RUN | No physical Android device or emulator is attached. SDK compilation does not prove hardware output. |
| Native background/resume, engine interruptions, rapid repeats, cancellation, disabled/strength settings | NOT RUN on devices | Device runtime behavior requires the above hardware; host tests are reported separately. |
| Construct r495.2 editor import and actual Worker Auto / Off exports | NOT RUN | The editor is unavailable in this environment. Runtime/DOM host tests are covered in [TEST-REPORT.md](TEST-REPORT.md). |
| Construct Build Service | UNVERIFIED / NOT RUN | Approval and a build of this exact native package/version have not been established. Use [the external Cordova instructions](INSTALLATION.md). |

Run the real-device matrix in [TEST-REPORT.md](TEST-REPORT.md) before shipping. Dispatch acceptance and elapsed scheduling estimates do not prove that hardware physically produced an effect.
