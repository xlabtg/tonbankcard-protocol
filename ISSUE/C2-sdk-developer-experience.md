---
name: "[C2] SDK Developer Experience Improvements"
about: Publish SDK to npm, add interactive examples, and create framework integrations
labels: type:frontend
track: C
priority: medium
---

## 1. Goal

Improve the developer experience of `@tonbankcard/merchant-sdk` by publishing it to npm, adding interactive integration examples, and providing framework-specific integration guides (React, Vue, plain HTML).

## 2. Context

The SDK is at v1.0.0 in the repository but has not been published to the npm registry. Merchants who want to integrate cannot simply `npm install @tonbankcard/merchant-sdk`. Additionally, the `examples/` directory may be sparse and lacks framework-specific integration patterns.

Related to: [DEVELOPMENT_ROADMAP.md — Track C, C2](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### npm Publishing
- Set up npm publish workflow (GitHub Actions)
- Publish `@tonbankcard/merchant-sdk` to npm registry
- Set up provenance attestation for supply-chain transparency (`npm publish --provenance`)
- Configure automated publish on GitHub release creation

### Interactive Examples
- `examples/react-integration/` — React component using the SDK payment widget
- `examples/vue-integration/` — Vue component equivalent
- `examples/vanilla-html/` — Plain HTML + `<script>` tag integration
- Each example must be standalone (runnable without the full monorepo)

### SDK Changelog
- `sdk/CHANGELOG.md` updated with all changes since initial commit
- Follow Keep A Changelog format

### Postman Collection
- Postman collection covering all Merchant API endpoints
- Exported as JSON to `docs/merchant-api.postman_collection.json`
- Importable by merchants for API testing

## 4. Out of Scope

- Backend logic or contract changes
- Custody of merchant funds or private keys
- Pricing or yield promises in SDK documentation

## 5. Functional Requirements

1. `npm install @tonbankcard/merchant-sdk` works after publishing
2. React example renders the payment widget and handles the `onPaymentComplete` callback
3. Vue example equivalent to React example
4. Vanilla HTML example works with a `<script>` tag (no build step)
5. All examples connect to the public testnet (not requiring a local setup)
6. SDK CHANGELOG documents all changes in version history

## 6. Non-Functional Requirements

- Examples must have zero build errors with current Node.js LTS
- Published npm package must include TypeScript type declarations (`.d.ts` files)
- Package size must be < 100 KB (gzipped)
- Examples must work in all major browsers (Chrome, Firefox, Safari, Edge)

## 7. Security Requirements

- No API keys or secrets committed to example code (use `process.env` or `import.meta.env`)
- npm publish workflow must use GitHub Actions OIDC (not stored npm token in secrets)
- `npm publish --provenance` for supply-chain transparency
- Each published version must pass `npm audit` with zero critical/high vulnerabilities

## 8. Acceptance Criteria

- [ ] `@tonbankcard/merchant-sdk` published to npm registry
- [ ] npm publish automated via GitHub Actions on release creation
- [ ] `examples/react-integration/` working example
- [ ] `examples/vue-integration/` working example
- [ ] `examples/vanilla-html/` working example
- [ ] `sdk/CHANGELOG.md` updated and complete
- [ ] Postman collection exported to `docs/merchant-api.postman_collection.json`
- [ ] All examples tested against testnet and confirmed working

## 9. References

- [SDK](../sdk/)
- [SDK README](../sdk/README.md)
- [Examples](../examples/)
- [Merchant API Spec](../docs/merchant-api-spec.md)
- Keep A Changelog: https://keepachangelog.com
