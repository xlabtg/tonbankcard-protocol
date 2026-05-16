---
name: "[E1] DAO Governance Activation"
about: Deploy governance contracts to testnet and mainnet; activate the DAO governance process
labels: type:contract
track: E
priority: medium
---

## 1. Goal

Deploy the governance contracts (`ProposalRegistry`, `SnapshotVerifier`, `TransparencyRegistry`) to testnet and then mainnet, define initial governance parameters, create a voter snapshot methodology, and publish the first governance activation proposal.

## 2. Context

The governance contracts exist in `contracts/governance/` and are part of Phase 2 (complete code). They have not been deployed to any live network. Activating governance is a prerequisite for decentralizing protocol control (E2, E3) and for formal DAO operation.

Governance activation should happen after A1 audit and B2 mainnet deployment, when the protocol is live and there is a community to participate in governance.

Related to: [DEVELOPMENT_ROADMAP.md — Track E, E1](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Contract Deployment
- `contracts/governance/ProposalRegistry.tact` — deployed to testnet, then mainnet
- `contracts/governance/SnapshotVerifier.tact` — deployed to testnet, then mainnet
- `contracts/governance/TransparencyRegistry.tact` — deployed to testnet, then mainnet

### Initial Governance Parameters
- Quorum: minimum percentage of eligible votes for a proposal to be valid
- Voting period: duration of voting (e.g., 7 days)
- Proposal threshold: minimum TBC/NFT weight to submit a proposal
- Execution delay: time between proposal passing and execution (e.g., 48-hour timelock)

### Voter Snapshot Methodology
- Define voter eligibility: NFT-weighted or TBC-weighted (or both)
- Snapshot block selection process (avoid last-minute manipulation)
- Voter verification using `SnapshotVerifier.tact`

### Governance Activation Proposal
- First governance proposal: ratification of the initial governance parameters
- Published per `docs/governance-process.md`

## 4. Out of Scope

- Protocol parameter governance (covered by E2)
- Risk Authority decentralization (covered by E3)
- On-chain transparency reporting implementation (covered by E4)
- Changes to the governance contract code (audit findings must be addressed in A1 first)

## 5. Functional Requirements

1. All three governance contracts deployed to TON testnet with correct configuration
2. At least one test proposal created and voted on in the testnet environment
3. Governance parameters documented in `docs/governance/PARAMETERS.md`
4. Voter snapshot methodology documented in `docs/governance/SNAPSHOT.md`
5. Governance activation proposal published to the community (via GitHub Discussion or equivalent)

## 6. Non-Functional Requirements

- Governance contract deployment must use the same multi-sig deployer as B2
- Voting period must be long enough for community participation (minimum 7 days)
- Quorum must be high enough to prevent governance capture by small groups
- All governance actions must be logged via `TransparencyRegistry`

## 7. Security Requirements

- A1 audit must be complete before mainnet deployment of governance contracts
- Proposal execution must have a timelock (minimum 48 hours after vote passes)
- Quorum parameter must be set conservatively initially (err on side of higher quorum)
- Snapshot block must be taken before proposal creation to prevent last-minute vote buying

## 8. Acceptance Criteria

- [ ] A1 audit complete (prerequisite)
- [ ] B2 mainnet deployment complete (prerequisite)
- [ ] All three governance contracts deployed to testnet
- [ ] Testnet governance round-trip tested (propose → vote → execute)
- [ ] Initial governance parameters documented in `docs/governance/PARAMETERS.md`
- [ ] Voter snapshot methodology documented in `docs/governance/SNAPSHOT.md`
- [ ] Governance activation proposal published to community
- [ ] Contracts deployed to mainnet after testnet validation

## 9. References

- [Governance Contracts](../contracts/governance/)
- [DAO Governance](../docs/dao-governance.md)
- [Governance Process](../docs/governance-process.md)
- Issue A1: [A1-formal-security-audit-core-contracts.md](./A1-formal-security-audit-core-contracts.md)
- Issue B2: [B2-mainnet-deployment-plan.md](./B2-mainnet-deployment-plan.md)
