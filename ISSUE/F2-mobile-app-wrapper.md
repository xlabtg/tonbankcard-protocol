---
name: "[F2] Mobile App Wrapper"
about: Build a React Native wrapper around @tonbankcard/mobile-core for iOS and Android
labels: type:frontend
track: F
priority: low
---

## 1. Goal

Build a React Native mobile application wrapping the existing `@tonbankcard/mobile-core` package, enabling native iOS and Android apps with TON Connect mobile SDK integration, targeting App Store and Google Play submission.

## 2. Context

The `mobile/` directory contains `@tonbankcard/mobile-core` — platform-agnostic business logic with 57 tests. This package does not include a native UI. A React Native wrapper would provide a native user experience on iOS and Android using the existing core logic.

This is a significant development effort and should be pursued after the protocol is stable in production (Tracks A–D complete).

Related to: [DEVELOPMENT_ROADMAP.md — Track F, F2](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### React Native Application
- New directory: `mobile-app/` (React Native project)
- Wraps `@tonbankcard/mobile-core` for all business logic
- Screens:
  - Home / Dashboard (account balance, recent transactions)
  - Send Payment (recipient, amount, confirmation)
  - Receive Payment (QR code display)
  - Transaction History
  - Account Settings

### TON Connect Mobile SDK
- Integrate TON Connect mobile SDK for wallet signing
- Deep link handling from TON Connect wallets
- Biometric authentication support (Face ID, fingerprint)

### App Store / Google Play
- iOS bundle ID and signing configured
- Android package name and signing configured
- App store listing content (description, screenshots, privacy policy)

## 4. Out of Scope

- Building the wallet logic from scratch (use `@tonbankcard/mobile-core`)
- Backend changes for mobile
- Telegram Mini App (separate UX pattern, different scope)

## 5. Functional Requirements

1. React Native app builds for iOS and Android
2. All `@tonbankcard/mobile-core` features exposed through the mobile UI
3. TON Connect wallet signing works on mobile
4. QR code scanning for receiving payments
5. Biometric authentication for app unlock and payment confirmation

## 6. Non-Functional Requirements

- App must work on iOS 14+ and Android 8+
- App startup time < 3 seconds on mid-range devices
- No custody of user private keys in the app
- App must pass App Store and Google Play review guidelines

## 7. Security Requirements

- No private keys stored in app storage (use secure enclave / keystore for signatures)
- TON Connect enforces that private keys stay in the wallet app
- All sensitive data (balances, addresses) encrypted in local storage
- Network communication via HTTPS only
- Certificate pinning for API calls

## 8. Acceptance Criteria

- [ ] F1 (TON Connect deep integration) complete (prerequisite)
- [ ] React Native project created in `mobile-app/`
- [ ] All core screens implemented using `@tonbankcard/mobile-core`
- [ ] TON Connect mobile signing working
- [ ] iOS build passing (Xcode)
- [ ] Android build passing (Gradle)
- [ ] App submitted to TestFlight (iOS) and Play Console internal testing (Android)
- [ ] All `@tonbankcard/mobile-core` tests still passing

## 9. References

- [Mobile Core](../mobile/)
- [Wallet UI](../wallet-ui/)
- React Native: https://reactnative.dev
- TON Connect Mobile: https://docs.ton.org/develop/dapps/ton-connect/mobile
- Issue F1: [F1-ton-connect-deep-integration.md](./F1-ton-connect-deep-integration.md)
