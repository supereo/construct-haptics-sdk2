#!/usr/bin/env bash
# Build an isolated real Cordova host. Does not use Android/Cordova stubs.
set -euo pipefail

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
check_root=${SUPEREO_NATIVE_CHECK_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/supereo-native-check.XXXXXX")}
cordova_bin=${SUPEREO_CORDOVA_BIN:-$(command -v cordova || true)}
gradle_bin=${SUPEREO_GRADLE_BIN:-$(command -v gradle || true)}
: "${JAVA_HOME:?Set JAVA_HOME to a JDK 17 installation.}"
: "${ANDROID_HOME:?Set ANDROID_HOME to an Android SDK with platform 36 and build-tools 36.0.0.}"
test -x "$JAVA_HOME/bin/javac"
test -f "$ANDROID_HOME/platforms/android-36/android.jar"
test -x "$ANDROID_HOME/build-tools/36.0.0/aapt2"
test -x "$cordova_bin" || { echo 'Install Cordova CLI 13.0.0 or set SUPEREO_CORDOVA_BIN.' >&2; exit 1; }
test -x "$gradle_bin" || { echo 'Install Gradle 8.14.2 or set SUPEREO_GRADLE_BIN.' >&2; exit 1; }
test -f "$repo_root/native/cordova-plugin-supereo-haptics/www/core.js" || {
  echo 'Run npm ci and npm run build in the source repository first.' >&2; exit 1;
}
test ! -e "$check_root/app" || { echo "Refusing to overwrite existing $check_root/app" >&2; exit 1; }
mkdir -p "$check_root/config" "$check_root/cache" "$check_root/android-user" "$check_root/npm-cache"
export CI=1 CORDOVA_TELEMETRY_OFF=1
export XDG_CONFIG_HOME="$check_root/config" XDG_CACHE_HOME="$check_root/cache"
export ANDROID_USER_HOME="$check_root/android-user"
export npm_config_cache=${npm_config_cache:-$check_root/npm-cache}
export PATH="$JAVA_HOME/bin:$(dirname "$gradle_bin"):$PATH"

printf 'Isolated native build: %s\n' "$check_root"
"$cordova_bin" --version
"$JAVA_HOME/bin/javac" -version
"$gradle_bin" --version
"$cordova_bin" create "$check_root/app" com.supereo.haptics.smoke SupereoHapticsSmoke --no-telemetry
cd "$check_root/app"
"$cordova_bin" platform add android@15.0.0 --no-telemetry
"$cordova_bin" plugin add "$repo_root/native/cordova-plugin-supereo-haptics" --no-telemetry
"$cordova_bin" prepare android --no-telemetry
cd platforms/android
"$gradle_bin" --no-daemon --console=plain --max-workers=4 :app:assembleDebug :app:bundleDebug :app:bundleRelease :app:lintDebug 2>&1 | tee "$check_root/gradle.log"
python3 - "$check_root" "$repo_root" <<'PY'
import hashlib, json, pathlib, sys, xml.etree.ElementTree as ET
root = pathlib.Path(sys.argv[1])
repo = pathlib.Path(sys.argv[2])
native_source = repo / 'native/cordova-plugin-supereo-haptics/src/android/SupereoHaptics.java'
installed_source = root / 'app/platforms/android/app/src/main/java/com/supereo/haptics/SupereoHaptics.java'
assert native_source.read_bytes() == installed_source.read_bytes(), 'Native source changed during build; reinstall and rebuild before reporting PASS.'
lint_path = root / 'app/platforms/android/app/build/reports/lint-results-debug.xml'
lint_issues = ET.parse(lint_path).getroot().findall('issue')
native_errors = [issue for issue in lint_issues if issue.get('severity') in ('Error', 'Fatal') and any('/com/supereo/haptics/' in loc.get('file', '') for loc in issue.findall('location'))]
assert not native_errors, 'Android native lint errors: ' + ', '.join(issue.get('id', '?') for issue in native_errors)
artifacts = []
for suffix in ('*.apk', '*.aab'):
    for path in sorted((root / 'app/platforms/android/app/build/outputs').rglob(suffix)):
        artifacts.append({'path': str(path.relative_to(root)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size})
assert any(a['path'].endswith('.apk') for a in artifacts), 'No APK generated.'
assert any(a['path'].endswith('release.aab') for a in artifacts), 'No release AAB generated.'
result = {'status': 'PASS', 'scope': 'Real Cordova host native compilation and Android APK/AAB packaging; no device execution.', 'cordovaAndroid': '15.0.0', 'compileSdk': 36, 'nativeSourceSha256': hashlib.sha256(native_source.read_bytes()).hexdigest(), 'nativeLintErrors': len(native_errors), 'lintIssueCount': len(lint_issues), 'artifacts': artifacts}
(root / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
PY
