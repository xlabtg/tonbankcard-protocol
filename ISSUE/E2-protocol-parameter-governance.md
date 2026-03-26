---
name: "[E2] Protocol Parameter Governance"
about: Identify and govern protocol parameters via DAO; eliminate single-key parameter control
labels: type:contract
track: E
priority: medium
---

## 1. Goal

Identify all protocol parameters that can be changed after deployment, create a governance proposal process for each parameter change, and ensure no single key can unilaterally modify parameters without a governance vote.

## 2. Context

Some protocol parameters (such as the whitelisted NFT collections in `PaymentHub.tact`) may be configurable post-deployment. If these are controlled by a single admin key, they represent a centralization risk and a potential attack vector (admin key compromise → protocol manipulation).

Transitioning parameter control to DAO governance ensures the community has oversight of all changes that affect the protocol's behavior.

Related to: [DEVELOPMENT_ROADMAP.md — Track E, E2](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Parameter Identification
- Audit all contracts for mutable parameters (state variables that can be changed post-deployment)
- Document each parameter: current value, who can change it, change frequency
- Classify each parameter: governance-controlled, time-locked, or immutable

### Governance Process
- For each governance-controlled parameter, define:
  - Proposal template (what information is required)
  - Quorum and voting threshold (some parameters may need supermajority)
  - Execution timelock
- Document process in `docs/governance/PARAMETER_CHANGES.md`

### Code Changes (if needed)
- If parameters are currently controlled by a single admin key, add a multi-sig or governance executor check
- No functional changes to the protocol — only access control for parameter changes

## 4. Out of Scope

- Risk Authority governance (covered by E3)
- Adding new parameters that don't exist yet
- Changing the values of existing parameters (governance should do that)

## 5. Functional Requirements

1. `docs/governance/PARAMETERS.md` lists all governable parameters:
   - Parameter name, contract, current value, governance process
2. Governance proposals for parameter changes follow the template in `docs/governance/PARAMETER_CHANGES.md`
3. No single EOA (Externally Owned Account) key can change any governance-controlled parameter
4. All parameter changes logged via `TransparencyRegistry`

## 6. Non-Functional Requirements

- Parameter audit must cover 100% of deployed contracts
- Governance process must be implementable with existing governance contracts (ProposalRegistry)
- Documentation must be clear enough for community members to submit proposals

## 7. Security Requirements

- Single-key parameter control must be removed for all governance-controlled parameters
- Parameter change proposals must have a minimum 48-hour timelock after voting
- Emergency parameter changes (if any) must require multi-sig (minimum 2-of-3)

## 8. Acceptance Criteria

- [ ] E1 (DAO governance activation) complete (prerequisite)
- [ ] Audit of all mutable parameters completed
- [ ] `docs/governance/PARAMETERS.md` written with full parameter inventory
- [ ] `docs/governance/PARAMETER_CHANGES.md` proposal template created
- [ ] Single-key parameter controls replaced with governance executor (where applicable)
- [ ] All parameter changes testable via the governance round-trip (ProposalRegistry)

## 9. References

- [Governance Contracts](../contracts/governance/)
- [DAO Governance](../docs/dao-governance.md)
- [Governance Process](../docs/governance-process.md)
- Issue E1: [E1-dao-governance-activation.md](./E1-dao-governance-activation.md)
