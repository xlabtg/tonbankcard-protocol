# Issue 425 deployment-tooling smoke test

This fixture exercises the offline CLI boundary with deterministic synthetic
TON cells. It is not a deployable protocol contract.

```bash
npx ts-node experiments/issue-425-deployment-tooling/create-fixture.ts
ADMIN_ADDRESS=EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c \
RISK_AUTHORITY_ADDRESS=EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c \
npx ts-node scripts/deploy/deploy.ts \
  --network testnet \
  --artefacts experiments/issue-425-deployment-tooling/artefacts.json \
  --output experiments/issue-425-deployment-tooling/manifest.json
```

Generated JSON files are ignored and may be removed after the experiment.
