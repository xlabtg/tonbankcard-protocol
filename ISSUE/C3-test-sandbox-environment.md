---
name: "[C3] Test Sandbox Environment"
about: Create a public testnet sandbox with a TBC faucet for merchant integration testing
labels: type:backend
track: C
priority: medium
---

## 1. Goal

Provide a publicly accessible testnet sandbox that merchants can use to integrate and test the payment flow without requiring real TBC tokens or TON mainnet transactions.

## 2. Context

Currently, merchants wanting to integrate with the protocol must either set up their own local environment (complex) or use the production protocol (risky for initial integration). A hosted public testnet sandbox with a TBC faucet removes this barrier and accelerates merchant adoption.

Related to: [DEVELOPMENT_ROADMAP.md — Track C, C3](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Sandbox Services
- A hosted instance of the Merchant API (`api/`) connected to TON testnet contracts
- A hosted instance of the Payment Indexer (`backend/indexer/`) on testnet
- Public sandbox base URL (e.g., `sandbox.api.tonbankcard.com`)

### TBC Faucet
- A simple faucet endpoint or web page
- Dispenses testnet TBC tokens to any requesting wallet address
- Rate-limited (e.g., 1 request per address per hour)
- Faucet script stored in `scripts/faucet/`

### Mock Gateway Endpoints
- ChangeNOW sandbox mode configured in the sandbox environment
- NOWPayments sandbox mode configured
- Clear documentation on sandbox vs. production environment differences

### Sandbox Documentation
- `docs/sandbox.md` documenting:
  - Sandbox API base URL
  - Test NFT card addresses/IDs for testing
  - How to use the TBC faucet
  - Limitations (rate limits, no real funds)

## 4. Out of Scope

- Real TON mainnet transactions in the sandbox
- Real fiat money or real crypto gateways
- User data privacy for sandbox requests (sandbox is for testing only)

## 5. Functional Requirements

1. Merchant can create a test invoice against the sandbox API with no API key
2. TBC faucet endpoint accepts a wallet address and dispenses testnet TBC
3. End-to-end payment flow testable on testnet:
   - Create invoice → generate payment link → simulate payment → receive webhook
4. Test NFT card IDs documented for use in integration tests
5. Sandbox environment variables documented in `docs/sandbox.md`

## 6. Non-Functional Requirements

- Sandbox availability: best-effort (not production SLA)
- Faucet rate limit: maximum 1 dispense per wallet address per hour
- Sandbox API must clearly identify itself as a sandbox (e.g., `X-Tonbankcard-Environment: sandbox` header)
- Test data does not persist indefinitely (reset weekly or monthly)

## 7. Security Requirements

- Sandbox must not have access to production API keys or mainnet funds
- Faucet must have rate limiting to prevent token hoarding/abuse
- Sandbox API keys must be clearly labeled as sandbox-only in documentation
- No real user PII should be stored in the sandbox environment

## 8. Acceptance Criteria

- [ ] Sandbox instance of Merchant API deployed on testnet
- [ ] Sandbox instance of Payment Indexer deployed on testnet
- [ ] TBC faucet script created in `scripts/faucet/`
- [ ] Faucet accessible via web page or API endpoint
- [ ] End-to-end payment flow verified in sandbox
- [ ] `docs/sandbox.md` written with full instructions
- [ ] SDK examples (C2) updated to point to sandbox by default
- [ ] Faucet rate limiting implemented and tested

## 9. References

- [Merchant API](../api/)
- [Indexer](../backend/indexer/)
- [Scripts](../scripts/)
- [Architecture](../docs/architecture.md)
- Issue B1: [B1-testnet-deployment-and-validation.md](./B1-testnet-deployment-and-validation.md)
- Issue C2: [C2-sdk-developer-experience.md](./C2-sdk-developer-experience.md)
