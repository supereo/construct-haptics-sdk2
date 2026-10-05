#!/usr/bin/env bash
# Generate and inspect a real Cordova iOS project. Never calls Xcode or claims compilation.
set -euo pipefail
repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
check_root=${SUPEREO_IOS_CHECK_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/supereo-ios-project.XXXXXX")}
cordova_bin=${SUPEREO_CORDOVA_BIN:-$(command -v cordova || true)}
test -x "$cordova_bin" || { echo 'Install Cordova CLI 13.0.0 or set SUPEREO_CORDOVA_BIN.' >&2; exit 1; }
test ! -e "$check_root/app" || { echo "Refusing to overwrite existing $check_root/app" >&2; exit 1; }
test -f "$repo_root/native/cordova-plugin-supereo-haptics/www/core.js"
mkdir -p "$check_root/config" "$check_root/cache" "$check_root/npm-cache"
export CI=1 CORDOVA_TELEMETRY_OFF=1
export XDG_CONFIG_HOME="$check_root/config" XDG_CACHE_HOME="$check_root/cache"
export npm_config_cache=${npm_config_cache:-$check_root/npm-cache}
"$cordova_bin" create "$check_root/app" com.supereo.haptics.smoke SupereoHapticsSmoke --no-telemetry
mv "$check_root/app/www" "$check_root/app/www.cordova-placeholder"
node "$repo_root/tools/create-demo-host.cjs" "$check_root/app/www"
cd "$check_root/app"
"$cordova_bin" platform add ios@8.1.1 --no-telemetry
"$cordova_bin" plugin add "$repo_root/native/cordova-plugin-supereo-haptics" --no-telemetry
"$cordova_bin" prepare ios --no-telemetry
python3 - "$check_root" "$repo_root" <<'PY'
import hashlib, json, pathlib, plistlib, re, sys, xml.etree.ElementTree as ET
root, repo = map(pathlib.Path, sys.argv[1:])
platform = root / 'app/platforms/ios'
native = repo / 'native/cordova-plugin-supereo-haptics'
swift_source = native / 'src/ios/SupereoHaptics.swift'
privacy_source = native / 'src/ios/SupereoHaptics.bundle/PrivacyInfo.xcprivacy'
swift_copies = [p for p in platform.rglob('SupereoHaptics.swift') if p.read_bytes() == swift_source.read_bytes()]
privacy_copies = [p for p in platform.rglob('SupereoHaptics.bundle/PrivacyInfo.xcprivacy') if p.read_bytes() == privacy_source.read_bytes()]
assert swift_copies, 'Actual plugin Swift source was not included in the generated iOS project.'
assert privacy_copies, 'Actual plugin privacy resource was not included in the generated iOS project.'
pbx = next(p for p in platform.rglob('project.pbxproj') if 'SupereoHaptics.swift in Sources' in p.read_text())
text = pbx.read_text()
for item in ('SupereoHaptics.swift in Sources', 'SupereoHaptics.bundle in Resources', 'UIKit.framework in Frameworks', 'CoreHaptics.framework in Frameworks', 'SWIFT_VERSION = 5.0'):
    assert item in text, 'Missing Xcode project registration: ' + item
for item, phase in (('SupereoHaptics.swift in Sources', 'PBXSourcesBuildPhase'), ('SupereoHaptics.bundle in Resources', 'PBXResourcesBuildPhase'), ('UIKit.framework in Frameworks', 'PBXFrameworksBuildPhase'), ('CoreHaptics.framework in Frameworks', 'PBXFrameworksBuildPhase')):
    build_id = re.search(r'([A-F0-9]{24}) /\* ' + re.escape(item) + r' \*/ = \{isa = PBXBuildFile;', text).group(1)
    phase_contents = re.search(r'/\* Begin ' + phase + r' section \*/(.*?)/\* End ' + phase + r' section \*/', text, re.S).group(1)
    assert build_id in phase_contents, 'Build-file entry is not connected to its build phase: ' + item
feature_registered = False
for config in platform.rglob('config.xml'):
    document = ET.parse(config).getroot()
    for feature in document.iter():
        if feature.tag.split('}')[-1] == 'feature' and feature.get('name') == 'SupereoHaptics':
            feature_registered |= any(param.get('name') == 'ios-package' and param.get('value') == 'SupereoHaptics' for param in feature)
assert feature_registered, 'Cordova native feature namespace was not registered.'
assert '@objc(SupereoHaptics)' in swift_source.read_text(), 'Swift Objective-C runtime class namespace differs.'
privacy = plistlib.loads(privacy_copies[0].read_bytes())
assert privacy.get('NSPrivacyTracking') is False and privacy.get('NSPrivacyCollectedDataTypes') == []
loader_files = list(platform.rglob('cordova_plugins.js'))
assert any('cordova.plugins.SupereoHaptics' in p.read_text() for p in loader_files), 'Cordova JavaScript clobber registration is missing.'
assert (platform / 'www/index.html').is_file(), 'Prepared generic demo entrypoint is missing.'
assert 'cordova.js' in (platform / 'www/index.html').read_text()
result = {'status': 'PASS', 'scope': 'Real Cordova iOS project generation, native plugin installation, preparation and project-file inclusion checks only. No Swift/Xcode compilation or device execution.', 'cordovaIOS': '8.1.1', 'nativeSwiftSourceSha256': hashlib.sha256(swift_source.read_bytes()).hexdigest(), 'privacyResourceSha256': hashlib.sha256(privacy_source.read_bytes()).hexdigest(), 'xcodeProject': str(pbx.relative_to(root)), 'swiftIncluded': [str(p.relative_to(root)) for p in swift_copies], 'privacyIncluded': [str(p.relative_to(root)) for p in privacy_copies], 'nativeFeature': 'SupereoHaptics', 'javascriptClobber': 'cordova.plugins.SupereoHaptics', 'linkedFrameworks': ['UIKit.framework', 'CoreHaptics.framework'], 'swiftVersion': '5.0', 'genericDemoPrepared': True, 'xcodeCompilation': 'NOT RUN: Linux host has no Apple SDK or xcodebuild.'}
(root / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
PY
