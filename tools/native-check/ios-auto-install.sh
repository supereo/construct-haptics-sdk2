#!/usr/bin/env bash
# Real Cordova auto-restoration check using the addon declaration captured in a host SDK fixture.
# Config XML is constructed here; this does not run the Construct exporter or Xcode.
set -euo pipefail
repo_root=${SUPEREO_SOURCE_ROOT:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)}
check_root=${SUPEREO_AUTO_IOS_CHECK_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/supereo-ios-auto.XXXXXX")}
cordova_bin=${SUPEREO_CORDOVA_BIN:-$(command -v cordova || true)}
test -x "$cordova_bin" || { echo 'Install Cordova CLI 13.0.0 or set SUPEREO_CORDOVA_BIN.' >&2; exit 1; }
test ! -e "$check_root/app" || { echo "Refusing to overwrite $check_root/app" >&2; exit 1; }
mkdir -p "$check_root/config" "$check_root/cache" "$check_root/npm-cache"
export CI=1 CORDOVA_TELEMETRY_OFF=1
export XDG_CONFIG_HOME="$check_root/config" XDG_CACHE_HOME="$check_root/cache"
export npm_config_cache=${npm_config_cache:-$check_root/npm-cache}
node - "$repo_root" "$check_root" <<'JS'
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const [repo,check]=process.argv.slice(2);
const {captureAddonRegistration}=require(path.join(repo,'tests/helpers/construct-loader.cjs'));
const refs=captureAddonRegistration().cordovaPluginReferences;
if(refs.length!==1 || refs[0].length!==1)throw new Error('Expected one addon Cordova native package reference.');
const reference=refs[0][0];
if(reference.id!=='cordova-plugin-supereo-haptics'||!['all',undefined].includes(reference.platform))throw new Error('Unexpected package identity or platform.');
if(reference.version!=='https://raw.githubusercontent.com/supereo/construct-haptics-sdk2/d15c7d1b0ec1300b85a7970fa23a773ed7e1f1fd/dist/cordova-plugin-supereo-haptics-1.0.0.tgz')throw new Error('Native package pin changed; update and review this verification target.');
fs.writeFileSync(path.join(check,'declaration.json'),JSON.stringify({reference,source:'Shipping addon/plugin.js AddCordovaPluginReference call captured in a host SDK VM fixture; not a Construct editor export.',addonEditorSourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,'addon/plugin.js'))).digest('hex')},null,2)+'\n');
fs.writeFileSync(path.join(check,'native-url.txt'),reference.version+'\n');
JS
native_url=$(cat "$check_root/native-url.txt")
curl --fail --location --silent --show-error "$native_url" -o "$check_root/native-package.tgz"
python3 - "$check_root/native-package.tgz" <<'PY'
import hashlib,pathlib,sys
assert hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest()=='e2662681fc0b2434a1af13beafd28739b9b68d078a05acc75fcb23201593e25d','Published native package checksum mismatch.'
print('PASS: pinned native tarball SHA-256 matches the published release checksum.')
PY
"$cordova_bin" create "$check_root/app" com.supereo.haptics.auto SupereoHapticsAuto --no-telemetry
python3 - "$check_root" <<'PY'
import json,pathlib,sys,xml.sax.saxutils
root=pathlib.Path(sys.argv[1]);ref=json.loads((root/'declaration.json').read_text())['reference']
p=root/'app/config.xml'
tag='    <plugin name='+xml.sax.saxutils.quoteattr(ref['id'])+' spec='+xml.sax.saxutils.quoteattr(ref['version'])+' />\n'
s=p.read_text().replace('</widget>',tag+'</widget>');p.write_text(s);(root/'config-before-prepare.xml').write_text(s)
PY
cd "$check_root/app"
"$cordova_bin" platform add ios@8.1.1 --no-telemetry
"$cordova_bin" prepare ios --no-telemetry
"$cordova_bin" plugin list --no-telemetry
python3 - "$check_root" "$repo_root" <<'PY'
import base64,hashlib,json,pathlib,plistlib,re,sys,tarfile,xml.etree.ElementTree as ET
root,repo=map(pathlib.Path,sys.argv[1:]);platform=root/'app/platforms/ios';declaration=json.loads((root/'declaration.json').read_text());ref=declaration['reference'];tgz=root/'native-package.tgz'
with tarfile.open(tgz) as archive:
 expected_swift=archive.extractfile('package/src/ios/SupereoHaptics.swift').read()
 expected_privacy=archive.extractfile('package/src/ios/SupereoHaptics.bundle/PrivacyInfo.xcprivacy').read()
 expected_bridge=archive.extractfile('package/www/SupereoHaptics.js').read()
 metadata=json.loads(archive.extractfile('package/package.json').read())
