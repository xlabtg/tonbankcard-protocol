---
name: "[F1] TON Connect Deep Integration"
about: Full TON Connect v2 integration in wallet-ui with support for all major TON wallets and QR code payment flow
labels: type:frontend
track: F
priority: low
---

## 1. Goal

Implement full TON Connect v2 integration in `wallet-ui/`, supporting all major TON wallets (Tonkeeper, Tonhub, OpenMask), deep link generation for mobile wallet signing, and a QR code payment flow for point-of-sale use cases.

## 2. Context

The current `wallet-ui/` uses vanilla DOM and may have a basic TON Connect integration. A full TON Connect v2 integration enables:
- Multi-wallet support (users choose their preferred wallet)
- Mobile deep links (seamless transition from web to mobile wallet)
- QR code payment flow (merchant devices at point-of-sale scan or display QR codes)

This is a significant UX improvement and opens point-of-sale use cases.

Related to: [DEVELOPMENT_ROADMAP.md — Track F, F1](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### TON Connect v2 Integration
- Replace any existing wallet connection logic with TON Connect v2 SDK
- Wallet selector modal (Tonkeeper, Tonhub, OpenMask, and any TON Connect-compatible wallet)
- Connection state management (connected, disconnected, pending)
- Transaction request flow (sign → broadcast → confirm)

### Mobile Deep Links
- Generate `ton://` deep links for wallet signing
- Handle redirect flow (user taps link → wallet opens → signs → returns to app)
- Universal links for iOS and Android

### QR Code Payment Flow
- Generate QR codes containing TON payment URLs
- Payment confirmation via scanning the QR code with a TON Connect wallet
- Merchant point-of-sale display: static QR per invoice
- User flow: scan QR → wallet opens → confirm payment → wallet redirects to confirmation page

## 4. Out of Scope

- Backend changes (TON Connect is purely client-side)
- Custody of private keys (TON Connect explicitly prohibits this)
- Building a mobile app wrapper (covered by F2)
- Payment widget changes in the SDK (the wallet-ui is separate from the merchant widget)

## 5. Functional Requirements

1. Users can connect any TON Connect-compatible wallet
2. Payment requests sent via TON Connect and signed by the user's wallet
3. QR codes generated for each payment invoice
4. Deep links work on both iOS and Android
5. Wallet compatibility matrix documented (Tonkeeper, Tonhub, OpenMask — verified)

## 6. Non-Functional Requirements

- Wallet connection must not require page reload
- QR codes must be scannable in standard room lighting
- Deep links must work with the latest versions of Tonkeeper, Tonhub, and OpenMask
- UI must degrade gracefully if TON Connect is not available (show fallback manual address)

## 7. Security Requirements

- No private keys ever stored in the browser (TON Connect enforces this)
- Deep links must use HTTPS for redirect URLs (no plain HTTP)
- QR code content must not expose sensitive data beyond the payment address and amount
- Phishing protection: wallet-ui domain must be registered with TON Connect manifest

## 8. Acceptance Criteria

- [ ] TON Connect v2 integrated in `wallet-ui/`
- [ ] Wallet selector modal works with Tonkeeper, Tonhub, and OpenMask
- [ ] QR code payment flow works end-to-end on testnet
- [ ] Mobile deep links tested on iOS and Android
- [ ] Wallet compatibility matrix documented in `docs/wallet-compatibility.md`
- [ ] All existing wallet-ui tests pass (28 tests)
- [ ] TON Connect manifest registered and validated

## 9. References

- [Wallet UI](../wallet-ui/)
- [Architecture](../docs/architecture.md)
- TON Connect v2 docs: https://docs.ton.org/develop/dapps/ton-connect/overview
- Tonkeeper: https://tonkeeper.com
- Tonhub: https://tonhub.com
