#!/usr/bin/env python3
"""Check Swift grammar and the privacy plist; this is not an Apple compiler test.

The parser is optional by default. To reproduce the recorded syntax check:
    python3 -m pip install --no-input --target /tmp/supereo-ios-parser tree-sitter-language-pack==0.13.0 tree-sitter==0.26.0
    PYTHONPATH=/tmp/supereo-ios-parser python3 tools/native-check/ios-syntax.py --require-parser

No native SDK, compiler, simulator, device, or network request is used by this script.
"""

import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import plistlib


PARSER_PACKAGE = "tree-sitter-language-pack"
PARSER_VERSION = "0.13.0"
ROOT = Path(__file__).resolve().parents[2]
SWIFT_PATH = "native/cordova-plugin-supereo-haptics/src/ios/SupereoHaptics.swift"
PLIST_PATH = "native/cordova-plugin-supereo-haptics/src/ios/SupereoHaptics.bundle/PrivacyInfo.xcprivacy"


def file_evidence(relative_path):
    content = (ROOT / relative_path).read_bytes()
    return content, {
        "path": relative_path,
        "sha256": hashlib.sha256(content).hexdigest(),
        "bytes": len(content),
    }


def swift_syntax(content):
    try:
        from tree_sitter_language_pack import get_parser
    except ImportError:
        return {
            "status": "NOT RUN",
            "reason": "Optional pinned tree-sitter-language-pack 0.13.0 is not installed.",
        }
    try:
        installed = importlib.metadata.version(PARSER_PACKAGE)
        if installed != PARSER_VERSION:
            return {
                "status": "FAIL",
                "reason": f"Use pinned {PARSER_PACKAGE}=={PARSER_VERSION}; found {installed}.",
            }
        tree = get_parser("swift").parse(content)
        errors = []
        missing_count = 0
        stack = [tree.root_node]
        while stack:
            node = stack.pop()
            if node.is_missing:
                missing_count += 1
            if node.type == "ERROR" or node.is_missing:
                errors.append({
                    "type": node.type,
                    "missing": node.is_missing,
                    "line": node.start_point[0] + 1,
                    "column": node.start_point[1] + 1,
                    "excerpt": content[node.start_byte:node.end_byte].decode("utf-8", errors="replace")[:160],
                })
            stack.extend(reversed(node.children))
        return {
            "status": "FAIL" if tree.root_node.has_error else "PASS",
            "parserPackage": PARSER_PACKAGE,
            "parserVersion": installed,
            "treeSitterRuntimeVersion": importlib.metadata.version("tree-sitter"),
            "language": "swift",
            "errorNodes": len(errors) - missing_count,
            "missingNodes": missing_count,
            "issues": errors,
        }
    except Exception as error:
        return {"status": "FAIL", "reason": str(error)}


def privacy_plist(content):
    try:
        manifest = plistlib.loads(content)
        expected = {
            "NSPrivacyTracking": False,
            "NSPrivacyTrackingDomains": [],
            "NSPrivacyCollectedDataTypes": [],
            "NSPrivacyAccessedAPITypes": [],
        }
        if manifest != expected:
            return {"status": "FAIL", "reason": "Privacy manifest differs from the no-data/no-tracking declaration."}
        return {"status": "PASS", "format": "Apple XML property list", "declaration": expected}
    except Exception as error:
        return {"status": "FAIL", "reason": str(error)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-parser", action="store_true", help="Fail if the optional pinned Swift parser is unavailable.")
    parser.add_argument("--output", default="docs/evidence/ios-syntax-result.json", help="Evidence JSON path, relative to the repository or absolute.")
    args = parser.parse_args()

    swift, source_evidence = file_evidence(SWIFT_PATH)
    plist, manifest_evidence = file_evidence(PLIST_PATH)
    result = {
        "scope": "Swift syntax and privacy plist validation only",
        "source": source_evidence,
        "privacyManifest": manifest_evidence,
        "checks": {
            "swiftSyntax": swift_syntax(swift),
            "privacyPlist": privacy_plist(plist),
            "appleSDKTypecheck": {"status": "NOT RUN", "reason": "No Xcode/Apple SDK typechecking is performed by this script."},
            "nativeCompilation": {"status": "NOT RUN", "reason": "No Swift compiler or Xcode build is performed by this script."},
            "deviceTests": {"status": "NOT RUN", "reason": "No physical Apple device is exercised by this script."},
        },
    }
    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    for name, check in result["checks"].items():
        print(f"{name}: {check['status']}" + (f" — {check['reason']}" if "reason" in check else ""))
    print(f"Swift SHA-256: {source_evidence['sha256']}")
    print(f"Evidence: {output}")
    failed = any(check["status"] == "FAIL" for check in result["checks"].values())
    skipped_required_parser = args.require_parser and result["checks"]["swiftSyntax"]["status"] == "NOT RUN"
    return 1 if failed or skipped_required_parser else 0


if __name__ == "__main__":
    raise SystemExit(main())
