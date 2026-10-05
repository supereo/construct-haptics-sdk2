# Release notes

## Addon 1.0.1 / native bridge 1.0.0

Fixes this Construct export/bundle failure reported for addon 1.0.0:

```text
[plugin: file-map-resolver] path 'scripts/plugins/Supereo_Haptics/c3runtime/haptics-core.js' not found
```

Listing a file in the addon archive does not register it as an additional runtime
script. The original helper was imported by `main.js` and listed as a DOM-side
script, without the required runtime registration. Earlier host tests preloaded
the helper and skipped import resolution, so they missed this build failure.

The build now embeds the browser-only validator in the default runtime
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
