# Deployment tooling

The tooling is deliberately split into an offline preparation step and an
independent on-chain verification step. It never accepts a mnemonic/private key
and never broadcasts a transaction.

## 1. Compile and prepare init cells

Compile every contract with the compiler versions frozen for the B1/B2 cycle.
Export each compiled code cell and fully encoded init-data cell as a single-root
BOC. Create an operator-local input file (do not commit ceremony values):

```json
[
  {
    "contract": "PaymentHub",
    "codeBoc": "te6cckEBAQEA...",
    "dataBoc": "te6cckEBAQEA...",
    "workchain": 0,
    "initParameters": {
      "admin": "EQ..."
    }
  }
]
```

`codeBoc` and `dataBoc` are compiler/wrapper outputs. Keeping init encoding in
the generated Blueprint/Tact wrapper avoids duplicating contract-specific state
layouts in this security-sensitive script.

## 2. Build unsigned deploy BOCs

```bash
ADMIN_ADDRESS=EQ... \
RISK_AUTHORITY_ADDRESS=EQ... \
npx ts-node scripts/deploy/deploy.ts \
  --network testnet \
  --artefacts /secure/path/artefacts.json \
  --output deployments/testnet/2026-08-13T00-00-00Z.json
```

For mainnet add `--confirm`. The command writes deterministic addresses, code
and init-data hashes, a serialized StateInit, and an unsigned external-in deploy
message carrying StateInit. It does not sign, fund, or send anything. The
operator wraps each `unsignedStateInitBoc` as a funded internal transfer in the
deployment multi-sig ceremony; broadcasting the external BOC directly is not a
deployment transaction.

The prepared manifest has `artefactType = "prepared"` and
`verificationBlock = null`. After every multi-sig deployment is confirmed, add
each `deployTx`/`deployBlock`, choose a masterchain block at or after all deploy
transactions, set it as `verificationBlock`, and change `artefactType` to
`"live"`. Only then can the verifier attest the manifest.

## 3. Verify on-chain state

```bash
TON_RPC_ENDPOINT=https://your-archive-endpoint/jsonRPC \
TONCENTER_API_KEY=... \
npx ts-node scripts/deploy/verify.ts \
  --manifest deployments/testnet/2026-08-13T00-00-00Z.json
```

The endpoint must support the `seqno` parameter for block-pinned
`getAddressInformation` and `runGetMethod`, and must return `block_id.seqno`.
A latest-state-only endpoint is
rejected. Verification checks:

- manifest JSON schema and `artefactType = live`;
- active contract state at the requested block;
- on-chain code cell hash;
- complete on-chain data cell hash (the init-state attestation);
- admin/risk-authority getter where the production contract exposes one;
- existing forbidden source-pattern checks.

Any missing field, unsupported historical query, block mismatch, hash mismatch,
getter failure, or unknown source mapping makes `allPassed` false and exits
non-zero. The report is written beside the manifest as `*.verification.json`.

Dry-run placeholders are not valid live manifests. The canonical schema is
[`docs/deployments/manifest.schema.json`](../../docs/deployments/manifest.schema.json).
