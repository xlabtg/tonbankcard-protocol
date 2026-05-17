import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

/**
 * Manually-curated sidebar mirroring the sections of `docs/INDEX.md`.
 *
 * NOTE: all paths are doc IDs (file paths without the `.md` extension)
 * relative to the `docs/` directory configured in `docusaurus.config.ts`.
 */
const sidebars: SidebarsConfig = {
  protocolSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: ['INDEX'],
    },
    {
      type: 'category',
      label: 'Protocol Overview',
      collapsed: false,
      items: [
        'architecture',
        'whitepaper/whitepaper-v1',
        'litepaper/litepaper-v1',
        'invariants',
        'existing-contracts',
        'versioning-policy',
      ],
    },
    {
      type: 'category',
      label: 'Smart Contracts',
      items: [
        'contracts/nft-account-resolver',
        'contracts/payment-hub',
        'collateral-signal',
        'public-collateral-lookup',
        'lending-adapter',
        'merchant-payments',
        'phase4-advanced-features',
      ],
    },
    {
      type: 'category',
      label: 'Merchant Integration',
      items: [
        'merchant-api-spec',
        'merchant-api-security',
        'merchants/onboarding-guide',
      ],
    },
    {
      type: 'category',
      label: 'Security',
      items: [
        'security/THREAT_MODEL',
        'security/SECURITY',
        'security/AUDIT_READINESS',
        'security/TESTING_STRATEGY',
        'security/KEY_MANAGEMENT',
        'security/INCIDENT_RESPONSE',
        'threat-model',
        'attack-surface-diagram',
        'audit-architecture-diagrams',
        'audit-scope',
        'audit-notes',
        'audit/FULL_SYSTEM_AUDIT',
        'audit/external-audit-intro',
        {
          type: 'category',
          label: 'External Audits',
          items: [
            'security/audits/README',
            'security/audits/REPORT_TEMPLATE',
            'security/audits/REMEDIATION_WORKFLOW',
            'security/audits/A1-core-contracts/ENGAGEMENT',
            'security/audits/A1-core-contracts/STATUS',
            'security/audits/A2-phase4-contracts/ENGAGEMENT',
            'security/audits/A2-phase4-contracts/STATUS',
            'security/audits/A4-offchain-services/ENGAGEMENT',
            'security/audits/A4-offchain-services/STATUS',
            'security/audits/A4-offchain-services/PENTEST_PLAN',
            'security/audits/A4-offchain-services/OWASP_CHECKLIST',
            'security/audits/A5-bug-bounty/PROGRAM_BRIEF',
            'security/audits/A5-bug-bounty/ENGAGEMENT',
            'security/audits/A5-bug-bounty/STATUS',
            'security/audits/A5-bug-bounty/DRY_RUN',
            'security/audits/A5-bug-bounty/SEVERITY_RUBRIC',
            'security/audits/A5-bug-bounty/QUARTERLY_REPORT_TEMPLATE',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Governance',
      items: [
        'dao-governance',
        'governance',
        'governance-process',
        'governance-transparency',
        'governance-transparency-privacy',
        'governance-transparency-verification',
        'governance-release-notes',
        'governance/INCIDENT_RESPONSE',
        'governance/release-notes-v1',
      ],
    },
    {
      type: 'category',
      label: 'Compliance',
      items: [
        'compliance/REGULATORY_MAP',
        'compliance/LEGAL_RISK_MODEL',
        'compliance/MERCHANT_COMPLIANCE_GUIDE',
      ],
    },
    {
      type: 'category',
      label: 'Economics',
      items: ['economics/SIMULATIONS'],
    },
    {
      type: 'category',
      label: 'Operations & Production',
      items: [
        'production/SLA',
        'production/MONITORING',
        'production/INFRASTRUCTURE',
        'production/BACKUP',
        'production/on-call',
        {
          type: 'category',
          label: 'B3 — Monitoring',
          items: [
            'production/B3-monitoring/ENGAGEMENT',
            'production/B3-monitoring/STATUS',
            'production/B3-monitoring/ALERT_RULES',
            'production/B3-monitoring/DASHBOARDS',
            'production/B3-monitoring/IMPLEMENTATION_RUNBOOK',
            'production/B3-monitoring/INCIDENT_DRILL',
            'production/B3-monitoring/METRICS_INSTRUMENTATION',
            'production/B3-monitoring/STACK_SELECTION',
            'production/B3-monitoring/drills/template',
          ],
        },
        'deployments/network-matrix',
        {
          type: 'category',
          label: 'B1 — Testnet Deployment',
          items: [
            'deployments/B1-testnet/ENGAGEMENT',
            'deployments/B1-testnet/STATUS',
            'deployments/B1-testnet/DEPLOYMENT_PLAN',
            'deployments/B1-testnet/RUNBOOK',
            'deployments/B1-testnet/VALIDATION_PLAN',
            'deployments/B1-testnet/INDEXER_VALIDATION',
            'deployments/B1-testnet/GATEWAY_VALIDATION',
          ],
        },
        {
          type: 'category',
          label: 'B2 — Mainnet Deployment',
          items: [
            'deployments/B2-mainnet/ENGAGEMENT',
            'deployments/B2-mainnet/STATUS',
            'deployments/B2-mainnet/DEPLOYMENT_PLAN',
            'deployments/B2-mainnet/MULTISIG_CEREMONY',
            'deployments/B2-mainnet/VERIFICATION_PLAN',
            'deployments/B2-mainnet/IMMUTABILITY_VERIFICATION',
            'deployments/B2-mainnet/ROLLBACK_PROCEDURES',
          ],
        },
        'registry/protocol-registry',
      ],
    },
    {
      type: 'category',
      label: 'Database & Schema',
      items: ['database-schema'],
    },
    {
      type: 'category',
      label: 'Integrations',
      items: ['integrations/external-guarantees'],
    },
    {
      type: 'category',
      label: 'Releases',
      items: ['releases/protocol-v1.0'],
    },
    {
      type: 'category',
      label: 'Formal Verification',
      items: ['formal-verification/README'],
    },
  ],
};

export default sidebars;
