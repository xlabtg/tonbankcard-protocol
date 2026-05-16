---
name: "[C1] Public Documentation Site"
about: Convert docs/ markdown files into a hosted documentation website
labels: type:docs
track: C
priority: medium
---

## 1. Goal

Convert the 50+ documentation markdown files in `docs/` into a publicly hosted documentation website, making the protocol accessible to developers, merchants, and auditors without requiring them to read raw GitHub files.

## 2. Context

The protocol has extensive documentation (`docs/` contains 50+ files covering architecture, security, governance, economics, and more) but it exists only as raw markdown in the repository. A hosted documentation site dramatically improves developer experience and adoption.

For whom:
- **Merchants**: Integration guides, API reference, SDK quickstart
- **Developers**: Architecture overview, contributing guide, contract specifications
- **Auditors**: Threat model, invariants, audit readiness documentation
- **Community**: Whitepaper, litepaper, governance framework

Related to: [DEVELOPMENT_ROADMAP.md — Track C, C1](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Documentation Site
- Technology: Docusaurus (recommended) or GitBook
- Hosting: `docs.tonbankcard.com` or equivalent
- Sections:
  - **Getting Started** — quickstart, architecture overview
  - **Merchant Guide** — API reference, SDK integration, webhook setup
  - **Smart Contracts** — contract specifications, invariants, deployment addresses
  - **Security** — threat model, audit reports, responsible disclosure
  - **Governance** — DAO framework, voting, transparency reports
  - **Economics** — token economics, fee structure
  - **Developer Reference** — contributing guide, local setup, testing

### Auto-Generated Content
- SDK API docs: auto-generated from TypeScript types in `sdk/src/types.ts`
- REST API docs: auto-generated from `docs/merchant-api-spec.md` (OpenAPI format)

## 4. Out of Scope

- Marketing content, price predictions, or yield promises
- Translations (English only for v1)
- Interactive API playground (stretch goal for v2)
- Blog or news section

## 5. Content Requirements

- All documentation must accurately reflect the current implementation state
- Security documentation must include accurate scope and limitations
- Non-custodial nature of the protocol must be clearly explained
- All links between documentation pages must be valid
- Code examples must be tested and working

## 6. Acceptance Criteria

- [ ] Documentation framework (Docusaurus or GitBook) set up in `docs-site/` or equivalent
- [ ] All existing `docs/` markdown files migrated to the framework
- [ ] SDK API docs auto-generated from `sdk/src/types.ts`
- [ ] REST API docs generated from merchant API spec
- [ ] Site deployed and accessible at a public URL
- [ ] CI check added to verify documentation builds without errors
- [ ] `README.md` updated with link to the documentation site
- [ ] All internal links verified (no broken links)

## 7. References

- [Architecture](../docs/architecture.md)
- [Merchant API Spec](../docs/merchant-api-spec.md)
- [Whitepaper](../docs/whitepaper/)
- [Litepaper](../docs/litepaper/)
- [SDK Types](../sdk/src/types.ts)
- Docusaurus: https://docusaurus.io
