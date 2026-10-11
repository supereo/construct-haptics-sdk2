# Review-only Build Service approval draft

**Not submitted. No npm publication or external message was performed.** This is optional future hosted-service research; the chosen **Construct Cordova export → local Cordova build** route needs no Scirra approval or native npm publication. The draft concerns **native package 1.0.0**, not addon release 1.0.3. It is incomplete for submission while npm publication and unavailable iOS/device pretests remain outstanding.

**Distribution correction:** the repository is confirmed private. Its raw package URL is not publicly accessible to the user or prospective reviewers. An accessible native-package host must be established; the earlier managed-environment retrieval was not an anonymous-public-access check.

## Proposed title

Build Service allowlist review: cordova-plugin-supereo-haptics 1.0.0 (Android/iOS)

## Proposed request body

Please review **`cordova-plugin-supereo-haptics@1.0.0`** for Construct's hosted mobile Build Service once the exact package has been published to npm. It supplies haptic-only feedback for Construct games: selection ticks, impacts, success/warning/error cues and bounded custom patterns. It is the native companion to the reusable **Supereo_Haptics** Addon SDK v2 extension. It is not derived from or dependent on a different haptics plugin.

| Review item | Exact package detail |
| --- | --- |
| Intended npm identity | `cordova-plugin-supereo-haptics@1.0.0`; registry endpoint currently returns 404, so this is not yet a published registry identity. |
| License | MIT, included in the package. |
| Immutable reviewed source | [Native source at commit d15c7d1b0ec1300b85a7970fa23a773ed7e1f1fd](https://github.com/supereo/construct-haptics-sdk2/tree/d15c7d1b0ec1300b85a7970fa23a773ed7e1f1fd/native/cordova-plugin-supereo-haptics). |
| Reviewed package | [Private-repository native TGZ](https://raw.githubusercontent.com/supereo/construct-haptics-sdk2/d15c7d1b0ec1300b85a7970fa23a773ed7e1f1fd/dist/cordova-plugin-supereo-haptics-1.0.0.tgz). This is a locally verified package artifact; the URL requires repository access and is not npm publication. |
| Package SHA-256 | `e2662681fc0b2434a1af13beafd28739b9b68d078a05acc75fcb23201593e25d`. |
| Source/package identity | Nine files; retrieved tarball matches current native source byte for byte. Its `plugin.xml` also matches the pinned source manifest. |
| Supported platforms | Android and iOS. |
| Platform constraints | Cordova Android **15.0.0+**, JDK **17**, compile SDK **36**, minimum device API **24**; Cordova iOS **8.0.0+**, Swift **5**, minimum iOS **13**. |
| Native dependencies | UIKit and CoreHaptics system frameworks on iOS; standard public Android APIs. No third-party framework/pod/NDK dependency. |
| Other dependencies/scripts | No npm runtime dependencies, Cordova `<dependency>`, plugin hook, `.gradle` file or pre/post-install script in this native package. |
| Permission | Android normal `android.permission.VIBRATE` only; no runtime permission dialog. No iOS haptics permission. |
| Native registration | JS namespace `cordova.plugins.SupereoHaptics`; native service `SupereoHaptics`; Android class `com.supereo.haptics.SupereoHaptics`; iOS class `SupereoHaptics`. |
| Privacy/audio | No analytics, identifiers, network requests or data transmission; iOS privacy resource declares no tracking/collected data. Haptic-only patterns; no synthesized audio. |

Android uses appropriate settings-respecting semantic feedback, supported predefined effects/primitives, and amplitude waveforms. API 36 envelopes are guarded by API level and positive hardware support/limit checks. Unsupported routes have documented approximations; no identical output across devices is promised. iOS uses cached UIKit selection/impact/notification generators and Core Haptics on supported hardware, with engine lifecycle handling. Portable patterns are bounded to 64 events and 10 seconds, with at most 32 points per parameter curve. Dispatch acceptance is not a sensed hardware-completion callback.

Available validation is documented in [NATIVE-CHECKS.md](NATIVE-CHECKS.md) and [TEST-REPORT.md](TEST-REPORT.md). An isolated genuine Cordova Android 15/API 36/JDK 17 host compiled debug/release Java, produced APK/AAB artifacts and passed lint with zero native errors. Twenty-six pure-Java validator/waveform assertions passed. iOS project generation, Swift source/framework/privacy membership and syntax parsing passed. **Xcode typechecking/compilation and physical Android/iPhone haptic tests are NOT RUN.** Host fixtures and syntax checks are not evidence of native device functionality. We understand the published requirement to test that plugins work before requesting review; these gaps must remain disclosed and resolved before claiming a fully pretested submission.

Please confirm that the hosted service supports the platform/toolchain constraints above, and review the eventual exact npm package/version. The proposed service declaration after publication/approval is:

```js
this._info.AddCordovaPluginReference({
    id: "cordova-plugin-supereo-haptics",
    version: "1.0.0",
    platform: "all"
});
```

The current addon instead pins the reviewed HTTPS TGZ. Ordinary Cordova restoration from that URL passed, but **hosted-service URL-spec acceptance is not established**. We do not claim that the current URL bypasses npm publication or allowlisting. A working direct Construct export must verify the approved declaration and native package/version actually included by the service. Any other custom addon in the game has its own separate approval requirements.

## Evidence for the gate

- [Current official SDK dependency guide](https://www.construct.net/en/make-games/manuals/addon-sdk/reference/specifying-dependencies): arbitrary Cordova plugins are restricted; approval requires a tracker issue and security review and is not guaranteed.
- [Official compatibility guidance and published list](https://www.construct.net/en/forum/construct-3/plugin-sdk-10/build-server-cordova-plugin-149266#forumPost996517): requests need npm ID/version; all dependencies/sub-dependencies are reviewed; pretest functionality and avoid complex build/install scripts. The published list says last updated **7 July 2026**, contains no Supereo entry and may lag current service configuration.
- [Scirra #6368](https://github.com/Scirra/Construct-bugs/issues/6368#issuecomment-1369771034): npm publication is required for the hosted service. [#6394](https://github.com/Scirra/Construct-bugs/issues/6394#issuecomment-1385298128) records approval after publication.
- [Scirra #9027, April 2026](https://github.com/Scirra/Construct-bugs/issues/9027#issuecomment-4250884807): only the specified version was added; updates need a new request.

These are concrete public requirements and precedents, not a guarantee of approval or an exhaustive private checklist. No live internal allowlist or exact Supereo rejection was observed. Current registry 404 is an unmet prerequisite, and exact approval remains unestablished. The review draft does not satisfy either gate itself.
