# `@tonbankcard/mobile-app`

React Native wrapper for [`@tonbankcard/mobile-core`](../mobile/). Provides
the iOS and Android end-user experience for the TONBANKCARD non-custodial
protocol.

> **Issue:** [#137 — F2 Mobile App Wrapper](https://github.com/xlabtg/tonbankcard-protocol/issues/137)
>
> **Non-custodial guarantee:** this package NEVER stores, transmits, or
> observes user private keys. All transaction signing happens inside the
> user's wallet via TON Connect.

## Structure

```
mobile-app/
├── App.tsx                      Root navigator entrypoint
├── src/
│   ├── lib/                     Platform-agnostic core (typecheckable in Node-only CI)
│   │   ├── config.ts            HTTPS validation, certificate-pin schema, default configs
│   │   ├── network/             HttpsClient with certificate-pinning hook
│   │   ├── secure/              SecureKeyValueStore + biometric interfaces, in-memory test store
│   │   ├── services/            AccountFacade, PaymentFacade, SyncFacade (wrap mobile-core)
│   │   ├── tonconnect/          Mobile TON Connect session manager + deep-link helpers
│   │   └── utils/               format helpers + QR-payload parser
│   ├── navigation/AppNavigator  Native-stack route table
│   └── screens/                 Home, SendPayment, ReceivePayment, History, Settings
├── ios/                         iOS native stub (Info.plist, Podfile, README)
├── android/                     Android native stub (build.gradle, manifest, README)
├── tests/                       Node-only Jest suites (65 tests)
├── types/                       Local React Native type stubs (so CI does not install RN)
├── tsconfig.json                Full RN scope (used by app builds)
└── tsconfig.lib.json            Lib-only scope (used by `npm run typecheck` in CI)
```

## Security posture

| Control                       | Where                                                         |
| ----------------------------- | -------------------------------------------------------------- |
| HTTPS-only network            | `src/lib/network/httpsClient.ts` (`HttpsOnlyError`)            |
| Certificate pinning hook      | `HttpsClient.certificateValidator`                             |
| Endpoint validation           | `validateAppConfig()` in `src/lib/config.ts`                   |
| TON Connect manifest enforces | `validateManifest()` — HTTPS for url/iconUrl/terms/privacy     |
| Secure storage abstraction    | `SecureKeyValueStore` (iOS Keychain / Android Keystore)        |
| Biometric prompt abstraction  | `BiometricAuthenticator`                                       |
| Non-custodial signing         | All signing routes via `MobileTonConnectConnector` → wallet    |

No private keys are accepted by, returned from, or persisted by any module
in this package. The connector deliberately persists only public information
(wallet id, public address, platform).

## Build / run

### Prerequisites

| Tool          | Version            |
| ------------- | ------------------ |
| Node          | ≥ 20               |
| Xcode         | 15+ (iOS 14 SDK)   |
| Android SDK   | 26 (Android 8) min |
| JDK           | 17                 |

### Install

```bash
# Build the mobile-core typings first (consumed via file:../mobile)
cd mobile && npm install && npm run build

# Install the wrapper
cd ../mobile-app && npm install
```

### Test

```bash
cd mobile-app
npm test            # 65 unit tests, node-only
npm run typecheck   # validates src/lib/** against the lib-only tsconfig
npm run lint
```

### iOS

See [`ios/README.md`](ios/README.md). Short version:

```bash
cd mobile-app/ios
pod install
open tonbankcard.xcworkspace
```

Bundle id: `app.tonbankcard.mobile`. Deployment target: iOS 14.

### Android

See [`android/README.md`](android/README.md). Short version:

```bash
cd mobile-app/android
./gradlew bundleRelease
```

Application id: `app.tonbankcard.mobile`. `minSdk=26`, `targetSdk=34`.

## CI

The `mobile-app` package is wired into `.github/workflows/ci.yml` alongside
the existing packages. Each job (`build-mobile-app`, plus mobile-app steps
in `lint`, `test`, `typecheck`) rebuilds `mobile/` first so the consumed
typings stay current.

## What is intentionally NOT in this scaffold

- No published JS bundle; production apps must run `react-native bundle` or
  `xcodebuild`/`gradlew` from inside `ios/` and `android/`.
- No keystores, provisioning profiles, signing keys, or App Store
  credentials in source control.
- No private-key handling of any kind — every payment path defers to the
  user's wallet through TON Connect.
