#!/usr/bin/env bash
# Execute pure Java algorithms from the actual native plugin; no vibration APIs.
set -euo pipefail
repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
: "${SUPEREO_NATIVE_CHECK_DIR:?Set SUPEREO_NATIVE_CHECK_DIR to a successful tools/native-check/android.sh output directory.}"
: "${JAVA_HOME:?Set JAVA_HOME to a JDK 17 installation.}"
: "${ANDROID_HOME:?Set ANDROID_HOME to the Android SDK used for the build.}"
check_root=$SUPEREO_NATIVE_CHECK_DIR
test -f "$check_root/result.json"
mkdir -p "$check_root/jvm-tests" "$check_root/test-dependencies"
json_jar="$check_root/test-dependencies/json-20240303.jar"
curl --fail --location --silent --show-error https://repo.maven.apache.org/maven2/org/json/json/20240303/json-20240303.jar -o "$json_jar"
curl --fail --location --silent --show-error https://repo.maven.apache.org/maven2/org/json/json/20240303/json-20240303.jar.sha1 -o "$json_jar.sha1"
python3 - "$json_jar" <<'PY'
import hashlib, pathlib, sys
p = pathlib.Path(sys.argv[1])
assert hashlib.sha1(p.read_bytes()).hexdigest() == pathlib.Path(str(p) + '.sha1').read_text().strip(), 'Maven artifact checksum mismatch.'
print('PASS: Maven Central org.json 20240303 published artifact checksum.')
PY
classpath="$json_jar:$check_root/jvm-tests:$check_root/app/platforms/android/app/build/intermediates/javac/debug/compileDebugJavaWithJavac/classes:$check_root/app/platforms/android/CordovaLib/build/intermediates/javac/debug/compileDebugJavaWithJavac/classes:$ANDROID_HOME/platforms/android-36/android.jar"
"$JAVA_HOME/bin/javac" -cp "$classpath" -d "$check_root/jvm-tests" "$repo_root/native/cordova-plugin-supereo-haptics/tests/android/PatternChecks.java"
"$JAVA_HOME/bin/java" -cp "$classpath" com.supereo.haptics.PatternChecks | tee "$check_root/java-patterns.log"