assert metadata['name']==metadata['cordova']['id']==ref['id'] and metadata['version']=='1.0.0'
assert expected_swift==(repo/'native/cordova-plugin-supereo-haptics/src/ios/SupereoHaptics.swift').read_bytes()
assert expected_privacy==(repo/'native/cordova-plugin-supereo-haptics/src/ios/SupereoHaptics.bundle/PrivacyInfo.xcprivacy').read_bytes()
assert expected_bridge==(repo/'native/cordova-plugin-supereo-haptics/www/SupereoHaptics.js').read_bytes()
swift=next(p for p in platform.rglob('SupereoHaptics.swift') if p.read_bytes()==expected_swift)
privacy=next(p for p in platform.rglob('SupereoHaptics.bundle/PrivacyInfo.xcprivacy') if p.read_bytes()==expected_privacy)
bridge=platform/'www/plugins/cordova-plugin-supereo-haptics/www/SupereoHaptics.js';bridge_text=bridge.read_text()
assert expected_bridge==(root/'app/node_modules/cordova-plugin-supereo-haptics/www/SupereoHaptics.js').read_bytes()
assert expected_bridge.decode() in bridge_text and bridge_text.startswith('cordova.define("cordova-plugin-supereo-haptics.SupereoHaptics",')
assert 'SERVICE = "SupereoHaptics"' in bridge_text and '@objc(SupereoHaptics)' in swift.read_text()
pbx=next(p for p in platform.rglob('project.pbxproj') if 'SupereoHaptics.swift in Sources' in p.read_text());text=pbx.read_text()
for item,phase in (('SupereoHaptics.swift in Sources','PBXSourcesBuildPhase'),('SupereoHaptics.bundle in Resources','PBXResourcesBuildPhase'),('UIKit.framework in Frameworks','PBXFrameworksBuildPhase'),('CoreHaptics.framework in Frameworks','PBXFrameworksBuildPhase')):
 build_id=re.search(r'([A-F0-9]{24}) /\* '+re.escape(item)+r' \*/ = \{isa = PBXBuildFile;',text).group(1)
 phase_contents=re.search(r'/\* Begin '+phase+r' section \*/(.*?)/\* End '+phase+r' section \*/',text,re.S).group(1)
 assert build_id in phase_contents
feature=False
for config in platform.rglob('config.xml'):
 for node in ET.parse(config).getroot().iter():
  if node.tag.split('}')[-1]=='feature' and node.get('name')=='SupereoHaptics': feature|=any(p.get('name')=='ios-package' and p.get('value')=='SupereoHaptics' for p in node)
assert feature
assert 'cordova.plugins.SupereoHaptics' in (platform/'www/cordova_plugins.js').read_text()
installed=json.loads((root/'app/plugins/ios.json').read_text())['installed_plugins'];assert ref['id'] in installed
lock=json.loads((root/'app/package-lock.json').read_text())['packages']['node_modules/'+ref['id']]
expected_integrity='sha512-'+base64.b64encode(hashlib.sha512(tgz.read_bytes()).digest()).decode()
assert lock['resolved']==ref['version'] and lock['integrity']==expected_integrity
assert plistlib.loads(privacy.read_bytes())['NSPrivacyTracking'] is False
result={'status':'PASS','scope':'Real Cordova iOS 8.1.1 automatic URL-tarball dependency restoration and generated project inclusion. Config.xml was constructed from the shipping addon AddCordovaPluginReference declaration captured in a host SDK fixture; no actual Construct exporter, Xcode compilation or device execution.','explicitPluginAddCommandUsed':False,'declaration':declaration,'nativePackageSha256':hashlib.sha256(tgz.read_bytes()).hexdigest(),'npmLockIntegrity':lock['integrity'],'nativeSwiftSha256':hashlib.sha256(expected_swift).hexdigest(),'privacyResourceSha256':hashlib.sha256(expected_privacy).hexdigest(),'nativeJavascriptSha256':hashlib.sha256(expected_bridge).hexdigest(),'cordovaIOS':'8.1.1','nativeFeature':'SupereoHaptics','javascriptClobber':'cordova.plugins.SupereoHaptics','linkedFrameworks':['UIKit.framework','CoreHaptics.framework'],'nativeSourceBuildPhase':True,'privacyResourceBuildPhase':True,'constructEditorExport':'NOT RUN: Construct editor unavailable.','xcodeCompilation':'NOT RUN: Linux has no Apple SDK or xcodebuild.','buildServiceApproval':'UNVERIFIED: native dependency allowlist approval not established.'}
(root/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
PY
