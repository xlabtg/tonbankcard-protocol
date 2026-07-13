# Frontend findings
- MEDIUM-HIGH: wallet-ui/src/components/WalletApp.ts:214-217 generateConnectLink interpolates paymentHubAddress raw into ton://transfer path — no Address.parse, no encodeURIComponent. Same class as FRONTEND-H1(#264)/H2(#265) but wallet-ui not covered. Fix: use buildTonTransferLink from deepLink.ts, validate in constructor.
